/**
 * Simulador "¿qué pasa si…?" de Inteligencia. Funciones puras sobre los
 * totales del periodo de GET /api/productividad (con el filtro de área y
 * servicio ya aplicado).
 *
 * Modelo (O ofertadas, D disponibles, A asignadas, I inasistidas, P
 * profesionales con agenda):
 *   O' = O · (P + Δp) / P · (1 + Δo)
 *   D' = O' · %disponibilidad
 *   A' = O' − D'            (en el informe de Agenda Web O = A + D)
 *   I' = A' · %inasistencia
 *   atendidas' = A' − I';  perdidas' = I' + D'
 * Las citas se redondean a enteros. Con las palancas por defecto
 * (palancasBase) el escenario reproduce exactamente la realidad.
 */
import { META_INASISTENCIA, type Indicadores } from "@/lib/productividad/metricas";

/** Valor al que lleva "Llevar a la meta": el máximo de un dígito (9,9 %). */
export const OBJETIVO_META_INASISTENCIA = 0.099;

/* ── Tipos ──────────────────────────────────── */

export interface BaseSimulador {
  ofertadas: number;
  disponibles: number;
  asignadas: number;
  inasistidas: number;
  /** Profesionales con agenda en el filtro. */
  profesionales: number;
}

export interface Palancas {
  /** Profesionales más (o menos), entero. */
  deltaProfesionales: number;
  /** Cambio de la oferta por profesional, en fracción (0,1 = +10 %). */
  deltaOferta: number;
  /** Disponibles ÷ ofertadas objetivo, en fracción. */
  pctDisponibilidad: number;
  /** Inasistidas ÷ asignadas objetivo, en fracción. */
  pctInasistencia: number;
}

export type ClavePalanca = keyof Palancas;

export interface Rango {
  min: number;
  max: number;
}

export type LimitesPalancas = Record<ClavePalanca, Rango>;

export interface ResultadoSimulador {
  profesionales: number;
  ofertadas: number;
  asignadas: number;
  atendidas: number;
  inasistidas: number;
  disponibles: number;
  /** inasistidas + disponibles. */
  perdidas: number;
  pct_inasistencia: number | null;
  pct_disponibilidad: number | null;
  /** ofertadas ÷ profesionales; null sin profesionales. */
  oferta_por_profesional: number | null;
  /** perdidas ÷ oferta por profesional. */
  profesionales_equivalentes_perdidos: number | null;
  /** Inasistencia en la meta (≤ 10 % con citas enteras); null sin asignadas. */
  cumple_meta: boolean | null;
  /** Inasistencias que habría que evitar para llegar a la meta. */
  inasistencias_a_evitar: number;
}

export const METRICAS_COMPARADAS = [
  "ofertadas",
  "asignadas",
  "atendidas",
  "inasistidas",
  "disponibles",
  "perdidas",
] as const;

export type MetricaComparada = (typeof METRICAS_COMPARADAS)[number];

export interface Diferencia {
  base: number;
  escenario: number;
  delta: number;
  /** delta ÷ base; null con base 0. */
  delta_pct: number | null;
}

/* ── Constantes ─────────────────────────────── */

export const RANGO_DELTA_OFERTA: Rango = { min: -0.3, max: 0.3 };
export const MAX_DISPONIBILIDAD = 0.4;
export const MAX_INASISTENCIA = 0.5;
/** Fracción de P que se puede sumar como máximo. */
const FRACCION_MAX_PROFESIONALES = 0.5;
const TOLERANCIA = 1e-9;

/* ── Utilidades ─────────────────────────────── */

function razon(numerador: number, denominador: number): number | null {
  return denominador > 0 ? numerador / denominador : null;
}

function recortar(v: number, r: Rango): number {
  return Math.min(r.max, Math.max(r.min, v));
}

/* ── Base y palancas ────────────────────────── */

export function baseDesdeIndicadores(ind: Indicadores | null, profesionales: number): BaseSimulador | null {
  if (!ind) return null;
  return {
    ofertadas: ind.ofertadas,
    disponibles: ind.disponibles,
    asignadas: ind.asignadas,
    inasistidas: ind.inasistidas,
    profesionales,
  };
}

/** Palancas que reproducen la realidad. */
export function palancasBase(b: BaseSimulador): Palancas {
  return {
    deltaProfesionales: 0,
    deltaOferta: 0,
    pctDisponibilidad: razon(b.disponibles, b.ofertadas) ?? 0,
    pctInasistencia: razon(b.inasistidas, b.asignadas) ?? 0,
  };
}

/** Rangos de cada palanca; los de porcentaje se amplían si el valor real los supera. */
export function limitesPalancas(b: BaseSimulador): LimitesPalancas {
  const real = palancasBase(b);
  const p = Math.max(0, Math.floor(b.profesionales));
  return {
    deltaProfesionales: p > 0 ? { min: -p + 1, max: Math.ceil(p * FRACCION_MAX_PROFESIONALES) } : { min: 0, max: 0 },
    deltaOferta: { ...RANGO_DELTA_OFERTA },
    pctDisponibilidad: { min: 0, max: Math.max(MAX_DISPONIBILIDAD, real.pctDisponibilidad) },
    pctInasistencia: { min: 0, max: Math.max(MAX_INASISTENCIA, real.pctInasistencia) },
  };
}

/** Recorta a los límites; lo que no es un número vuelve al valor real. */
export function normalizarPalancas(b: BaseSimulador, p: Palancas): Palancas {
  const real = palancasBase(b);
  const l = limitesPalancas(b);
  const valor = (k: ClavePalanca) => (Number.isFinite(p[k]) ? recortar(p[k], l[k]) : real[k]);
  return {
    deltaProfesionales: Math.round(valor("deltaProfesionales")),
    deltaOferta: valor("deltaOferta"),
    pctDisponibilidad: valor("pctDisponibilidad"),
    pctInasistencia: valor("pctInasistencia"),
  };
}

export function palancasIguales(a: Palancas, b: Palancas): boolean {
  return (Object.keys(a) as ClavePalanca[]).every((k) => Math.abs(a[k] - b[k]) < TOLERANCIA);
}

/* ── Resultados ─────────────────────────────── */

function resultado(
  profesionales: number,
  ofertadas: number,
  disponibles: number,
  asignadas: number,
  inasistidas: number
): ResultadoSimulador {
  const perdidas = inasistidas + disponibles;
  const ofertaPorProfesional = razon(ofertadas, profesionales);
  // Meta de un dígito: estrictamente por debajo del 10 %, igual que en Productividad.
  // Mayor número entero de inasistidas con inasistidas ÷ asignadas < META.
  const permitidas = Math.max(0, Math.ceil(asignadas * META_INASISTENCIA) - 1);
  return {
    profesionales,
    ofertadas,
    asignadas,
    atendidas: asignadas - inasistidas,
    inasistidas,
    disponibles,
    perdidas,
    pct_inasistencia: razon(inasistidas, asignadas),
    pct_disponibilidad: razon(disponibles, ofertadas),
    oferta_por_profesional: ofertaPorProfesional,
    profesionales_equivalentes_perdidos: ofertaPorProfesional ? perdidas / ofertaPorProfesional : null,
    cumple_meta: asignadas > 0 ? inasistidas / asignadas < META_INASISTENCIA : null,
    inasistencias_a_evitar: Math.max(0, inasistidas - permitidas),
  };
}

export function resultadoBase(b: BaseSimulador): ResultadoSimulador {
  return resultado(b.profesionales, b.ofertadas, b.disponibles, b.asignadas, b.inasistidas);
}

export function simular(b: BaseSimulador, palancas: Palancas): ResultadoSimulador {
  const p = normalizarPalancas(b, palancas);
  const profesionales = b.profesionales + p.deltaProfesionales;
  const escala = b.profesionales > 0 ? profesionales / b.profesionales : 1;
  const ofertadas = Math.max(0, Math.round(b.ofertadas * escala * (1 + p.deltaOferta)));
  const disponibles = Math.round(ofertadas * p.pctDisponibilidad);
  const asignadas = ofertadas - disponibles;
  const inasistidas = Math.round(asignadas * p.pctInasistencia);
  return resultado(profesionales, ofertadas, disponibles, asignadas, inasistidas);
}

export function compararEscenario(
  base: ResultadoSimulador,
  escenario: ResultadoSimulador
): Record<MetricaComparada, Diferencia> {
  return Object.fromEntries(
    METRICAS_COMPARADAS.map((k) => {
      const delta = escenario[k] - base[k];
      return [k, { base: base[k], escenario: escenario[k], delta, delta_pct: razon(delta, base[k]) }];
    })
  ) as Record<MetricaComparada, Diferencia>;
}

/* ── Resumen en lenguaje llano ──────────────── */

const fmtEntero = (v: number) => Math.abs(v).toLocaleString("es-CO");
const fmtPorcentaje = (v: number) => `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;

function enumerar(partes: string[]): string {
  return partes.length <= 1 ? partes.join("") : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

function cambioCitas(verbo: string, delta: number): string {
  if (delta === 0) return `se ${verbo} las mismas citas`;
  return `se ${verbo} ${fmtEntero(delta)} ${Math.abs(delta) === 1 ? "cita" : "citas"} ${delta > 0 ? "más" : "menos"}`;
}

/** "Con 3 profesionales más y la inasistencia en 10 %, se atenderían N citas más en el periodo…" */
export function resumenEscenario(
  base: ResultadoSimulador,
  escenario: ResultadoSimulador,
  palancas: Palancas,
  real: Palancas
): string {
  const partes: string[] = [];
  const dp = palancas.deltaProfesionales;
  if (dp !== 0) partes.push(`${fmtEntero(dp)} ${Math.abs(dp) === 1 ? "profesional" : "profesionales"} ${dp > 0 ? "más" : "menos"}`);
  const doferta = palancas.deltaOferta;
  if (Math.abs(doferta) > TOLERANCIA) {
    partes.push(`${fmtPorcentaje(Math.abs(doferta))} ${doferta > 0 ? "más" : "menos"} de oferta por profesional`);
  }
  if (Math.abs(palancas.pctDisponibilidad - real.pctDisponibilidad) > TOLERANCIA) {
    partes.push(`la disponibilidad en ${fmtPorcentaje(palancas.pctDisponibilidad)}`);
  }
  if (Math.abs(palancas.pctInasistencia - real.pctInasistencia) > TOLERANCIA) {
    partes.push(`la inasistencia en ${fmtPorcentaje(palancas.pctInasistencia)}`);
  }
  if (partes.length === 0) return "Mueva las palancas para comparar un escenario con lo que pasó en el periodo.";

  const dAtendidas = escenario.atendidas - base.atendidas;
  const dPerdidas = escenario.perdidas - base.perdidas;
  let texto = `Con ${enumerar(partes)}, ${cambioCitas("atenderían", dAtendidas)} en el periodo y ${cambioCitas("perderían", dPerdidas)}`;
  if (dPerdidas !== 0 && base.oferta_por_profesional) {
    const k = Math.abs(dPerdidas) / base.oferta_por_profesional;
    texto += ` — equivale a ${k.toLocaleString("es-CO", { maximumFractionDigits: 1 })} ${k === 1 ? "profesional" : "profesionales"}`;
  }
  return `${texto}.`;
}
