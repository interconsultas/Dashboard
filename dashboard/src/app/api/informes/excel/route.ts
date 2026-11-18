import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/middleware-roles";
import { obtenerPermisos } from "@/lib/permisos";
import { PERMISOS_API, cumpleRequisito } from "@/lib/acceso";
import { leerDocumento, validarParametros } from "@/lib/productividad/filtros";
import { consultarFicha, consultarProductividad, leerAreas } from "@/lib/productividad/consultas";
import { obtenerAlertas } from "@/lib/inteligencia/datosAlertas";
import { informeFicha, informeMensual, informeVista } from "@/lib/informes/construir";
import { construirLibro } from "@/lib/informes/excel";
import { TIPOS_INFORME, type ModeloInforme, type TipoInforme } from "@/lib/informes/modelo";

const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

let logo: Promise<Buffer | null> | null = null;

/** Logo de public/ (en Docker se copia junto al standalone); sin logo el libro se genera igual. */
function leerLogo(): Promise<Buffer | null> {
  logo ??= readFile(path.join(process.cwd(), "public", "logo.png")).catch(() => null);
  return logo;
}

const errorParametros = (error: string) => NextResponse.json({ error }, { status: 400 });

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

  const params = new URL(request.url).searchParams;
  const tipos = params.getAll("tipo");
  if (tipos.length > 1) return errorParametros("El parámetro tipo está repetido");
  const tipo = (tipos[0]?.trim() ?? "") as TipoInforme;
  if (!TIPOS_INFORME.includes(tipo)) return errorParametros("El tipo de informe debe ser vista, mensual o ficha");

  let documento: string | null = null;
  if (tipo === "ficha") {
    const d = leerDocumento(params);
    if ("error" in d) return errorParametros(d.error);
    documento = d.documento;
  }

  try {
    const areas = await leerAreas();
    const validacion = validarParametros(params, areas);
    if ("error" in validacion) return errorParametros(validacion.error);
    const { filtros } = validacion;
    const ahora = new Date();

    let modelo: ModeloInforme;
    if (tipo === "vista") {
      modelo = informeVista(await consultarProductividad(filtros, areas), filtros, ahora);
    } else if (tipo === "mensual") {
      const mensual = {
        granularidad: "mensual" as const,
        periodo: filtros.granularidad === "mensual" ? filtros.periodo : null,
        area: null,
        servicio: null,
        profesional: null,
      };
      const veInteligencia =
        user !== null && cumpleRequisito(await obtenerPermisos(user.rol), PERMISOS_API["/api/inteligencia/alertas"].GET);
      const [datos, alertas] = await Promise.all([
        consultarProductividad(mensual, areas),
        veInteligencia ? obtenerAlertas("mensual") : Promise.resolve(null),
      ]);
      modelo = informeMensual(datos, alertas, ahora);
    } else {
      const ficha = await consultarFicha(documento!, filtros);
      if (ficha === null) {
        return NextResponse.json({ error: "El profesional no tiene agenda en los periodos cargados" }, { status: 404 });
      }
      modelo = informeFicha(ficha, ahora);
    }

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
