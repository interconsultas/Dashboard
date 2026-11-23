/**
 * Opciones de ECharts del mapa de relaciones (serie `graph`). Funciones
 * puras: no importan echarts, así que se prueban sin canvas.
 */
import { TINTA, TINTA_2, fmtNumero, fmtPct } from "@/lib/productividad/presentacion";
import { TOOLTIP_TEMA } from "@/lib/tema/graficas";
import { COLORES } from "@/lib/tema/tokens";
import { TIPOS_OBJETO, colorTipo, defRelacion, defTipo, type FormatoMetrica, type TipoObjeto } from "./ontologia";
import type { Arista, Esquema, Nodo } from "./grafo";

/* eslint-disable @typescript-eslint/no-explicit-any -- los parámetros de los formatters de ECharts no tienen un tipo útil */

export interface Subgrafo {
  nodos: Nodo[];
  aristas: Arista[];
}

// La caja del tooltip es la del tema; aquí solo se limita su ancho (textos largos)
const cajaTooltip = {
  extraCssText: `${TOOLTIP_TEMA.extraCssText}max-width:320px;white-space:normal;`,
};

const categorias = TIPOS_OBJETO.map((t) => ({ name: defTipo(t).etiqueta, itemStyle: { color: colorTipo(t) } }));

function escapar(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function fmtMetrica(v: number | null, formato: FormatoMetrica): string {
  if (v === null) return "—";
  if (formato === "pct") return fmtPct(v);
  if (formato === "decimal") return v.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  return fmtNumero(v);
}

/** Une dos subgrafos sin repetir nodos ni aristas (para "Expandir"). */
export function fusionarSubgrafos(base: Subgrafo, extra: Subgrafo): Subgrafo {
  const ids = new Set(base.nodos.map((x) => x.id));
  const aristas = new Set(base.aristas.map((x) => x.id));
  return {
    nodos: base.nodos.concat(extra.nodos.filter((x) => !ids.has(x.id) && ids.add(x.id))),
    aristas: base.aristas.concat(extra.aristas.filter((x) => !aristas.has(x.id) && aristas.add(x.id))),
  };
}

const TAM_MIN = 14;
const TAM_RANGO = 30;
const TAM_CENTRO = 48;

function maximoPor<T>(items: readonly T[], clave: (x: T) => string, peso: (x: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of items) m.set(clave(x), Math.max(m.get(clave(x)) ?? 0, peso(x)));
  return m;
}

/** Grafo de instancias: tamaño por peso dentro de su tipo, color por tipo, grosor por peso dentro de su relación. */
export function opcionesInstancias(sub: Subgrafo, centro: string | null) {
  const indice = new Map(sub.nodos.map((x, i) => [x.id, i]));
  const maxTipo = maximoPor(sub.nodos, (x) => x.tipo, (x) => x.peso);
  const aristas = sub.aristas.filter((x) => indice.has(x.origen) && indice.has(x.destino));
  const maxRelacion = maximoPor(aristas, (x) => x.relacion, (x) => x.peso);

  const data = sub.nodos.map((x) => {
    const max = maxTipo.get(x.tipo) ?? 0;
    const proporcion = max > 0 ? Math.sqrt(Math.max(0, x.peso) / max) : 0;
    const esCentro = x.id === centro;
    const tam = TAM_MIN + TAM_RANGO * proporcion;
    return {
      id: x.id,
      name: x.etiqueta,
      tipo: x.tipo,
      value: x.peso,
      category: TIPOS_OBJETO.indexOf(x.tipo),
      symbolSize: esCentro ? Math.max(tam, TAM_CENTRO) : tam,
      label: { show: esCentro || proporcion >= 0.5 },
      itemStyle: esCentro ? { borderColor: TINTA, borderWidth: 3 } : undefined,
    };
  });

  const links = aristas.map((x) => {
    const max = maxRelacion.get(x.relacion) ?? 0;
    return {
      source: indice.get(x.origen)!,
      target: indice.get(x.destino)!,
      value: x.peso,
      relacion: x.relacion,
      metricas: x.metricas,
      origenNombre: sub.nodos[indice.get(x.origen)!].etiqueta,
      destinoNombre: sub.nodos[indice.get(x.destino)!].etiqueta,
      lineStyle: { width: 1 + 5 * (max > 0 ? Math.max(0, x.peso) / max : 0) },
    };
  });

  return {
    animationDurationUpdate: 400,
    tooltip: { ...cajaTooltip, formatter: tooltip },
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        force: { repulsion: 260, edgeLength: [70, 170], gravity: 0.08, friction: 0.2 },
        categories: categorias,
        data,
        links,
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: 6,
        lineStyle: { color: "source", opacity: 0.55, curveness: 0.08 },
        label: { position: "right", fontSize: 11, color: TINTA, formatter: (p: any) => recortar(p.name, 28) },
        edgeLabel: { show: false, fontSize: 10.5, color: TINTA_2, formatter: (p: any) => defRelacion(p.data.relacion).etiqueta },
        emphasis: { focus: "adjacency", label: { show: true }, edgeLabel: { show: true }, lineStyle: { opacity: 0.9 } },
      },
    ],
  };
}

function recortar(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function tooltip(p: any): string {
  if (p.dataType === "edge") {
    const d = p.data;
    const def = defRelacion(d.relacion);
    const filas = def.metricas
      .filter((m) => d.metricas?.[m.clave] !== undefined)
      .map((m) => `${m.etiqueta}: <b>${fmtMetrica(d.metricas[m.clave], m.formato)}</b>`);
    return [`${escapar(d.origenNombre)} <i>${def.etiqueta}</i> ${escapar(d.destinoNombre)}`, ...filas].join("<br/>");
  }
  const d = p.data;
  const tipo = defTipo(d.tipo as TipoObjeto);
  return `${tipo.etiqueta}<br/><b>${escapar(String(d.name))}</b>`;
}

/** Vista del modelo: los tipos como nodos y los tipos de relación como aristas. */
export function opcionesEsquema(e: Esquema) {
  const indice = new Map(e.tipos.map((t, i) => [t.clave, i]));
  const max = Math.max(1, ...e.tipos.map((t) => t.cantidad));
  return {
    animationDurationUpdate: 400,
    tooltip: {
      ...cajaTooltip,
      formatter: (p: any) =>
        p.dataType === "edge"
          ? `${escapar(p.data.origenNombre)} <i>${p.data.etiqueta}</i> ${escapar(p.data.destinoNombre)}<br/>Relaciones en el periodo: <b>${fmtNumero(p.data.value)}</b>`
          : `<b>${escapar(p.data.name)}</b><br/>${escapar(p.data.descripcion)}<br/>Instancias: <b>${fmtNumero(p.data.value)}</b>`,
    },
    series: [
      {
        type: "graph",
        layout: "circular",
        circular: { rotateLabel: false },
        roam: true,
        categories: categorias,
        data: e.tipos.map((t) => ({
          id: t.clave,
          name: t.plural,
          tipo: t.clave,
          value: t.cantidad,
          descripcion: t.descripcion,
          category: TIPOS_OBJETO.indexOf(t.clave),
          symbolSize: 34 + 26 * Math.sqrt(t.cantidad / max),
          cursor: "pointer",
        })),
        links: e.relaciones.map((r) => ({
          source: indice.get(r.origen)!,
          target: indice.get(r.destino)!,
          value: r.cantidad,
          etiqueta: r.etiqueta,
          origenNombre: defTipo(r.origen).etiqueta,
          destinoNombre: defTipo(r.destino).etiqueta,
        })),
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: 8,
        lineStyle: { color: COLORES.referencia, width: 1.6, curveness: 0.18 },
        label: { show: true, position: "bottom", fontSize: 12, color: TINTA, formatter: (p: any) => `${p.name}\n${fmtNumero(p.value)}` },
        edgeLabel: { show: true, fontSize: 10.5, color: TINTA_2, formatter: (p: any) => p.data.etiqueta },
        emphasis: { focus: "adjacency", lineStyle: { width: 2.4 } },
      },
    ],
  };
}
