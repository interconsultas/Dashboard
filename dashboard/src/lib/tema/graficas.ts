/**
 * Tema único de ECharts ("interconsultas"): tipografía, tintas, ejes, rejilla,
 * tooltip y paleta categórica salen de los tokens de diseño. Se registra una
 * sola vez en lib/echarts.ts y lo aplica GraficoCliente a toda gráfica.
 *
 * Las opciones de cada gráfica (lib/productividad/graficas, lib/inteligencia/*)
 * solo fijan colores con significado: la línea de meta, estados, la serie
 * seleccionada… El resto lo hereda de aquí.
 */
import { COLORES, FUENTE_TEXTO, PALETA_CATEGORICA } from "./tokens";

export const NOMBRE_TEMA = "interconsultas";

const eje = {
  axisLine: { show: true, lineStyle: { color: COLORES.borde } },
  axisTick: { show: false },
  axisLabel: { color: COLORES["tinta-3"] },
  splitLine: { show: true, lineStyle: { color: COLORES.borde } },
  splitArea: { show: false },
  nameTextStyle: { color: COLORES["tinta-3"] },
};

/** Caja oscura del tooltip, compartida por el tema y por las opciones que la amplían. */
export const TOOLTIP_TEMA = {
  backgroundColor: COLORES.tinta,
  borderWidth: 0,
  padding: [8, 12],
  textStyle: { color: "#FFFFFF", fontSize: 12.5, fontFamily: FUENTE_TEXTO },
  extraCssText: "border-radius:12px;box-shadow:0 10px 30px -12px rgba(19,35,58,.45);",
};

export const TEMA_GRAFICAS = {
  color: [...PALETA_CATEGORICA],
  backgroundColor: "transparent",
  textStyle: { fontFamily: FUENTE_TEXTO, color: COLORES["tinta-2"] },
  title: {
    textStyle: { color: COLORES.tinta, fontFamily: FUENTE_TEXTO, fontWeight: 700 },
    subtextStyle: { color: COLORES["tinta-3"] },
  },
  legend: { textStyle: { color: COLORES["tinta-2"] }, icon: "roundRect" },
  tooltip: TOOLTIP_TEMA,
  // La rejilla horizontal se ve; la del eje de categorías, no
  categoryAxis: { ...eje, splitLine: { show: false } },
  valueAxis: { ...eje, axisLine: { show: false } },
  logAxis: { ...eje, axisLine: { show: false } },
  timeAxis: { ...eje, splitLine: { show: false } },
  line: { symbol: "circle", symbolSize: 7, lineStyle: { width: 2 }, smooth: false },
  bar: { itemStyle: { barBorderRadius: [4, 4, 0, 0] } },
  graph: { color: [...PALETA_CATEGORICA], lineStyle: { color: COLORES.referencia } },
  markLine: { lineStyle: { color: COLORES.referencia } },
  dataZoom: {
    borderColor: COLORES.borde,
    fillerColor: "rgba(42,82,153,.12)",
    handleStyle: { color: COLORES.superficie, borderColor: COLORES.primario },
    textStyle: { color: COLORES["tinta-3"] },
  },
  visualMap: { textStyle: { color: COLORES["tinta-3"] } },
} as const;
