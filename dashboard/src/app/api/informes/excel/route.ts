import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/middleware-roles";
import { PERMISOS_API } from "@/lib/acceso";
import { armarInforme } from "@/lib/informes/armar";
import { construirLibro } from "@/lib/informes/excel";

const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

let logo: Promise<Buffer | null> | null = null;

/** Logo de public/ (en Docker se copia junto al standalone); sin logo el libro se genera igual. */
function leerLogo(): Promise<Buffer | null> {
  logo ??= readFile(path.join(process.cwd(), "public", "logo.png")).catch(() => null);
  return logo;
}

/**
 * Informe en Excel. ?tipo=vista|mensual|ficha más los filtros de
 * /api/productividad (la ficha además `documento`).
 * - vista: el tablero con los filtros activos.
 * - mensual: siempre mensual y sin filtros de área, servicio ni profesional;
 *   las prioridades y la proyección solo si el usuario ve Inteligencia.
 * - ficha: la ficha del profesional.
 */
export async function GET(request: Request) {
  const { error, user } = await requirePermiso(PERMISOS_API["/api/informes/excel"].GET);
  if (error) return error;

  try {
    const r = await armarInforme(new URL(request.url).searchParams, user);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    const { modelo } = r;

    const libro = await construirLibro(modelo, await leerLogo());
    return new NextResponse(new Uint8Array(libro), {
      status: 200,
      headers: {
        "Content-Type": TIPO_XLSX,
        "Content-Disposition": `attachment; filename="${modelo.archivo}.xlsx"`,
        "Content-Length": String(libro.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[informes/excel] Failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Error al generar el informe" }, { status: 500 });
  }
}
