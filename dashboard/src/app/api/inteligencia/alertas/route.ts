import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/middleware-roles";
import { PERMISOS_API } from "@/lib/acceso";
import { GRANULARIDADES, type Granularidad } from "@/lib/productividad/periodos";
import { errorConsulta, obtenerAlertas } from "@/lib/inteligencia/datosAlertas";

/**
 * Alertas activas del último periodo cargado de la granularidad y proyección
 * del siguiente periodo. ?granularidad=mensual|semanal (por defecto mensual).
 */
export async function GET(request: Request) {
  const { error } = await requirePermiso(PERMISOS_API["/api/inteligencia/alertas"].GET);
  if (error) return error;

  const params = new URL(request.url).searchParams;
  const valores = params.getAll("granularidad");
  if (valores.length > 1) return NextResponse.json({ error: "El parámetro granularidad está repetido" }, { status: 400 });
  const granularidad = (valores[0]?.trim() || "mensual") as Granularidad;
  if (!GRANULARIDADES.includes(granularidad)) {
    return NextResponse.json({ error: "La granularidad debe ser mensual o semanal" }, { status: 400 });
  }

  try {
    return NextResponse.json(await obtenerAlertas(granularidad));
  } catch (err) {
    return errorConsulta(err);
  }
}
