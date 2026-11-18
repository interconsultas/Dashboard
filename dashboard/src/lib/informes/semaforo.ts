/**
 * Semáforo del % de inasistencia contra la meta: verde bajo la meta y rojo
 * cada vez más intenso por encima. Lo comparten el Excel (formato
 * condicional) y el PDF (celda coloreada con su etiqueta en texto).
 */
import { COLORES } from "@/lib/tema/tokens";
import { META_INASISTENCIA } from "@/lib/productividad/metricas";

export interface BandaInasistencia {
  /** Múltiplos de la meta: [desde, hasta). null = sin límite. */
  desde: number | null;
  hasta: number | null;
  etiqueta: string;
  fondo: string;
  tinta: string;
}

export const BANDAS_INASISTENCIA: readonly BandaInasistencia[] = [
  { desde: null, hasta: 1, etiqueta: "En meta", fondo: COLORES["bien-suave"], tinta: COLORES.bien },
  { desde: 1, hasta: 1.5, etiqueta: "Alto", fondo: COLORES["critico-suave"], tinta: COLORES.critico },
  { desde: 1.5, hasta: 2, etiqueta: "Muy alto", fondo: "#F4B4AB", tinta: COLORES.tinta },
  { desde: 2, hasta: null, etiqueta: "Crítico", fondo: COLORES.critico, tinta: "#FFFFFF" },
];

/** Umbral de la banda como razón, redondeado como en las reglas del Excel (0,15 y no 0,15000000000000002). */
export const umbralInasistencia = (multiplo: number) => Number((META_INASISTENCIA * multiplo).toFixed(4));

/** Banda del valor (razón 0–1); null sin valor. */
export function bandaInasistencia(valor: number | null): BandaInasistencia | null {
  if (valor === null || !Number.isFinite(valor)) return null;
  return (
    BANDAS_INASISTENCIA.find(
      (b) => (b.desde === null || valor >= umbralInasistencia(b.desde)) && (b.hasta === null || valor < umbralInasistencia(b.hasta))
    ) ?? null
  );
}
