import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware-roles";
import { queryOne, query } from "@/lib/db";
import { spawnEtl } from "@/lib/etl-spawn";

const ESTADOS_ELIMINABLES = ["exitoso", "exitoso_con_advertencias"];

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const { jobId } = params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(jobId)) {
    return NextResponse.json({ error: "jobId inválido" }, { status: 400 });
  }

  const job = await queryOne<{ estado: string; periodo_detectado: number | null }>(
    "SELECT estado, periodo_detectado FROM log_cargas WHERE job_id = $1",
    [jobId]
  );

  if (!job) return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });

  if (!ESTADOS_ELIMINABLES.includes(job.estado)) {
    return NextResponse.json(
      { error: `El job está en estado '${job.estado}', no se puede eliminar` },
      { status: 409 }
    );
  }

  if (job.periodo_detectado === null) {
    return NextResponse.json(
      { error: "El job no tiene periodo detectado, no se puede eliminar de forma segura" },
      { status: 409 }
    );
  }

  // Marca atómica: si otro request ya movió el estado (doble click), esto
  // no afecta filas y evitamos spawnear el ETL dos veces para el mismo job.
  const actualizado = await query<{ job_id: string }>(
    `UPDATE log_cargas SET estado = 'eliminando'
     WHERE job_id = $1 AND estado IN ('exitoso', 'exitoso_con_advertencias')
     RETURNING job_id`,
    [jobId]
  );

  if (actualizado.length === 0) {
    return NextResponse.json(
      { error: "El job cambió de estado, no se puede eliminar" },
      { status: 409 }
    );
  }

  spawnEtl(["--delete", jobId], jobId);

  return NextResponse.json({ mensaje: "Eliminación en proceso" }, { status: 202 });
}
