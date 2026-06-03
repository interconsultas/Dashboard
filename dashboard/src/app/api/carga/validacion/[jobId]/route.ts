import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware-roles";
import { queryOne } from "@/lib/db";
import { LogCarga } from "@/types/carga";

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

  const row = await queryOne<LogCarga>(
    `SELECT id, job_id, nombre_archivo, hash_archivo,
            periodo_detectado, filas_en_archivo, filas_validas,
            filas_insertadas, filas_duplicadas, filas_con_error,
            fechas_invalidas, valores_invalidos,
            medicos_no_encontrados, columnas_faltantes,
            distribucion_estados, suma_valor_autorizado,
            estado, error_mensaje, cargado_por,
            tiempo_segundos, cargado_en
     FROM log_cargas
     WHERE job_id = $1`,
    [jobId]
  );

  if (!row) {
    return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
  }

  return NextResponse.json(row);
}
