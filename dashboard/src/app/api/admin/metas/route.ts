import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { clearCache } from "@/lib/cache";
import { esCategoria, esProgramaMeta, escalaDe } from "@/lib/cumplimiento/categorias";
import { parseAnio } from "@/lib/cumplimiento/periodo";

// valor_meta es NUMERIC(12,6): admite hasta 6 dígitos enteros
const VALOR_META_MAX = 1_000_000;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function GET(request: Request) {
  const { error } = await requireAuth(["admin", "direccion_medica"]);
  if (error) return error;

  const anioParam = new URL(request.url).searchParams.get("anio");
  const anio = anioParam === null ? new Date().getFullYear() : parseAnio(anioParam);
  if (anio === null) {
    return badRequest("El año debe ser un número entero entre 2000 y 2100");
  }

  const [metas, anios] = await Promise.all([
    query<{
      programa: string;
      tipo_prestacion: string;
      valor_meta: number;
      escala: string;
    }>(
      `SELECT programa, tipo_prestacion, valor_meta::float8 AS valor_meta, escala
       FROM metas
       WHERE anio = $1 AND activo = TRUE
       ORDER BY programa, tipo_prestacion`,
      [anio]
    ),
    query<{ anio: number }>("SELECT DISTINCT anio FROM metas ORDER BY anio DESC"),
  ]);

  return NextResponse.json({ anio, anios: anios.map((a) => a.anio), metas });
}

export async function PUT(request: Request) {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return badRequest("El cuerpo de la solicitud no es válido");
  }

  const anio = typeof body.anio === "number" ? parseAnio(body.anio) : null;
  if (anio === null) {
    return badRequest("El año debe ser un número entero entre 2000 y 2100");
  }
  if (!Array.isArray(body.metas) || body.metas.length === 0) {
    return badRequest("Debe enviar al menos una meta");
  }

  // Se valida todo antes de escribir: si una meta es inválida no se guarda ninguna
  const values: unknown[] = [];
  const tuplas: string[] = [];
  const vistas = new Set<string>();

  for (let i = 0; i < body.metas.length; i++) {
    const meta = body.metas[i];
    const n = i + 1;
    if (!meta || typeof meta !== "object") {
      return badRequest(`Meta ${n}: formato no válido`);
    }
    const { programa, tipo_prestacion, valor_meta } = meta;
    if (!esProgramaMeta(programa)) {
      return badRequest(`Meta ${n}: programa no válido`);
    }
    if (!esCategoria(tipo_prestacion)) {
      return badRequest(`Meta ${n} (${programa}): categoría no válida`);
    }
    const ref = `Meta ${n} (${programa} / ${tipo_prestacion})`;
    if (typeof valor_meta !== "number" || !Number.isFinite(valor_meta) || valor_meta <= 0) {
      return badRequest(`${ref}: el valor debe ser un número mayor que cero`);
    }
    if (valor_meta >= VALOR_META_MAX) {
      return badRequest(`${ref}: el valor debe ser menor que ${VALOR_META_MAX}`);
    }
    const clave = `${programa}|${tipo_prestacion}`;
    if (vistas.has(clave)) {
      return badRequest(`${ref}: la meta está repetida`);
    }
    vistas.add(clave);

    // La escala siempre sale de CATEGORIAS, nunca del cliente
    const base = values.length;
    values.push(anio, programa, tipo_prestacion, valor_meta, escalaDe(tipo_prestacion));
    tuplas.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
  }

  // Un solo INSERT de varias filas: el guardado es atómico
  await query(
    `INSERT INTO metas (anio, programa, tipo_prestacion, valor_meta, escala)
     VALUES ${tuplas.join(", ")}
     ON CONFLICT (anio, programa, tipo_prestacion) DO UPDATE SET
       valor_meta = EXCLUDED.valor_meta,
       escala = EXCLUDED.escala,
       activo = TRUE,
       actualizado_en = NOW()`,
    values
  );

  // El cumplimiento se calcula con las metas: no debe servirse desde el caché
  clearCache();

  return NextResponse.json({ guardadas: tuplas.length });
}
