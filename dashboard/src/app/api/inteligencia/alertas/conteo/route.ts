import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/middleware-roles";
import { PERMISOS_API } from "@/lib/acceso";
import { obtenerAlertas } from "@/lib/inteligencia/datosAlertas";

/** Total de alertas activas del último mes cargado (insignia del menú; usa el mismo caché). */
export async function GET() {
  const { error } = await requirePermiso(PERMISOS_API["/api/inteligencia/alertas/conteo"].GET);
  if (error) return error;
  try {
    const r = await obtenerAlertas("mensual");
    return NextResponse.json({ total: r.total, granularidad: r.granularidad, periodo: r.periodo?.clave ?? null });
  } catch (err) {
    console.error("[inteligencia/alertas/conteo] Query failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Error al consultar los datos" }, { status: 500 });
  }
}
