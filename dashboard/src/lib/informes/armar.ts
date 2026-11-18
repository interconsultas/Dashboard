/**
 * Arma el modelo de un informe a partir de los parámetros de la URL: lo
 * comparten la ruta del Excel y la del PDF (/api/informes/datos), con la
 * misma validación y los mismos permisos (prioridades y proyección del
 * mensual solo si el usuario ve Inteligencia).
 */
import { obtenerPermisos } from "@/lib/permisos";
import { PERMISOS_API, cumpleRequisito, type Rol } from "@/lib/acceso";
import { leerDocumento, validarParametros } from "@/lib/productividad/filtros";
import { consultarFicha, consultarProductividad, leerAreas } from "@/lib/productividad/consultas";
import { obtenerAlertas } from "@/lib/inteligencia/datosAlertas";
import { informeFicha, informeMensual, informeVista } from "./construir";
import { datosGraficasFicha, datosGraficasMensual, datosGraficasVista, type DatosGraficas } from "./graficas";
import { TIPOS_INFORME, type ModeloInforme, type TipoInforme } from "./modelo";

export type ResultadoInforme =
  | { error: string; status: 400 | 404 }
  | { modelo: ModeloInforme; graficas: DatosGraficas };

const invalido = (error: string): ResultadoInforme => ({ error, status: 400 });

/**
 * ?tipo=vista|mensual|ficha más los filtros de /api/productividad (la ficha
 * además `documento`). El mensual va siempre en mensual y sin filtros de
 * área, servicio ni profesional. Las fallas de consulta se propagan.
 */
export async function armarInforme(params: URLSearchParams, user: { rol: Rol } | null): Promise<ResultadoInforme> {
  const tipos = params.getAll("tipo");
  if (tipos.length > 1) return invalido("El parámetro tipo está repetido");
  const tipo = (tipos[0]?.trim() ?? "") as TipoInforme;
  if (!TIPOS_INFORME.includes(tipo)) return invalido("El tipo de informe debe ser vista, mensual o ficha");

  let documento: string | null = null;
  if (tipo === "ficha") {
    const d = leerDocumento(params);
    if ("error" in d) return invalido(d.error);
    documento = d.documento;
  }

  const areas = await leerAreas();
  const validacion = validarParametros(params, areas);
  if ("error" in validacion) return invalido(validacion.error);
  const { filtros } = validacion;
  const ahora = new Date();

  if (tipo === "vista") {
    const datos = await consultarProductividad(filtros, areas);
    return { modelo: informeVista(datos, filtros, ahora), graficas: datosGraficasVista(datos) };
  }

  if (tipo === "mensual") {
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
    return { modelo: informeMensual(datos, alertas, ahora), graficas: datosGraficasMensual(datos) };
  }

  const ficha = await consultarFicha(documento!, filtros);
  if (ficha === null) return { error: "El profesional no tiene agenda en los periodos cargados", status: 404 };
  return { modelo: informeFicha(ficha, ahora), graficas: datosGraficasFicha(ficha) };
}
