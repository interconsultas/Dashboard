import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware-roles";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { spawnEtl } from "@/lib/etl-spawn";

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["admin"]);
  if (error) return error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario" }, { status: 400 });
  }

  const archivo = formData.get("archivo") as File | null;
  if (!archivo) {
    return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
  }
  if (!archivo.name.endsWith(".xlsx")) {
    return NextResponse.json({ error: "Solo se aceptan archivos .xlsx" }, { status: 400 });
  }

  const MAX_FILE_SIZE = 250 * 1024 * 1024; // 250 MB
  if (archivo.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `El archivo excede el límite de 250 MB (${(archivo.size / 1024 / 1024).toFixed(1)} MB)` },
      { status: 400 }
    );
  }

  // Guardar en disco temporal
  const uploadsDir =
    process.env.UPLOADS_DIR ??
    path.join(process.cwd(), "..", "tmp_uploads");

  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  // Generar job_id antes de escribir el archivo para prefijar el nombre
  // y evitar colisiones cuando dos usuarios suben archivos con el mismo nombre.
  const jobId = randomUUID();
  const safeName = archivo.name.replace(/[^a-zA-Z0-9.\-_ ]/g, "_");
  const destPath = path.join(uploadsDir, `${jobId}_${safeName}`);
  const buffer = Buffer.from(await archivo.arrayBuffer());
  await writeFile(destPath, buffer);

  const usuario = user!.email;

  // Pre-registrar el job en log_cargas con estado 'procesando'
  // El ETL usará este mismo job_id al arrancar
  await query(
    `INSERT INTO log_cargas (job_id, nombre_archivo, estado, cargado_por)
     VALUES ($1, $2, 'procesando', $3)
     ON CONFLICT (job_id) DO NOTHING`,
    [jobId, archivo.name, usuario]
  );

  // Lanzar ETL en background con el job_id pre-asignado.
  // stdout/stderr se redirigen a logs/<jobId>.log para postmortem.
  spawnEtl(
    ["--preview", "--archivo", destPath, "--usuario", usuario, "--job-id", jobId],
    jobId
  );

  // Retornar inmediatamente — el frontend hace polling del estado
  return NextResponse.json(
    { job_id: jobId, mensaje: "Procesando en segundo plano" },
    { status: 202 }
  );
}
