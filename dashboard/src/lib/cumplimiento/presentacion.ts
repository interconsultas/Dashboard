/**
 * Formato y transformaciones de presentación del dashboard de cumplimiento.
 * Los porcentajes llegan como fracción de la meta (1.0 = 100%).
 */
import { fmtPeriodo } from "@/lib/periodo";
import type { FilaCumplimiento, ProfesionalCumplimiento } from "./calcular";

/* ── Formato ─────────────────────────────────── */

export const SIN_DATOS = "—";

function pctEntero(valor: number): number {
  return Math.round(valor * 100);
}

/** Porcentaje sin decimales ("137%"); "—" cuando no hay dato. */
export function fmtPct(valor: number | null): string {
  if (valor === null) return SIN_DATOS;
  return `${pctEntero(valor).toLocaleString("es-CO")}%`;
}

export type EstadoMeta = "sin_datos" | "sobre" | "dentro";

/**
 * La meta es un techo: por encima del 100% se está sobre la meta.
 * Se decide con el mismo valor redondeado que se muestra.
 */
export function estadoMeta(valor: number | null): EstadoMeta {
  if (valor === null) return "sin_datos";
  return pctEntero(valor) > 100 ? "sobre" : "dentro";
}

export const ETIQUETA_ESTADO: Record<EstadoMeta, string> = {
  sin_datos: "Sin datos",
  sobre: "Sobre la meta",
  dentro: "Dentro de la meta",
};

/** Tasa o meta con dos decimales ("10,49"); "—" cuando no hay dato. */
export function fmtTasa(valor: number | null): string {
  if (valor === null) return SIN_DATOS;
  return valor.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Series para las gráficas ────────────────── */

export interface ValorPeriodo {
  periodo: number;
  valor: number | null;
}

export interface PuntoGrafica {
  periodo: number;
  /** Etiqueta corta del eje ("Feb 26"). */
  etiqueta: string;
  etiquetaLarga: string;
  /** Puntos porcentuales con un decimal; null si el mes no tiene dato. */
  pct: number | null;
  texto: string;
}

function periodoCorto(periodo: number): string {
  const [mes, anio] = fmtPeriodo(periodo).split(" ");
  return `${mes} ${anio.slice(-2)}`;
}

/** Puntos de una gráfica mensual, en orden ascendente. Los meses sin dato quedan en null, no en 0. */
export function puntosGrafica(serie: ValorPeriodo[]): PuntoGrafica[] {
  return [...serie]
    .sort((a, b) => a.periodo - b.periodo)
    .map(({ periodo, valor }) => ({
      periodo,
      etiqueta: periodoCorto(periodo),
      etiquetaLarga: fmtPeriodo(periodo),
      pct: valor === null ? null : Math.round(valor * 1000) / 10,
      texto: fmtPct(valor),
    }));
}

export function serieGlobal(serie: { periodo: number; global: number | null }[]): ValorPeriodo[] {
  return serie.map((s) => ({ periodo: s.periodo, valor: s.global }));
}

export function serieDeCategoria(
  serie: { periodo: number; pct: Record<string, number | null> }[],
  clave: string
): ValorPeriodo[] {
  return serie.map((s) => ({ periodo: s.periodo, valor: s.pct[clave] ?? null }));
}

/** Serie por periodo de un solo médico: el global y el porcentaje de cada categoría de sus filas. */
export function serieDeFilas(
  filas: FilaCumplimiento[]
): { periodo: number; global: number | null; pct: Record<string, number | null> }[] {
  return filas.map((f) => ({
    periodo: f.periodo,
    global: f.global,
    pct: Object.fromEntries(Object.entries(f.categorias).map(([clave, d]) => [clave, d.pct])),
  }));
}

/** Médicos con citas en algún periodo en el que no tienen programa (sin programa no hay meta). */
export function contarSinPrograma(filas: FilaCumplimiento[]): number {
  const documentos = new Set<string>();
  for (const f of filas) {
    if (f.programa === null && f.citas !== null && f.citas > 0) documentos.add(f.documento);
  }
  return documentos.size;
}

/* ── Ranking ─────────────────────────────────── */

/** 'nombre', 'programa', 'citas', 'global' o la clave de una categoría. */
export type ColumnaRanking = string;
export type Direccion = "asc" | "desc";

function valorDeColumna(p: ProfesionalCumplimiento, columna: ColumnaRanking): string | number | null {
  switch (columna) {
    case "nombre":
      return p.nombre;
    case "programa":
      return p.programa;
    case "citas":
      return p.citas;
    case "global":
      return p.global;
    default:
      return p.pct[columna] ?? null;
  }
}

/** Ordena una copia de la lista. Las filas sin dato quedan al final en ambas direcciones. */
export function ordenarRanking(
  profesionales: ProfesionalCumplimiento[],
  columna: ColumnaRanking,
  direccion: Direccion
): ProfesionalCumplimiento[] {
  const signo = direccion === "asc" ? 1 : -1;
  return [...profesionales].sort((a, b) => {
    const va = valorDeColumna(a, columna);
    const vb = valorDeColumna(b, columna);
    if (va === null && vb !== null) return 1;
    if (va !== null && vb === null) return -1;
    let orden = 0;
    if (typeof va === "number" && typeof vb === "number") orden = va - vb;
    else if (typeof va === "string" && typeof vb === "string") orden = va.localeCompare(vb, "es");
    return orden * signo || a.nombre.localeCompare(b.nombre, "es");
  });
}

/* ── Selector de profesional ─────────────────── */

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Filtra por nombre (sin distinguir mayúsculas ni tildes) o por cédula. */
export function filtrarProfesionales<T extends { documento: string; nombre: string }>(
  lista: T[],
  busqueda: string
): T[] {
  const q = normalizar(busqueda.trim());
  if (q === "") return lista;
  return lista.filter((p) => normalizar(p.nombre).includes(q) || p.documento.includes(q));
}
