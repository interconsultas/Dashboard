import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { parsePeriodo } from "@/lib/cumplimiento/periodo";
import { agruparDetalle, type DetalleCitas, type FilaServicioDb } from "@/lib/citas/detalle";

/**
 * Todas las citas del informe de Agenda Web de un mes, por profesional y servicio.
 * Solo usa las cargas mensuales: las semanales del mismo mes duplicarían las cifras.
 * Las sumas de plan agrupador y tiempo de servicio se acumulan por servicio.
 */
export async function GET(request: Request) {
  const { error } = await requireAuth(["admin", "direccion_medica"]);
  if (error) return error;

  const periodo = parsePeriodo(new URL(request.url).searchParams.get("periodo"));
  if (periodo === null) {
    return NextResponse.json({ error: "El periodo debe tener el formato AAAAMM" }, { status: 400 });
  }

  const [filas, periodos] = await Promise.all([
    query<FilaServicioDb>(
      `SELECT c.tipo_documento, c.documento::text AS documento,
              MAX(c.nombre_profesional) AS nombre,
              c.codigo_servicio, COALESCE(MAX(s.nombre_servicio), c.codigo_servicio) AS nombre_servicio,
              SUM(c.creadas)::int AS creadas,
              SUM(c.bloqueadas)::int AS bloqueadas,
              SUM(c.ofertadas)::int AS ofertadas,
              SUM(c.disponibles)::int AS disponibles,
              SUM(c.asignadas)::int AS asignadas,
              SUM(c.confirmadas)::int AS confirmadas,
              SUM(c.confirmadas_sin_atencion)::int AS confirmadas_sin_atencion,
              SUM(c.inasistidas)::int AS inasistidas,
              SUM(c.canceladas)::int AS canceladas,
              SUM(c.pendientes_por_asistir)::int AS pendientes_por_asistir
       FROM citas_profesional_servicio c
       LEFT JOIN servicios_citas s ON s.codigo_servicio = c.codigo_servicio
       WHERE c.granularidad = 'mensual' AND c.periodo = $1
       GROUP BY c.tipo_documento, c.documento, c.codigo_servicio
       ORDER BY nombre, c.documento, c.codigo_servicio`,
      [periodo]
    ),
    query<{ periodo: number }>(
      `SELECT DISTINCT periodo FROM citas_profesional_servicio
       WHERE granularidad = 'mensual'
       ORDER BY periodo DESC`
    ),
  ]);

  const body: DetalleCitas = {
    periodo,
    periodos: periodos.map((p) => Number(p.periodo)),
    ...agruparDetalle(filas),
  };
  return NextResponse.json(body);
}
