import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";
import { PERMISOS_API } from "@/lib/acceso";
import type { AreasServicio, CambioArea, ServicioArea } from "@/lib/citas/areas";

// servicios_citas.codigo_servicio es VARCHAR(20)
const CODIGO_MAX = 20;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

async function nombresDeAreas(): Promise<string[]> {
  const filas = await query<{ nombre: string }>(
    "SELECT nombre FROM areas_servicio ORDER BY orden, nombre"
  );
  return filas.map((f) => f.nombre);
}

/**
 * Catálogo de servicios con su área. Las asignadas son las de la carga
 * mensual del último mes cargado, para orientar qué servicios pesan más.
 */
export async function GET() {
  const { error } = await requirePermiso(PERMISOS_API["/api/admin/citas/areas"].GET);
  if (error) return error;

  const [areas, ultimo] = await Promise.all([
    nombresDeAreas(),
    query<{ periodo: number | null }>(
      `SELECT MAX(periodo) AS periodo FROM citas_profesional_servicio
       WHERE granularidad = 'mensual'`
    ),
  ]);
  const periodo = ultimo[0]?.periodo == null ? null : Number(ultimo[0].periodo);

  const servicios = await query<ServicioArea>(
    `SELECT s.codigo_servicio, s.nombre_servicio, s.area,
            clasificar_area_servicio(s.nombre_servicio) AS area_regla,
            s.area_editada, s.ultimo_periodo,
            COALESCE(SUM(c.asignadas), 0)::int AS asignadas
     FROM servicios_citas s
     LEFT JOIN citas_profesional_servicio c
            ON c.codigo_servicio = s.codigo_servicio
           AND c.granularidad = 'mensual' AND c.periodo = $1
     GROUP BY s.codigo_servicio
     ORDER BY s.nombre_servicio, s.codigo_servicio`,
    [periodo]
  );

  const body: AreasServicio = { areas, periodo, servicios };
  return NextResponse.json(body);
}

/**
 * Cambia el área de uno o varios servicios. Un área marca el servicio como
 * editado (las cargas no lo reclasifican); area null lo restablece a la regla.
 */
export async function PUT(request: Request) {
  const { error } = await requirePermiso(PERMISOS_API["/api/admin/citas/areas"].PUT);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return badRequest("El cuerpo de la solicitud no es válido");
  }
  if (!Array.isArray(body.cambios) || body.cambios.length === 0) {
    return badRequest("Debe enviar al menos un servicio");
  }

  const areas = new Set(await nombresDeAreas());

  // Se valida todo antes de escribir: si una fila es inválida no se guarda ninguna
  const cambios: CambioArea[] = [];
  const vistos = new Set<string>();

  for (let i = 0; i < body.cambios.length; i++) {
    const fila = body.cambios[i];
    const n = i + 1;
    if (!fila || typeof fila !== "object") {
      return badRequest(`Fila ${n}: formato no válido`);
    }
    const codigo = typeof fila.codigo_servicio === "string" ? fila.codigo_servicio.trim() : "";
    if (codigo === "" || codigo.length > CODIGO_MAX) {
      return badRequest(`Fila ${n}: el código de servicio no es válido`);
    }
    const ref = `Fila ${n} (${codigo})`;
    if (vistos.has(codigo)) {
      return badRequest(`${ref}: el servicio está repetido`);
    }
    vistos.add(codigo);
    if (fila.area !== null && !(typeof fila.area === "string" && areas.has(fila.area))) {
      return badRequest(`${ref}: área no válida`);
    }
    cambios.push({ codigo_servicio: codigo, area: fila.area });
  }

  const codigos = cambios.map((c) => c.codigo_servicio);
  const existentes = new Set(
    (
      await query<{ codigo_servicio: string }>(
        "SELECT codigo_servicio FROM servicios_citas WHERE codigo_servicio = ANY($1)",
        [codigos]
      )
    ).map((f) => f.codigo_servicio)
  );
  const faltantes = codigos.filter((c) => !existentes.has(c));
  if (faltantes.length > 0) {
    return NextResponse.json(
      { error: `Servicios no encontrados: ${faltantes.join(", ")}` },
      { status: 404 }
    );
  }

  const values: unknown[] = [];
  const tuplas = cambios.map((c) => {
    const base = values.length;
    values.push(c.codigo_servicio, c.area);
    return `($${base + 1}::varchar, $${base + 2}::varchar)`;
  });

  // Un solo UPDATE: el guardado es atómico
  const actualizados = await query<{ codigo_servicio: string }>(
    `UPDATE servicios_citas s SET
       area = COALESCE(v.area, clasificar_area_servicio(s.nombre_servicio)),
       area_editada = v.area IS NOT NULL
     FROM (VALUES ${tuplas.join(", ")}) AS v (codigo_servicio, area)
     WHERE s.codigo_servicio = v.codigo_servicio
     RETURNING s.codigo_servicio`,
    values
  );

  return NextResponse.json({ actualizados: actualizados.length });
}
