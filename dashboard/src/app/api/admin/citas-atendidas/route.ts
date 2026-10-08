import { NextResponse } from "next/server";
import pool, { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { clearCache } from "@/lib/cache";
import { normalizarProgramaMeta } from "@/lib/cumplimiento/categorias";
import { parsePeriodo } from "@/lib/cumplimiento/periodo";

// cantidad_citas es INT
const CITAS_MAX = 2147483647;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/** Cédula como texto de solo dígitos (BIGINT en la BD). Retorna null si no es válida. */
function parseDocumento(valor: unknown): string | null {
  const texto = typeof valor === "number" ? String(valor) : valor;
  if (typeof texto !== "string" || !/^[1-9]\d{0,14}$/.test(texto)) return null;
  return texto;
}

export async function GET(request: Request) {
  const { error } = await requireAuth(["admin", "direccion_medica"]);
  if (error) return error;

  const periodo = parsePeriodo(new URL(request.url).searchParams.get("periodo"));
  if (periodo === null) {
    return badRequest("El periodo debe tener el formato AAAAMM");
  }

  // Profesionales activos con sus citas del periodo, más las citas del periodo
  // cuyo profesional está inactivo o ya no figura en el catálogo.
  const rows = await query<{
    documento: string;
    nombre: string | null;
    estado: string | null;
    programa_meta: string | null;
    cantidad_citas: number | null;
    programa: string | null;
  }>(
    `SELECT m.identificacion::text AS documento, m.nombre, m.estado, m.programa_meta,
            c.cantidad_citas, c.programa
     FROM medicos m
     LEFT JOIN citas_atendidas c
            ON c.documento = m.identificacion AND c.periodo = $1
     WHERE m.estado = 'ACTIVO'
     UNION ALL
     SELECT c.documento::text AS documento, COALESCE(m.nombre, c.nombre_medico) AS nombre,
            m.estado, m.programa_meta, c.cantidad_citas, c.programa
     FROM citas_atendidas c
     LEFT JOIN medicos m ON m.identificacion = c.documento
     WHERE c.periodo = $1
       AND (m.identificacion IS NULL OR m.estado IS DISTINCT FROM 'ACTIVO')
     ORDER BY nombre`,
    [periodo]
  );

  return NextResponse.json(rows);
}

export async function PUT(request: Request) {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return badRequest("El cuerpo de la solicitud no es válido");
  }

  const periodo = parsePeriodo(body.periodo);
  if (periodo === null) {
    return badRequest("El periodo debe tener el formato AAAAMM");
  }
  if (!Array.isArray(body.filas) || body.filas.length === 0) {
    return badRequest("Debe enviar al menos una fila");
  }

  // Se valida todo antes de escribir: si una fila es inválida no se guarda ninguna
  const guardar: { documento: string; cantidad_citas: number; programa: string | null }[] = [];
  const eliminar: string[] = [];
  const vistos = new Set<string>();

  for (let i = 0; i < body.filas.length; i++) {
    const fila = body.filas[i];
    const n = i + 1;
    if (!fila || typeof fila !== "object") {
      return badRequest(`Fila ${n}: formato no válido`);
    }
    const documento = parseDocumento(fila.documento);
    if (documento === null) {
      return badRequest(`Fila ${n}: cédula no válida`);
    }
    const ref = `Fila ${n} (cédula ${documento})`;
    if (vistos.has(documento)) {
      return badRequest(`${ref}: la cédula está repetida`);
    }
    vistos.add(documento);

    const { cantidad_citas } = fila;
    const programa = normalizarProgramaMeta(fila.programa);
    if (!programa.valido) {
      return badRequest(`${ref}: programa no válido`);
    }
    if (cantidad_citas === null) {
      eliminar.push(documento);
      continue;
    }
    if (!Number.isInteger(cantidad_citas) || cantidad_citas < 0 || cantidad_citas > CITAS_MAX) {
      return badRequest(`${ref}: las citas deben ser un número entero mayor o igual que cero`);
    }
    guardar.push({ documento, cantidad_citas, programa: programa.valor });
  }

  // Toda cédula que se guarda debe existir en el catálogo; de ahí sale el nombre.
  // Las eliminaciones no se verifican: permiten limpiar citas de profesionales
  // que ya no están en el catálogo.
  const nombres = new Map<string, string>();
  if (guardar.length > 0) {
    const medicos = await query<{ documento: string; nombre: string }>(
      `SELECT identificacion::text AS documento, nombre
       FROM medicos
       WHERE identificacion = ANY($1::bigint[])`,
      [guardar.map((g) => g.documento)]
    );
    medicos.forEach((m) => nombres.set(m.documento, m.nombre));

    const desconocidas = guardar.filter((g) => !nombres.has(g.documento)).map((g) => g.documento);
    if (desconocidas.length > 0) {
      return badRequest(
        `Cédulas que no existen en el catálogo de profesionales: ${desconocidas.join(", ")}`
      );
    }
  }

  let eliminadas = 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (eliminar.length > 0) {
      const res = await client.query(
        `DELETE FROM citas_atendidas
         WHERE periodo = $1 AND documento = ANY($2::bigint[])`,
        [periodo, eliminar]
      );
      eliminadas = res.rowCount ?? 0;
    }

    if (guardar.length > 0) {
      const values: unknown[] = [];
      const tuplas = guardar.map((g) => {
        const base = values.length;
        values.push(g.documento, periodo, g.cantidad_citas, g.programa, nombres.get(g.documento));
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
      });
      await client.query(
        `INSERT INTO citas_atendidas (documento, periodo, cantidad_citas, programa, nombre_medico)
         VALUES ${tuplas.join(", ")}
         ON CONFLICT (documento, periodo) DO UPDATE SET
           cantidad_citas = EXCLUDED.cantidad_citas,
           programa = EXCLUDED.programa,
           nombre_medico = EXCLUDED.nombre_medico`,
        values
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // El cumplimiento se calcula con las citas: no debe servirse desde el caché
  clearCache();

  return NextResponse.json({ guardadas: guardar.length, eliminadas });
}
