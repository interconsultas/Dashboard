import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/middleware-roles";
import { PERMISOS_API } from "@/lib/acceso";
import { leerDocumento, validarParametros } from "@/lib/productividad/filtros";
import { consultarFicha, leerAreas } from "@/lib/productividad/consultas";

/* ── Handler ─────────────────────────────────── */

/**
 * Ficha individual de un profesional: totales y servicios del periodo,
 * tendencia en todas las cargas de la granularidad, institución y percentil.
 * Acepta los mismos filtros que /api/productividad más `documento`.
 */
export async function GET(request: Request) {
  const { error } = await requirePermiso(PERMISOS_API["/api/productividad/profesional"].GET);
  if (error) return error;

  const params = new URL(request.url).searchParams;
  const documento = leerDocumento(params);
  if ("error" in documento) return NextResponse.json({ error: documento.error }, { status: 400 });

  try {
    const validacion = validarParametros(params, await leerAreas());
    if ("error" in validacion) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const result = await consultarFicha(documento.documento, validacion.filtros);
    if (result === null) {
      return NextResponse.json({ error: "El profesional no tiene agenda en los periodos cargados" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[productividad/profesional] Query failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Error al consultar los datos" }, { status: 500 });
  }
}
