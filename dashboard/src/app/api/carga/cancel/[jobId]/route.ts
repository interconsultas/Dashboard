import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware-roles";
import { queryOne, query } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const { jobId } = params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    return NextResponse.json({ error: "jobId inválido" }, { status: 400 });
  }

  const job = await queryOne<{ estado: string }>(
    "SELECT estado FROM log_cargas WHERE job_id = $1",
    [jobId]
  );

  if (!job) return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });

  // Limpiar staging y marcar cancelado
  await query("DELETE FROM staging_autorizaciones WHERE job_id = $1", [jobId]);
  await query(
    "UPDATE log_cargas SET estado = 'cancelado' WHERE job_id = $1",
    [jobId]
  );

  return NextResponse.json({ mensaje: "Carga cancelada" });
}
