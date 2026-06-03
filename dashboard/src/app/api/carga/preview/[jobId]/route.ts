import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware-roles";
import { query, queryOne } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const { jobId } = params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    return NextResponse.json({ error: "jobId inválido" }, { status: 400 });
  }

  // Datos base del log
  const log = await queryOne<{
    job_id: string;
    nombre_archivo: string;
    periodo_detectado: number | null;
    filas_en_archivo: number;
    filas_insertadas: number;
    fechas_invalidas: number;
    valores_invalidos: number;
    medicos_no_encontrados: { total: number; nombres?: string[]; cedulas?: string[] };
    distribucion_estados: Record<string, number> | null;
    suma_valor_autorizado: number | null;
  }>(
    `SELECT job_id, nombre_archivo, periodo_detectado,
            filas_en_archivo, filas_insertadas, fechas_invalidas, valores_invalidos,
            medicos_no_encontrados, distribucion_estados, suma_valor_autorizado
     FROM log_cargas WHERE job_id = $1`,
    [jobId]
  );

  if (!log) return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });

  // Total real de filas (sumar distribución si filas_en_archivo = 0)
  const totalDist = log.distribucion_estados
    ? Object.values(log.distribucion_estados).reduce((a, b) => a + b, 0)
    : 0;
  const totalFilas = log.filas_en_archivo > 0 ? log.filas_en_archivo : (log.filas_insertadas || totalDist);

  // Distribucion como porcentajes
  let distribucionPct: { estado: string; conteo: number; pct: number }[] = [];
  if (log.distribucion_estados) {
    const total = Object.values(log.distribucion_estados).reduce((a, b) => a + b, 0);
    distribucionPct = Object.entries(log.distribucion_estados)
      .map(([estado, conteo]) => ({
        estado,
        conteo,
        pct: total > 0 ? Math.round((conteo / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.conteo - a.conteo);
  }

  // Suma valor autorizado desde staging si no está en log
  let sumaValor = log.suma_valor_autorizado;
  if (!sumaValor) {
    const sv = await queryOne<{ suma: number }>(
      `SELECT SUM(valor_autorizado_prestacion::numeric) AS suma
       FROM staging_autorizaciones WHERE job_id = $1`,
      [jobId]
    );
    sumaValor = sv?.suma ?? null;
  }

  // Muestra de primeras 5 filas desde staging
  const muestra = await query<Record<string, unknown>>(
    `SELECT
       usuario_txt, nombre_medico, programa_especialidad,
       numero_documento, primer_nombre, primer_apellido,
       tipo_prestacion_desc, descripcion_prestacion,
       codigo_diagnostico, estado_autorizacion_desc,
       cantidad_autorizada, valor_autorizado_prestacion,
       fecha_emision
     FROM staging_autorizaciones
     WHERE job_id = $1
     ORDER BY id
     LIMIT 5`,
    [jobId]
  );

  return NextResponse.json({
    job_id: jobId,
    nombre_archivo: log.nombre_archivo,
    periodo_detectado: log.periodo_detectado,
    total_filas: totalFilas,
    filas_validas: log.filas_insertadas,
    filas_con_error: Math.max(0, totalFilas - log.filas_insertadas),
    fechas_invalidas: log.fechas_invalidas,
    medicos_no_encontrados: log.medicos_no_encontrados,
    distribucion: distribucionPct,
    suma_valor_autorizado: sumaValor,
    promedio_valor: sumaValor && log.filas_insertadas > 0
      ? sumaValor / log.filas_insertadas
      : null,
    muestra_filas: muestra,
  });
}
