import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware-roles";
import { query } from "@/lib/db";
import { clearCache } from "@/lib/cache";
import { LogCarga } from "@/types/carga";

const ESTADOS_TERMINALES = new Set(["exitoso", "exitoso_con_advertencias", "eliminado"]);

// En memoria del proceso: jobs cuyo paso a estado terminal ya disparó
// clearCache(). Crece con la cantidad de cargas históricas del proceso,
// pero a esta escala (decenas por semana) el costo es despreciable.
const jobsNotificados = new Set<string>();

export async function GET() {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const rows = await query<LogCarga>(
    `SELECT id, job_id, nombre_archivo, periodo_detectado,
            filas_en_archivo, filas_insertadas, filas_duplicadas,
            estado, cargado_por, tiempo_segundos, cargado_en
     FROM log_cargas
     WHERE estado NOT IN ('cancelado')
     ORDER BY cargado_en DESC
     LIMIT 50`
  );

  for (const row of rows) {
    if (ESTADOS_TERMINALES.has(row.estado) && !jobsNotificados.has(row.job_id)) {
      jobsNotificados.add(row.job_id);
      clearCache();
    }
  }

  return NextResponse.json(rows);
}
