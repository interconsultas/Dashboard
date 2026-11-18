/** Contrato de GET /api/productividad. */
import type { OpcionServicio } from "./filtros";
import type { Indicadores } from "./metricas";
import type { Granularidad } from "./periodos";

export interface PeriodoCarga {
  /** YYYYMM (mensual) o fecha inicial ISO (semanal); es el valor del filtro `periodo`. */
  clave: string;
  /** "Oct 2026" / "5–11 oct" */
  etiqueta: string;
  /** "Octubre 2026" / "5–11 oct 2026" */
  etiqueta_larga: string;
  fecha_inicial: string;
  fecha_final: string;
}

export interface PuntoSerie extends Indicadores {
  clave: string;
  etiqueta: string;
}

export interface NodoServicio extends Indicadores {
  codigo: string;
  nombre: string;
}

export interface NodoArea extends Indicadores {
  area: string;
  servicios: NodoServicio[];
}

export interface CeldaCalor {
  area: string;
  clave: string;
  pct_inasistencia: number;
  inasistidas: number;
  asignadas: number;
}

export interface ResumenProfesional extends Indicadores {
  documento: string;
  nombre: string;
  area_principal: string | null;
}

export interface Embudo {
  ofertadas: number;
  asignadas: number;
  atendidas: number;
  disponibles: number;
  inasistidas: number;
}

export interface RespuestaProductividad {
  granularidad: Granularidad;
  periodos: { mensual: PeriodoCarga[]; semanal: PeriodoCarga[] };
  /** Clave del periodo seleccionado; null si no hay cargas de la granularidad. */
  periodo: string | null;
  opciones: {
    areas: string[];
    servicios: OpcionServicio[];
    /** Profesionales con filas en la carga seleccionada (para el buscador). */
    profesionales: { documento: string; nombre: string }[];
  };
  kpis: {
    actual: Indicadores | null;
    anterior: Indicadores | null;
    periodo_anterior: string | null;
    /** Hasta 12 periodos que terminan en el seleccionado (sparklines). */
    serie: PuntoSerie[];
  };
  /** Todos los periodos de la granularidad. */
  tendencia: PuntoSerie[];
  embudo: Embudo | null;
  mapa_calor: { areas: string[]; periodos: { clave: string; etiqueta: string }[]; celdas: CeldaCalor[] };
  /** Citas perdidas área → servicio (solo nodos con citas perdidas). */
  arbol: NodoArea[];
  matriz: { areas: NodoArea[]; total: Indicadores | null };
  profesionales: {
    con_agenda: number;
    /** Con ≥ 50 asignadas y % de inasistencia bajo la meta. */
    destacados: number;
    /** Totales por profesional (base del dispersograma, el Pareto y la ficha). */
    lista: ResumenProfesional[];
  };
}

/** Contrato de GET /api/productividad/profesional (ficha individual). */
export interface RespuestaFichaProfesional {
  documento: string;
  nombre: string;
  /** Área principal en el periodo seleccionado; null si no tuvo agenda. */
  area_principal: string | null;
  granularidad: Granularidad;
  /** Clave del periodo seleccionado; null si no hay cargas de la granularidad. */
  periodo: string | null;
  etiqueta_periodo: string | null;
  /** Totales del profesional en el periodo (con los filtros de área y servicio). */
  actual: Indicadores | null;
  /** Todos los profesionales del periodo con los mismos filtros. */
  institucion: { pct_inasistencia: number | null };
  /** % de pares con mayor inasistencia; null con menos de 50 asignadas. */
  percentil: number | null;
  /** Profesionales con ≥ 50 asignadas contra los que se calcula el percentil. */
  pares: number;
  /** Servicios del periodo, de más a menos asignadas. */
  servicios: NodoServicio[];
  /** Todos los periodos cargados de la granularidad. */
  tendencia: PuntoSerie[];
}
