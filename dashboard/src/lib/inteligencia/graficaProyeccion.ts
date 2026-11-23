/**
 * Opción de ECharts de la proyección de un área: historia de % inasistencia,
 * tramo proyectado punteado, banda del rango (± EAM) y la meta como línea.
 * Función pura, se prueba sin canvas.
 */
import { FUENTE, REJILLA, ROJO_MALO, TINTA, TINTA_2, TINTA_3, fmtPct } from "@/lib/productividad/presentacion";
import type { ResultadoAlertas, SerieProyectada } from "./alertas";

/* eslint-disable @typescript-eslint/no-explicit-any -- los parámetros de los formatters de ECharts no tienen un tipo útil */

type Siguiente = NonNullable<ResultadoAlertas["siguiente"]>;

export function opcionesProyeccion(s: SerieProyectada, siguiente: Siguiente, meta: number, color: string) {
  const p = s.inasistencia;
  const n = s.historia.length;
  const ultimo = s.historia[n - 1]?.valor ?? null;
  const categorias = s.historia.map((h) => h.etiqueta);
  if (p) categorias.push(siguiente.etiqueta);

  const vacios = (k: number) => Array.from({ length: k }, () => null as number | null);
  const historia = [...s.historia.map((h) => h.valor), ...(p ? [null] : [])];

  const series: any[] = [
    {
      type: "line",
      name: "Inasistencia",
      data: historia,
      connectNulls: true,
      symbolSize: 5,
      lineStyle: { color, width: 2 },
      itemStyle: { color },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: ROJO_MALO, type: "dashed", width: 1 },
        label: { formatter: `Meta ${fmtPct(meta, 0)}`, color: ROJO_MALO, fontSize: 10, position: "insideEndTop" },
        data: [{ yAxis: meta }],
      },
    },
  ];

  if (p) {
    const desde = ultimo ?? p.valor;
    series.push(
      {
        type: "line",
        name: "Rango base",
        stack: "rango",
        data: [...vacios(n - 1), desde, p.min],
        symbol: "none",
        lineStyle: { opacity: 0 },
        tooltip: { show: false },
      },
      {
        type: "line",
        name: "Rango",
        stack: "rango",
        data: [...vacios(n - 1), 0, p.max - p.min],
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { color, opacity: 0.15 },
        tooltip: { show: false },
      },
      {
        type: "line",
        name: "Proyección",
        data: [...vacios(n - 1), desde, p.valor],
        symbolSize: 6,
        lineStyle: { color, width: 2, type: "dashed" },
        itemStyle: { color, borderColor: "#fff", borderWidth: 1 },
      }
    );
  }

  return {
    textStyle: { fontFamily: FUENTE, color: TINTA_2 },
    animationDuration: 300,
    grid: { left: 40, right: 12, top: 12, bottom: 24 },
    tooltip: {
      trigger: "axis",
      backgroundColor: TINTA,
      borderWidth: 0,
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (items: any[]) => {
        const i = items[0]?.dataIndex ?? 0;
        if (p && i === n) {
          return `<b>${siguiente.etiqueta_larga} (proyección)</b><br>${fmtPct(p.valor)} · rango ${fmtPct(p.min)}–${fmtPct(p.max)}`;
        }
        const h = s.historia[i];
        return h ? `<b>${h.etiqueta}</b><br>${h.valor === null ? "Sin citas asignadas" : fmtPct(h.valor)}` : "";
      },
    },
    xAxis: {
      type: "category",
      data: categorias,
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: REJILLA } },
      axisLabel: { color: TINTA_3, fontSize: 10 },
    },
    yAxis: {
      type: "value",
      min: 0,
      axisLabel: { color: TINTA_3, fontSize: 10, formatter: (v: number) => fmtPct(v, 0) },
      splitLine: { lineStyle: { color: REJILLA } },
    },
    series,
  };
}
