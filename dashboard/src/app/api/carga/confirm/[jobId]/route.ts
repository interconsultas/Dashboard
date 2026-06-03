import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware-roles";
import { queryOne } from "@/lib/db";
import { spawnEtl } from "@/lib/etl-spawn";

export async function POST(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const { jobId } = params;

  // Validar formato UUID (mitigación de Path Traversal)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(jobId)) {
    return NextResponse.json({ error: "jobId inválido" }, { status: 400 });
  }

  // Verificar que el job existe y está en estado correcto
  const job = await queryOne<{ estado: string }>(
    "SELECT estado FROM log_cargas WHERE job_id = $1",
    [jobId]
  );

  if (!job) return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
  if (job.estado !== "esperando_confirmacion") {
    return NextResponse.json(
      { error: `El job está en estado '${job.estado}', no se puede confirmar` },
      { status: 409 }
    );
  }

  // Reutiliza el mismo log file que el preview — append.
  spawnEtl(["--confirm", jobId], jobId);

  return NextResponse.json({ mensaje: "Confirmación en proceso" }, { status: 202 });
}
