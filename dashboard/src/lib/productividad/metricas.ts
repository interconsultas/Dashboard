/**
 * Métricas e indicadores de productividad de la agenda (informe detallado
 * por profesional de Agenda Web, 016_citas_detallado.sql).
 *
 * Las fórmulas replican las del Excel de seguimiento del cliente.
 */

/** Meta institucional de inasistencia: un dígito (menos del 10 %). */
export const META_INASISTENCIA = 0.1;

export const CLAVES_METRICAS = [
  "creadas",
  "bloqueadas",
  "ofertadas",
  "disponibles",
  "asignadas",
  "confirmadas",
  "confirmadas_sin_atencion",
  "inasistidas",
  "canceladas",
  "pendientes_por_asistir",
] as const;

export type ClaveMetrica = (typeof CLAVES_METRICAS)[number];

export type Metricas = Record<ClaveMetrica, number>;

export interface Indicadores extends Metricas {
  /** inasistidas ÷ asignadas; null sin asignadas. */
  pct_inasistencia: number | null;
  /** disponibles ÷ ofertadas; null sin ofertadas. */
  pct_disponibilidad: number | null;
  /** inasistidas + disponibles. */
  perdidas: number;
  /** asignadas − inasistidas (paso final del embudo). */
  atendidas: number;
}

export function metricasVacias(): Metricas {
  return Object.fromEntries(CLAVES_METRICAS.map((k) => [k, 0])) as Metricas;
}

export function sumarMetricas(filas: readonly Metricas[]): Metricas {
  const total = metricasVacias();
  for (const f of filas) {
    for (const k of CLAVES_METRICAS) total[k] += f[k];
  }
  return total;
}

function razon(numerador: number, denominador: number): number | null {
  return denominador > 0 ? numerador / denominador : null;
}

export function indicadores(m: Metricas): Indicadores {
  const base = sumarMetricas([m]);
  return {
    ...base,
    pct_inasistencia: razon(base.inasistidas, base.asignadas),
    pct_disponibilidad: razon(base.disponibles, base.ofertadas),
    perdidas: base.inasistidas + base.disponibles,
    atendidas: base.asignadas - base.inasistidas,
  };
}

/**
 * Variación frente al periodo anterior.
 *  - relativa: cambio porcentual (110 vs 100 → 10).
 *  - puntos: diferencia en puntos porcentuales entre dos razones (0,171 vs 0,15 → 2,1).
 */
export function variacion(
  actual: number | null,
  anterior: number | null,
  tipo: "relativa" | "puntos"
): number | null {
  if (actual === null || anterior === null) return null;
  if (tipo === "puntos") return (actual - anterior) * 100;
  return anterior === 0 ? null : ((actual - anterior) / anterior) * 100;
}
