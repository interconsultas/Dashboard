/** Respuestas de GET /api/inteligencia/grafo. */
import type { Atribucion } from "@/lib/cumplimiento/config";
import type { Granularidad } from "@/lib/productividad/periodos";
import type { PeriodoCarga } from "@/lib/productividad/tipos";
import type { Esquema, ResultadoBusqueda, Vecindario } from "./grafo";
import type { ResultadoAlertas } from "./alertas";
import type { Prioridad } from "./prioridades";
import type { ReglaAlerta } from "./reglas";

export interface ContextoGrafo {
  granularidad: Granularidad;
  /** Carga consultada; null si no hay cargas de citas de la granularidad. */
  periodo: PeriodoCarga | null;
  /** Cargas de citas por granularidad, para el selector. */
  periodos: Record<Granularidad, PeriodoCarga[]>;
  /** Mes (YYYYMM) de las autorizaciones: el de la carga, también para las semanas. */
  periodo_autorizaciones: number | null;
  atribucion: Atribucion;
}

export interface RespuestaEsquema extends ContextoGrafo {
  modo: "esquema";
  esquema: Esquema;
}

export interface RespuestaVecindario extends ContextoGrafo {
  modo: "vecindario";
  vecindario: Vecindario;
}

export interface RespuestaBusqueda extends ContextoGrafo {
  modo: "buscar";
  resultados: ResultadoBusqueda[];
}

export type RespuestaGrafo = RespuestaEsquema | RespuestaVecindario | RespuestaBusqueda;

/** Respuesta de GET /api/inteligencia/alertas. */
export interface RespuestaAlertas extends ResultadoAlertas {
  granularidad: Granularidad;
  meta: number;
  periodos_cargados: number;
  min_periodos_proyeccion: number;
  reglas: ReglaAlerta[];
  /** Vista ejecutiva: máximo 5, ordenadas (ver ./prioridades). */
  prioridades: Prioridad[];
  /** Periodo con el que se comparan las prioridades; null si no hay. */
  periodo_anterior: string | null;
  /** Citas por encima del umbral para que una prioridad cuente. */
  impacto_minimo: number;
}
