import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/middleware-roles";
import { PERMISOS_API } from "@/lib/acceso";
import { armarInforme } from "@/lib/informes/armar";

/**
 * Modelo del informe y datos de sus gráficas, en JSON, para armar el PDF en
 * el navegador. Mismos parámetros, validación y permisos que el Excel.
 */
export async function GET(request: Request) {
  const { error, user } = await requirePermiso(PERMISOS_API["/api/informes/datos"].GET);
  if (error) return error;

  try {
    const r = await armarInforme(new URL(request.url).searchParams, user);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[informes/datos] Failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Error al generar el informe" }, { status: 500 });
  }
}
