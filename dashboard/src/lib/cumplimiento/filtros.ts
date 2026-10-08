/** Filtros del dashboard de cumplimiento y su traducción al cuerpo de POST /api/cumplimiento. */
import { PROGRAMAS_META } from "./categorias";
import { mesesEntre } from "./periodo";

export const MAX_MESES_RANGO = 24;

export interface FiltrosCumplimiento {
  desde: number | null;
  hasta: number | null;
  /** Programas marcados; ninguno o todos equivale a no filtrar. */
  programas: string[];
}

/**
 * Cuerpo de la consulta. Con `null` (aún no se aplicó ningún filtro) el
 * servidor usa los últimos periodos con citas. El profesional no viaja:
 * se elige sobre los datos ya consultados.
 */
export function cuerpoConsulta(filtros: FiltrosCumplimiento | null): string {
  if (filtros === null) return "{}";
  const cuerpo: { periodo_desde: number | null; periodo_hasta: number | null; programas?: string[] } = {
    periodo_desde: filtros.desde,
    periodo_hasta: filtros.hasta,
  };
  if (filtros.programas.length > 0 && filtros.programas.length < PROGRAMAS_META.length) {
    cuerpo.programas = [...filtros.programas].sort();
  }
  return JSON.stringify(cuerpo);
}

/** Mensaje de validación del rango, o null si se puede consultar. */
export function errorDeRango(desde: number | null, hasta: number | null): string | null {
  if (desde === null || hasta === null) return "Seleccione el periodo inicial y el final";
  if (mesesEntre(desde, hasta) > MAX_MESES_RANGO) {
    return `El rango no puede superar los ${MAX_MESES_RANGO} meses`;
  }
  return null;
}
