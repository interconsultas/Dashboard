/**
 * Modelo neutro de un informe: lo consumen el Excel (./excel) y el PDF.
 * Los constructores (./construir) lo arman a partir de las respuestas de
 * productividad, la ficha del profesional y las prioridades de Inteligencia.
 */

export type TipoInforme = "vista" | "mensual" | "ficha";

export const TIPOS_INFORME: readonly TipoInforme[] = ["vista", "mensual", "ficha"];

export type TipoColumna = "texto" | "entero" | "decimal" | "porcentaje";

/** Razón entre dos columnas (o indicadores) de la misma fila: numerador ÷ denominador. */
export interface FormulaRazon {
  numerador: string;
  denominador: string;
}

export interface ColumnaInforme {
  clave: string;
  etiqueta: string;
  tipo: TipoColumna;
  /** Solo porcentajes: el Excel la escribe como fórmula sobre las columnas de conteo. */
  formula?: FormulaRazon;
  /** Formato condicional contra la meta de inasistencia (verde bajo la meta, rojo por encima). */
  semaforo?: boolean;
}

export type ValorCelda = string | number | null;
export type FilaInforme = Record<string, ValorCelda>;

export interface TablaInforme {
  id: string;
  /** Nombre de la hoja de Excel (≤ 31 caracteres). */
  titulo: string;
  columnas: ColumnaInforme[];
  filas: FilaInforme[];
  /** ¿Lleva fila de totales (sumas de los conteos y razones sobre los totales)? */
  totales: boolean;
  /** Aclaración que acompaña la tabla. */
  nota?: string;
}

export interface KpiInforme {
  clave: string;
  etiqueta: string;
  tipo: "entero" | "decimal" | "porcentaje";
  valor: number | null;
  /** Periodo anterior; null si no aplica. */
  anterior: number | null;
  /** Cómo se lee la variación: cambio relativo o puntos porcentuales. null = sin variación. */
  variacion: "relativa" | "puntos" | null;
  formula?: FormulaRazon;
  semaforo?: boolean;
}

export interface SerieInforme {
  id: string;
  titulo: string;
  etiquetas: string[];
  series: { nombre: string; tipo: "entero" | "porcentaje"; valores: (number | null)[] }[];
}

export interface ModeloInforme {
  tipo: TipoInforme;
  titulo: string;
  subtitulo: string;
  /** Etiqueta larga del periodo ("Octubre 2026"); null sin cargas. */
  periodo: string | null;
  /** Etiqueta del periodo con el que se comparan los indicadores. */
  periodo_anterior: string | null;
  /** Filtros aplicados, como texto. */
  filtros: { etiqueta: string; valor: string }[];
  /** Fecha y hora de generación ("18/11/2026, 10:32"), hora de Colombia. */
  generado: string;
  /** Nombre del archivo sin extensión ("Productividad_Octubre_2026"). */
  archivo: string;
  /** Hoja que lleva el encabezado y los indicadores ("Resumen" o "Ficha"). */
  hoja_resumen: string;
  kpis: KpiInforme[];
  tablas: TablaInforme[];
  series: SerieInforme[];
  notas: string[];
}
