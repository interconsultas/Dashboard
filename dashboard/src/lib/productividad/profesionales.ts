/**
 * Cálculos sobre los totales por profesional (dispersograma, Pareto de
 * citas perdidas y percentil de la ficha). Funciones puras.
 */
import type { ResumenProfesional } from "./tipos";

/** El dispersograma solo dibuja profesionales con al menos estas asignadas. */
export const MIN_ASIGNADAS_DISPERSION = 20;
/** Para el percentil cuentan como pares quienes tienen al menos estas asignadas. */
export const MIN_ASIGNADAS_PERCENTIL = 50;
/** Proporción acumulada de citas perdidas que marca el corte del Pareto. */
export const CORTE_PARETO = 0.8;
/** Barras que dibuja el Pareto. */
export const TOP_PARETO = 15;

/* ── Dispersograma ──────────────────────────── */

export function elegiblesDispersion<T extends { asignadas: number }>(lista: readonly T[]): T[] {
  return lista.filter((p) => p.asignadas >= MIN_ASIGNADAS_DISPERSION);
}

export function mediana(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const s = [...valores].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Máximo del eje logarítmico: la siguiente potencia de 10 (mínimo 10). */
export function ejeMaximoLog(maximo: number): number {
  return Math.pow(10, Math.ceil(Math.log10(Math.max(maximo, 10))));
}

export interface UmbralesDispersion {
  /** inasistidas ÷ asignadas de los puntos dibujados; null sin puntos. */
  promedio: number | null;
  /** Mediana de asignadas de los puntos dibujados; null sin puntos. */
  medianaVolumen: number | null;
  maxEje: number;
}

export function umbralesDispersion(puntos: readonly { asignadas: number; inasistidas: number }[]): UmbralesDispersion {
  const asignadas = puntos.reduce((s, p) => s + p.asignadas, 0);
  const inasistidas = puntos.reduce((s, p) => s + p.inasistidas, 0);
  return {
    promedio: asignadas > 0 ? inasistidas / asignadas : null,
    medianaVolumen: mediana(puntos.map((p) => p.asignadas)),
    maxEje: ejeMaximoLog(Math.max(0, ...puntos.map((p) => p.asignadas))),
  };
}

/* ── Pareto ─────────────────────────────────── */

export interface FilaPareto {
  documento: string;
  nombre: string;
  inasistidas: number;
  disponibles: number;
  perdidas: number;
  /** Proporción acumulada del total de citas perdidas (0–1). */
  acumulado: number;
  /** ¿Está dentro del grupo que concentra el corte (80 %)? */
  dentro_corte: boolean;
}

export interface Pareto {
  /** Profesionales con citas perdidas, de más a menos. */
  filas: FilaPareto[];
  total: number;
  /** Cuántos profesionales concentran el corte (el que lo cruza incluido). */
  corte: number;
  /** Profesionales con citas perdidas. */
  profesionales: number;
}

export function pareto(lista: readonly ResumenProfesional[], proporcion = CORTE_PARETO): Pareto {
  const ordenados = lista
    .map((p) => ({ documento: p.documento, nombre: p.nombre, inasistidas: p.inasistidas, disponibles: p.disponibles, perdidas: p.inasistidas + p.disponibles }))
    .filter((p) => p.perdidas > 0)
    .sort((a, b) => b.perdidas - a.perdidas || a.nombre.localeCompare(b.nombre) || a.documento.localeCompare(b.documento));
  const total = ordenados.reduce((s, p) => s + p.perdidas, 0);
  let suma = 0;
  const conAcumulado = ordenados.map((p) => {
    suma += p.perdidas;
    return { ...p, acumulado: suma / total };
  });
  const corte = conAcumulado.findIndex((p) => p.acumulado >= proporcion) + 1;
  return {
    filas: conAcumulado.map((p, i) => ({ ...p, dentro_corte: i < corte })),
    total,
    corte,
    profesionales: ordenados.length,
  };
}

/* ── Percentil ──────────────────────────────── */

interface ValorInasistencia {
  asignadas: number;
  pct_inasistencia: number | null;
}

/**
 * Porcentaje de pares (≥ 50 asignadas) con mayor % de inasistencia que el
 * profesional: "mejor que el X % de sus pares". null si no tiene 50 asignadas.
 */
export function percentilInasistencia(profesional: ValorInasistencia, pares: readonly ValorInasistencia[]): number | null {
  const propio = profesional.pct_inasistencia;
  if (profesional.asignadas < MIN_ASIGNADAS_PERCENTIL || propio === null) return null;
  const valores = pares
    .filter((p) => p.asignadas >= MIN_ASIGNADAS_PERCENTIL && p.pct_inasistencia !== null)
    .map((p) => p.pct_inasistencia as number);
  if (valores.length === 0) return null;
  return Math.round((100 * valores.filter((v) => v > propio).length) / valores.length);
}
