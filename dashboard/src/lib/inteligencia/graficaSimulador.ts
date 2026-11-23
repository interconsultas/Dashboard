/**
 * Opción de ECharts del simulador: Actual vs Escenario en barras
 * horizontales (un solo eje de valores). Función pura, se prueba sin canvas.
 */
import { AZUL_SERIE, FUENTE, REJILLA, TINTA, TINTA_2, TINTA_3, fmtNumero } from "@/lib/productividad/presentacion";
import type { Diferencia, MetricaComparada } from "./simulador";

/* eslint-disable @typescript-eslint/no-explicit-any -- los parámetros de los formatters de ECharts no tienen un tipo útil */

export const METRICAS_GRAFICA: { clave: Exclude<MetricaComparada, "perdidas">; etiqueta: string }[] = [
  { clave: "ofertadas", etiqueta: "Ofertadas" },
  { clave: "asignadas", etiqueta: "Asignadas" },
  { clave: "atendidas", etiqueta: "Atendidas" },
  { clave: "inasistidas", etiqueta: "Inasistidas" },
  { clave: "disponibles", etiqueta: "Disponibles" },
];

/** Gris neutro para la realidad; el azul de la serie para el escenario. */
export const COLOR_ACTUAL = "#9AA7B8";
export const COLOR_ESCENARIO = AZUL_SERIE;

const fmtDelta = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtNumero(Math.abs(v))}`;

export function opcionesComparacion(comparacion: Record<MetricaComparada, Diferencia>) {
  const filas = METRICAS_GRAFICA.map((m) => ({ ...m, ...comparacion[m.clave] }));
  const serie = (name: string, color: string, valor: (f: (typeof filas)[number]) => number) => ({
    type: "bar",
    name,
    data: filas.map(valor),
    barMaxWidth: 16,
    barGap: "15%",
    itemStyle: { color, borderRadius: [0, 4, 4, 0] },
    label: { show: true, position: "right", color: TINTA_2, fontSize: 11, formatter: (p: any) => fmtNumero(p.value) },
  });
  return {
    textStyle: { fontFamily: FUENTE, color: TINTA_2 },
    animationDuration: 300,
    grid: { left: 88, right: 56, top: 32, bottom: 8 },
    legend: { data: ["Actual", "Escenario"], top: 0, left: 0, icon: "roundRect", itemWidth: 12, itemHeight: 8, textStyle: { color: TINTA_2 } },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: TINTA,
      borderWidth: 0,
      textStyle: { color: "#fff", fontSize: 12.5 },
      extraCssText: "border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);",
      formatter: (p: any) => {
        const f = filas[p[0].dataIndex];
        return `<b>${f.etiqueta}</b><br>Actual: <b>${fmtNumero(f.base)}</b><br>Escenario: <b>${fmtNumero(f.escenario)}</b><br>Diferencia: <b>${fmtDelta(f.delta)}</b>`;
      },
    },
    xAxis: {
      type: "value",
      min: 0,
      axisLabel: { color: TINTA_3, formatter: (v: number) => fmtNumero(v) },
      splitLine: { lineStyle: { color: REJILLA } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: filas.map((f) => f.etiqueta),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: REJILLA } },
      axisLabel: { color: TINTA_2 },
    },
    series: [serie("Actual", COLOR_ACTUAL, (f) => f.base), serie("Escenario", COLOR_ESCENARIO, (f) => f.escenario)],
  };
}
