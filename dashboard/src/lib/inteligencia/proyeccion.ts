/**
 * Proyección del siguiente periodo (mes o semana) de una serie de la agenda.
 * Módulo puro: lo usan la API de alertas y sus pruebas.
 *
 * Método (transparente, se explica igual en la interfaz):
 *   1. Ventana: los últimos VENTANA_PROYECCION periodos cargados (mínimo
 *      MIN_PERIODOS_PROYECCION). Los periodos sin dato (p. ej. un servicio
 *      sin citas asignadas ese mes) se omiten.
 *   2. Nivel: promedio móvil ponderado con pesos 1..n (el periodo más
 *      reciente pesa más). Ese promedio está "centrado" en t̄ = Σi²/Σi
 *      = (2n + 1) / 3, no en el último periodo.
 *   3. Tendencia: pendiente de mínimos cuadrados sobre la misma ventana.
 *   4. Pronóstico: nivel + pendiente × (n + 1 − t̄). Así una serie que
 *      crece en línea recta se proyecta exacta (sumar solo una pendiente al
 *      promedio la subestimaría).
 *   5. Rango: ± el error absoluto medio (EAM) de un backtest a un paso dentro
 *      de la ventana: con los 2 primeros periodos se pronostica el 3.º, con
 *      los 3 primeros el 4.º, etc. Se eligió el EAM sobre la desviación de
 *      los residuos porque mide el error real del mismo método fuera de la
 *      muestra y está en las mismas unidades que la proyección.
 *   6. Dirección: según la pendiente, con una tolerancia pequeña
 *      (0,25 pp por periodo en porcentajes; 1 % del promedio en cantidades).
 *   Los porcentajes se recortan a [0, 1] y las cantidades a ≥ 0 (enteras).
 */
import type { Granularidad, IdentidadCarga, RangoCarga } from "@/lib/productividad/periodos";

export const VENTANA_PROYECCION = 6;
export const MIN_PERIODOS_PROYECCION = 3;
/** Cambio mínimo frente al último periodo para decir que un porcentaje sube o baja: 0,25 pp. */
export const TOLERANCIA_PCT = 0.0025;
/** Pendiente mínima de una cantidad, relativa a su promedio: 1 %. */
export const TOLERANCIA_RELATIVA = 0.01;

export type Direccion = "sube" | "baja" | "estable";

export interface Proyeccion {
  valor: number;
  min: number;
  max: number;
  /** Error absoluto medio del backtest (ancho de medio rango). */
  error: number;
  /** Cambio por periodo según la tendencia lineal. */
  pendiente: number;
  direccion: Direccion;
  /** Periodos usados (≤ VENTANA_PROYECCION). */
  periodos: number;
}

function pendienteMinCuadrados(x: readonly number[]): number {
  const n = x.length;
  const tMedia = (n + 1) / 2;
  const xMedia = x.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  x.forEach((v, i) => {
    const dt = i + 1 - tMedia;
    num += dt * (v - xMedia);
    den += dt * dt;
  });
  return den === 0 ? 0 : num / den;
}

/** Pronóstico a un paso (sin recortar). null con menos de 2 puntos. */
export function pronosticoPunto(x: readonly number[]): number | null {
  const n = x.length;
  if (n < 2) return null;
  const sumaPesos = (n * (n + 1)) / 2;
  const nivel = x.reduce((s, v, i) => s + (i + 1) * v, 0) / sumaPesos;
  const centro = (2 * n + 1) / 3;
  return nivel + pendienteMinCuadrados(x) * (n + 1 - centro);
}

function proyectar(
  valores: readonly number[],
  acotar: (v: number) => number,
  tolerancia: (ventana: readonly number[]) => number
): Proyeccion | null {
  const limpios = valores.filter((v) => Number.isFinite(v));
  if (limpios.length < MIN_PERIODOS_PROYECCION) return null;
  const ventana = limpios.slice(-VENTANA_PROYECCION);

  const errores: number[] = [];
  for (let k = 2; k < ventana.length; k++) {
    errores.push(Math.abs(pronosticoPunto(ventana.slice(0, k))! - ventana[k]));
  }
  const error = errores.reduce((s, e) => s + e, 0) / errores.length;
  const crudo = pronosticoPunto(ventana)!;
  const pendiente = pendienteMinCuadrados(ventana);
  const tol = tolerancia(ventana);
  // La dirección compara el pronóstico con el último periodo real: es como se lee
  // "sube" o "baja", aunque la ventana completa venga en otra tendencia.
  const cambio = crudo - ventana[ventana.length - 1];

  return {
    valor: acotar(crudo),
    min: acotar(crudo - error),
    max: acotar(crudo + error),
    error,
    pendiente,
    direccion: cambio > tol ? "sube" : cambio < -tol ? "baja" : "estable",
    periodos: ventana.length,
  };
}

/** Proyección de una proporción (p. ej. % de inasistencia, como fracción). */
export function proyectarPct(valores: readonly number[]): Proyeccion | null {
  return proyectar(valores, (v) => Math.min(1, Math.max(0, v)), () => TOLERANCIA_PCT);
}

/** Proyección de una cantidad (p. ej. citas asignadas): entera y ≥ 0. */
export function proyectarCantidad(valores: readonly number[]): Proyeccion | null {
  return proyectar(
    valores,
    (v) => Math.max(0, Math.round(v)),
    (x) => (TOLERANCIA_RELATIVA * Math.abs(x.reduce((s, v) => s + v, 0))) / x.length
  );
}

/* ── Periodos ───────────────────────────────── */

const DIA_MS = 86_400_000;

function aFecha(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function aIso(f: Date): string {
  return f.toISOString().slice(0, 10);
}

function periodoDe(f: Date): number {
  return f.getUTCFullYear() * 100 + f.getUTCMonth() + 1;
}

/** Periodo siguiente al cargado: el mes siguiente o los 7 días que siguen a la semana. */
export function siguienteCarga(c: RangoCarga): RangoCarga {
  const granularidad: Granularidad = c.granularidad;
  if (granularidad === "mensual") {
    const anio = Math.floor(c.periodo / 100);
    const mes = c.periodo % 100; // 1..12; el siguiente es índice `mes` en base 0
    const inicio = new Date(Date.UTC(anio, mes, 1));
    const fin = new Date(Date.UTC(anio, mes + 1, 0));
    return { granularidad, periodo: periodoDe(inicio), fecha_inicial: aIso(inicio), fecha_final: aIso(fin) };
  }
  const inicio = new Date(aFecha(c.fecha_final).getTime() + DIA_MS);
  const fin = new Date(inicio.getTime() + 6 * DIA_MS);
  return { granularidad, periodo: periodoDe(inicio), fecha_inicial: aIso(inicio), fecha_final: aIso(fin) };
}

/** Índice del periodo en su granularidad: dos periodos son consecutivos si difieren en 1. */
export function secuenciaCarga(c: IdentidadCarga): number {
  if (c.granularidad === "mensual") return Math.floor(c.periodo / 100) * 12 + (c.periodo % 100) - 1;
  return Math.floor(aFecha(c.fecha_inicial).getTime() / DIA_MS / 7);
}
