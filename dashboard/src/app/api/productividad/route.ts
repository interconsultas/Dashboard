import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/middleware-roles";
import { PERMISOS_API } from "@/lib/acceso";
import { validarParametros } from "@/lib/productividad/filtros";
import { consultarProductividad, leerAreas } from "@/lib/productividad/consultas";

/* ── Handler ─────────────────────────────────── */

export async function GET(request: Request) {
  // Paso 4 de la fase 2 refina el acceso por rol (coordinador por regional).
  const { error } = await requirePermiso(PERMISOS_API["/api/productividad"].GET);
  if (error) return error;

  try {
    const areas = await leerAreas();
    const validacion = validarParametros(new URL(request.url).searchParams, areas);
    if ("error" in validacion) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }
    return NextResponse.json(await consultarProductividad(validacion.filtros, areas));
  } catch (err) {
    console.error("[productividad] Query failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Error al consultar los datos" }, { status: 500 });
  }
}
