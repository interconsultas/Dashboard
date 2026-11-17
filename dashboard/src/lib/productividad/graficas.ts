/**
 * Opciones de ECharts del tablero de productividad. Funciones puras: no
 * importan echarts (los degradados van como objetos planos), así que se
 * prueban sin canvas.
 */
import { META_INASISTENCIA } from "./metricas";
import {
  AZUL_SERIE,
  ESCALA_SECUENCIAL,
  FUENTE,
  NAVY,
  REJILLA,
  ROJO_MALO,
  TINTA,
  TINTA_2,
  TINTA_3,
  colorArea,
  fmtNumero,
  fmtPct,
} from "./presentacion";
import type { Embudo, NodoArea, PuntoSerie, RespuestaProductividad } from "./tipos";

/* eslint-disable @typescript-eslint/no-explicit-any -- los parámetros de los formatters de ECharts no tienen un tipo útil */

const META_PCT = META_INASISTENCIA * 100;

const textoBase = { fontFamily: FUENTE, color: TINTA_2 };

const cajaTooltip = {
  backgroundColor: TINTA,
  borderWidth: 0,
  textStyle: { color: "#fff", fontSize: 12.5 },
  extraCssText: "border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);",
};

function degradado(color: string, alfaArriba: string) {
  return {
    type: "linear",
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: `${color}${alfaArriba}` },
      { offset: 1, color: `${color}00` },
    ],
  };
}

const enPuntos = (v: number | null) => (v === null ? null : Number((v * 100).toFixed(2)));
const fmtPuntos = (v: number) => `${v.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;

/* ── Sparkline de los KPIs ──────────────────── */

export function opcionesSparkline(valores: (number | null)[], etiquetas: string[], fmt: (v: number) => string) {
  const ultimo = valores.length - 1;
  return {
    animation: false,
    grid: { left: 4, right: 4, top: 6, bottom: 2 },
    xAxis: { type: "category", show: false, data: etiquetas },
    yAxis: { type: "value", show: false, scale: true },
    tooltip: {
      trigger: "axis",
      ...cajaTooltip,
      formatter: (p: any) => `${p[0].name}: <b>${p[0].value === null || p[0].value === undefined ? "—" : fmt(p[0].value)}</b>`,
      axisPointer: { type: "line", lineStyle: { color: TINTA_3 } },
    },
    series: [
      {
        type: "line",
        data: valores,
        symbol: "none",
        lineStyle: { width: 2, color: AZUL_SERIE },
        areaStyle: { color: degradado(AZUL_SERIE, "33") },
        markPoint: {
          symbol: "circle",
          symbolSize: 7,
          itemStyle: { color: AZUL_SERIE, borderColor: "#fff", borderWidth: 2 },
          label: { show: false },
          data: ultimo >= 0 && valores[ultimo] !== null ? [{ coord: [ultimo, valores[ultimo]] }] : [],
        },
      },
    ],
  };
}

/* ── Tendencia ──────────────────────────────── */

export function opcionesTendencia(serie: PuntoSerie[], seleccionado: string | null) {
  const idx = serie.findIndex((p) => p.clave === seleccionado);
  const etiquetas = serie.map((p) => p.etiqueta);
  return {
    textStyle: textoBase,
    animationDuration: 400,
    grid: { left: 46, right: 24, top: 24, bottom: 58 },
    tooltip: {
      trigger: "axis",
      ...cajaTooltip,
      formatter: (p: any) => {
        const d = serie[p[0].dataIndex];
        return `<b>${d.etiqueta}</b><br>% inasistencia: <b>${fmtPct(d.pct_inasistencia)}</b><br>${fmtNumero(d.inasistidas)} inasistidas de ${fmtNumero(d.asignadas)} asignadas`;
      },
    },
    xAxis: {
      type: "category",
      data: etiquetas,
      axisLine: { lineStyle: { color: REJILLA } },
      axisTick: { show: false },
      axisLabel: { color: TINTA_3 },
    },
    yAxis: {
      type: "value",
      min: 0,
      axisLabel: { color: TINTA_3, formatter: (v: number) => `${v} %` },
      splitLine: { lineStyle: { color: REJILLA } },
    },
    dataZoom: [
      { type: "slider", height: 18, bottom: 6, borderColor: REJILLA, fillerColor: "rgba(42,120,214,.12)", handleSize: 14, textStyle: { color: TINTA_3 } },
      { type: "inside" },
    ],
    series: [
      {
        type: "line",
        data: serie.map((p) => enPuntos(p.pct_inasistencia)),
        symbol: "circle",
        symbolSize: (_v: unknown, p: any) => (p.dataIndex === idx ? 10 : 7),
        lineStyle: { width: 2, color: AZUL_SERIE },
        itemStyle: { color: AZUL_SERIE, borderColor: "#fff", borderWidth: 2 },
        areaStyle: { color: degradado(AZUL_SERIE, "2e") },
        label: {
          show: true,
          position: "top",
          color: TINTA,
          fontSize: 11,
          formatter: (p: any) => (p.dataIndex === idx && p.value !== null ? fmtPuntos(p.value) : ""),
        },
        markLine: {
          symbol: "none",
          silent: true,
          lineStyle: { type: "dashed", color: "#9AA7B8", width: 2 },
          label: { formatter: `Meta ${META_PCT} %`, color: TINTA_3, position: "insideEndTop" },
          data: [{ yAxis: META_PCT }],
        },
        markArea:
          idx >= 0
            ? { silent: true, itemStyle: { color: "rgba(42,120,214,.07)" }, data: [[{ xAxis: etiquetas[idx] }, { xAxis: etiquetas[idx] }]] }
            : undefined,
      },
    ],
  };
}

/* ── Embudo ─────────────────────────────────── */

export function opcionesEmbudo(e: Embudo) {
  const pasos: [string, number][] = [
    ["Ofertadas", e.ofertadas],
    ["Asignadas", e.asignadas],
    ["Atendidas", e.atendidas],
  ];
  const colores = ["#86b6ef", "#3987e5", "#1c5cab"];
  const pctDe = (v: number, base: number) => (base > 0 ? v / base : null);
  return {
    textStyle: textoBase,
    tooltip: {
      trigger: "item",
      ...cajaTooltip,
      formatter: (p: any) => `<b>${p.name}</b>: ${fmtNumero(p.value)}<br>${fmtPct(pctDe(p.value, e.ofertadas))} de lo ofertado`,
    },
    series: [
      {
        type: "funnel",
        left: "6%",
        right: "30%",
        top: 10,
        bottom: 10,
        sort: "none",
        gap: 3,
        minSize: "38%",
        label: { position: "inside", color: "#fff", fontWeight: 600, formatter: (p: any) => `${p.name}\n${fmtNumero(p.value)}` },
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        data: pasos.map(([name, value], i) => ({ name, value, itemStyle: { color: colores[i] } })),
      },
    ],
    graphic: [
      {
        type: "text",
        right: 6,
        top: "30%",
        style: {
          text: `− ${fmtNumero(e.disponibles)}\nno asignadas\n(${fmtPct(pctDe(e.disponibles, e.ofertadas))})`,
          fill: TINTA_2,
          font: `12px ${FUENTE}`,
          align: "right",
        },
      },
      {
        type: "text",
        right: 6,
        top: "63%",
        style: {
          text: `− ${fmtNumero(e.inasistidas)}\ninasistidas\n(${fmtPct(pctDe(e.inasistidas, e.asignadas))})`,
          fill: ROJO_MALO,
          font: `600 12px ${FUENTE}`,
          align: "right",
        },
      },
    ],
  };
}

/* ── Mapa de calor ──────────────────────────── */

export function opcionesCalor(mapa: RespuestaProductividad["mapa_calor"], areaSeleccionada: string | null) {
  // Con filtros (p. ej. un servicio) varias áreas quedan sin datos: no se dibujan filas vacías
  const conDatos = new Set(mapa.celdas.map((c) => c.area));
  const areas = mapa.areas.filter((a) => conDatos.has(a));
  const xi = new Map(mapa.periodos.map((p, i) => [p.clave, i]));
  const yi = new Map(areas.map((a, i) => [a, i]));
  const filas = mapa.celdas
    .filter((c) => xi.has(c.clave) && yi.has(c.area))
    .map((c) => [xi.get(c.clave)!, yi.get(c.area)!, Number((c.pct_inasistencia * 100).toFixed(1)), c.inasistidas, c.asignadas]);
  const valores = filas.map((d) => d[2]);
  const lo = valores.length ? Math.min(...valores) : 0;
  const hi = valores.length ? Math.max(...valores) : 0;
  return {
    textStyle: textoBase,
    grid: { left: 150, right: 20, top: 8, bottom: 78 },
    tooltip: {
      ...cajaTooltip,
      formatter: (p: any) =>
        `<b>${areas[p.value[1]]}</b> · ${mapa.periodos[p.value[0]].etiqueta}<br>% inasistencia: <b>${fmtPuntos(p.value[2])}</b><br>${fmtNumero(p.value[3])} de ${fmtNumero(p.value[4])} asignadas`,
    },
    xAxis: {
      type: "category",
      data: mapa.periodos.map((p) => p.etiqueta),
      splitArea: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: TINTA_3 },
    },
    yAxis: {
      type: "category",
      data: areas,
      inverse: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: TINTA,
        fontSize: 12,
        formatter: (v: string) => (v === areaSeleccionada ? `{sel|${v}}` : v),
        rich: { sel: { fontWeight: 700, color: NAVY, fontSize: 12 } },
      },
    },
    visualMap: {
      dimension: 2,
      min: Math.floor(lo),
      max: Math.max(Math.ceil(hi), Math.floor(lo) + 1),
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemHeight: 160,
      itemWidth: 10,
      inRange: { color: ESCALA_SECUENCIAL },
      textStyle: { color: TINTA_3 },
      formatter: (v: number) => `${Math.round(v)} %`,
    },
    series: [
      {
        type: "heatmap",
        data: filas.map((d) => ({ value: d, label: { color: d[2] > lo + (hi - lo) * 0.55 ? "#fff" : TINTA } })),
        label: {
          show: true,
          fontSize: 10.5,
          formatter: (p: any) => p.value[2].toLocaleString("es-CO", { maximumFractionDigits: 0 }),
        },
        itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 3 },
        emphasis: { itemStyle: { borderColor: TINTA, borderWidth: 2 } },
      },
    ],
  };
}

/* ── Árbol de citas perdidas ────────────────── */

export function opcionesArbol(
  arbol: NodoArea[],
  areas: readonly string[],
  areaSeleccionada: string | null,
  servicioSeleccionado: string | null = null
) {
  const hoja = (s: NodoArea["servicios"][number], color?: string) => ({
    name: s.nombre,
    value: s.perdidas,
    codigo: s.codigo,
    inasistidas: s.inasistidas,
    disponibles: s.disponibles,
    pct_inasistencia: s.pct_inasistencia,
    pct_disponibilidad: s.pct_disponibilidad,
    ...(color && {
      itemStyle: { color, opacity: !servicioSeleccionado || s.codigo === servicioSeleccionado ? 1 : 0.4 },
    }),
  });
  // Con un área filtrada se dibujan solo sus servicios a todo el ancho; así no se
  // depende del zoom animado del treemap, que se pierde al llegar datos nuevos.
  const nodoArea = areaSeleccionada ? arbol.find((a) => a.area === areaSeleccionada) : undefined;
  const datos = nodoArea
    ? nodoArea.servicios.map((s) => hoja(s, colorArea(nodoArea.area, areas)))
    : arbol.map((a) => ({
        name: a.area,
        area: a.area,
        value: a.perdidas,
        itemStyle: { color: colorArea(a.area, areas) },
        children: a.servicios.map((s) => hoja(s)),
      }));

  // Los bloques pequeños no tienen espacio para nombre y valor: se etiquetan
  // según su participación en el total y el resto se lee en el tooltip.
  const total = datos.reduce((suma, d) => suma + d.value, 0);
  const etiquetaBloque = (p: any) => {
    const participacion = total ? p.value / total : 0;
    if (participacion >= 0.06) return `${p.name}\n${fmtNumero(p.value)}`;
    if (participacion >= 0.02) return fmtNumero(p.value);
    return "";
  };
  return {
    textStyle: textoBase,
    tooltip: {
      ...cajaTooltip,
      formatter: (p: any) => {
        const d = p.data ?? {};
        if (d.codigo) {
          return `<b>${d.name}</b><br>${fmtNumero(d.value)} citas perdidas<br>Inasistidas ${fmtNumero(d.inasistidas)} (${fmtPct(d.pct_inasistencia)}) · Disponibles ${fmtNumero(d.disponibles)} (${fmtPct(d.pct_disponibilidad)})`;
        }
        return d.name ? `<b>${d.name}</b><br>${fmtNumero(d.value)} citas perdidas` : "";
      },
    },
    series: [
      {
        type: "treemap",
        data: datos,
        roam: false,
        nodeClick: false,
        leafDepth: nodoArea ? undefined : 1,
        drillDownIcon: "",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        breadcrumb: { show: false },
        label: { show: true, formatter: etiquetaBloque, fontSize: 12, lineHeight: 15, color: "#fff", fontWeight: 600, overflow: "truncate" },
        upperLabel: { show: true, height: 22, color: "#fff", fontWeight: 600 },
        itemStyle: { borderColor: "#fff", borderWidth: 2, gapWidth: 2, borderRadius: 4 },
        levels: [
          { itemStyle: { borderWidth: 0, gapWidth: 3 } },
          { colorSaturation: [0.35, 0.6], itemStyle: { gapWidth: 2, borderColorSaturation: 0.7 } },
        ],
      },
    ],
  };
}
