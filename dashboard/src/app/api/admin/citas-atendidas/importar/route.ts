import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware-roles";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { runEtlCitasSync } from "@/lib/etl-run-sync";
import { clearCache } from "@/lib/cache";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB, el mismo límite que la importación de profesionales

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["admin"]);
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
  if (archivo.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `El archivo excede el límite de 20 MB (${(archivo.size / 1024 / 1024).toFixed(1)} MB)` },
      { status: 400 }
    );
  }

  const uploadsDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "..", "tmp_uploads");
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  const safeName = archivo.name.replace(/[^a-zA-Z0-9.\-_ ]/g, "_");
  const destPath = path.join(uploadsDir, `citas_${randomUUID()}_${safeName}`);
  const buffer = Buffer.from(await archivo.arrayBuffer());
  await writeFile(destPath, buffer);

  try {
    const resultado = await runEtlCitasSync(destPath);
    if (!resultado.success) {
      return NextResponse.json({ error: resultado.error }, { status: 500 });
    }
    // El cumplimiento se calcula con las citas: no debe servirse desde el caché
    clearCache();
    return NextResponse.json(resultado.resultado, { status: 200 });
  } finally {
    await unlink(destPath).catch(() => {});
  }
}
