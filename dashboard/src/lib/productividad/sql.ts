/**
 * Consultas compartidas por /api/productividad y /api/productividad/profesional.
 * Los nombres de columna salen de listas fijas, nunca de la solicitud; los
 * valores viajan siempre como parámetros.
 */
import { CLAVES_METRICAS } from "./metricas";

/** SUM de cada métrica sobre v_citas_area (alias v). */
export const SUMAS = CLAVES_METRICAS.map((k) => `SUM(v.${k})::int AS ${k}`).join(",\n                ");

/** Todas las cargas del informe detallado, de ambas granularidades. */
export const SQL_CARGAS = `SELECT DISTINCT granularidad, periodo, fecha_inicial, fecha_final
         FROM citas_profesional_servicio
         ORDER BY fecha_inicial`;

/**
 * Profesionales × servicio de una carga, con su área principal.
 * Parámetros: $1 granularidad, $2 fecha_inicial, $3 fecha_final.
 */
export const SQL_PROFESIONALES_CARGA = `SELECT v.documento::text AS documento,
                    MAX(v.nombre_profesional) AS nombre,
                    v.codigo_servicio, v.area, p.area_principal,
                    ${SUMAS}
             FROM v_citas_area v
             LEFT JOIN v_citas_area_principal p
               ON p.granularidad = v.granularidad
              AND p.fecha_inicial = v.fecha_inicial
              AND p.fecha_final = v.fecha_final
              AND p.tipo_documento = v.tipo_documento
              AND p.documento = v.documento
             WHERE v.granularidad = $1 AND v.fecha_inicial = $2 AND v.fecha_final = $3
             GROUP BY v.documento, v.codigo_servicio, v.area, p.area_principal`;

/** pg puede entregar enteros grandes como texto: se normalizan a número. */
export function conNumeros<T extends object>(fila: T): T {
  const copia = { ...fila } as Record<string, unknown>;
  for (const k of CLAVES_METRICAS) copia[k] = Number(copia[k] ?? 0);
  return copia as T;
}
