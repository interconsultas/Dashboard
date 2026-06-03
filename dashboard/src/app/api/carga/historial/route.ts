import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware-roles";
import { query } from "@/lib/db";
import { LogCarga } from "@/types/carga";

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

  return NextResponse.json(rows);
}
