/**
 * Gráficas de los informes en PDF.
 *
 * El servidor manda los datos crudos de cada gráfica (`DatosGraficas`, JSON)
 * junto al modelo; el navegador arma las opciones con los mismos
 * constructores del tablero (lib/productividad/graficas) y las convierte en
 * imagen: la gráfica que ya está en pantalla se captura tal cual y la que no,
 * se dibuja fuera de pantalla. Módulo puro.
 */
import { opcionesEmbudo, opcionesServiciosFicha, opcionesTendenciaFicha } from "@/lib/productividad/graficas";
import type {
  Embudo,
  NodoServicio,
  PuntoSerie,
  RespuestaFichaProfesional,
  RespuestaProductividad,
} from "@/lib/productividad/tipos";

export type DatosGraficas =
  | { tipo: "vista"; tendencia: PuntoSerie[]; seleccionado: string | null; embudo: Embudo | null }
  | { tipo: "mensual"; tendencia: PuntoSerie[]; seleccionado: string | null }
  | { tipo: "ficha"; tendencia: PuntoSerie[]; seleccionado: string | null; servicios: NodoServicio[] };

export const datosGraficasVista = (d: RespuestaProductividad): DatosGraficas => ({
  tipo: "vista",
  tendencia: d.tendencia,
  seleccionado: d.periodo,
  embudo: d.embudo,
});

export const datosGraficasMensual = (d: RespuestaProductividad): DatosGraficas => ({
  tipo: "mensual",
  tendencia: d.kpis.serie,
  seleccionado: d.periodo,
});

export const datosGraficasFicha = (f: RespuestaFichaProfesional): DatosGraficas => ({
  tipo: "ficha",
  tendencia: f.tendencia,
  seleccionado: f.periodo,
  servicios: f.servicios,
});

export interface GraficaPdf {
  /** Sección del documento donde va. */
  id: "tendencia" | "embudo" | "servicios";
  titulo: string;
  /** Etiqueta (aria-label) de la misma gráfica en pantalla, si la hay: se captura de ahí. */
  enPantalla: string | null;
  /** Opción de ECharts para dibujarla fuera de pantalla. */
  opcion: object;
  /** Tamaño del lienzo fuera de pantalla, en px CSS. */
  ancho: number;
  alto: number;
}

const sinAnimacion = (o: object) => ({ ...o, animation: false });

/** Lienzo de la tendencia: la del mensual ocupa todo el ancho de la portada y es más apaisada. */
const LIENZO_TENDENCIA = { normal: { ancho: 900, alto: 300 }, ancha: { ancho: 1300, alto: 280 } };

function tendencia(
  serie: PuntoSerie[],
  seleccionado: string | null,
  enPantalla: string | null,
  lienzo = LIENZO_TENDENCIA.normal
): GraficaPdf[] {
  if (serie.length === 0) return [];
  return [
    {
      id: "tendencia",
      titulo: "Inasistencia por periodo",
      enPantalla,
      opcion: sinAnimacion(opcionesTendenciaFicha(serie, seleccionado)),
      ...lienzo,
    },
  ];
}

/** Gráficas de cada informe, en el orden en que aparecen. */
export function graficasPdf(d: DatosGraficas): GraficaPdf[] {
  if (d.tipo === "mensual") return tendencia(d.tendencia, d.seleccionado, null, LIENZO_TENDENCIA.ancha);

  if (d.tipo === "vista") {
    const graficas = tendencia(d.tendencia, d.seleccionado, "Tendencia del % de inasistencia");
    if (d.embudo && d.embudo.ofertadas > 0) {
      graficas.push({
        id: "embudo",
        titulo: "Embudo de la agenda",
        enPantalla: "Embudo de la agenda",
        opcion: sinAnimacion(opcionesEmbudo(d.embudo)),
        ancho: 560,
        alto: 300,
      });
    }
    return graficas;
  }

  const graficas: GraficaPdf[] = [];
  if (d.servicios.length > 0) {
    graficas.push({
      id: "servicios",
      titulo: "Servicios que atiende",
      enPantalla: "Servicios del profesional",
      opcion: sinAnimacion(opcionesServiciosFicha(d.servicios)),
      ancho: 640,
      alto: Math.max(160, d.servicios.length * 38 + 50),
    });
  }
  return [...graficas, ...tendencia(d.tendencia, d.seleccionado, "Tendencia de inasistencia del profesional")];
}
