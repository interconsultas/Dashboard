/**
 * Consultas del mapa de relaciones. Se ejecutan una vez por periodo y
 * criterio de atribución (la API guarda el grafo en caché). Los nombres de
 * vistas y columnas salen de listas fijas, nunca de la solicitud; los
 * valores viajan siempre como parámetros.
 *
 * Carga = mes o semana del informe detallado de citas. Las autorizaciones son
 * mensuales: para una semana se usan las del mes de la carga (carga.periodo).
 */
import { COLUMNA_ORDENES, joinOrdenes, type Atribucion } from "@/lib/cumplimiento/config";
import { VISTA_CATEGORIA } from "./ontologia";

export const SQL_AREAS = `SELECT nombre FROM areas_servicio ORDER BY orden, nombre`;

/** Profesional × servicio de la carga. $1 granularidad, $2 fecha_inicial, $3 fecha_final. */
export const SQL_ATIENDE = `SELECT v.documento::text AS documento,
                MAX(v.nombre_profesional) AS nombre,
                v.codigo_servicio,
                MAX(v.nombre_servicio) AS nombre_servicio,
                v.area,
                SUM(v.asignadas)::int AS asignadas,
                SUM(v.inasistidas)::int AS inasistidas,
                SUM(v.disponibles)::int AS disponibles
         FROM v_citas_area v
         WHERE v.granularidad = $1 AND v.fecha_inicial = $2 AND v.fecha_final = $3
         GROUP BY v.documento, v.codigo_servicio, v.area`;

/** Especialidad de cada médico del catálogo (sin nombres: el nombre sale de las citas). */
export const SQL_MEDICOS = `SELECT identificacion::text AS documento,
                UPPER(TRIM(programa_especialidad)) AS especialidad
         FROM medicos
         WHERE NULLIF(TRIM(programa_especialidad), '') IS NOT NULL`;

export const SQL_MAPEO = `SELECT UPPER(TRIM(programa_especialidad)) AS especialidad, programa
         FROM programa_meta_mapeo
         WHERE programa IS NOT NULL`;

/** Metas activas del año. $1 año, $2 programa informativo excluido (TOTAL MGI). */
export const SQL_METAS = `SELECT programa, tipo_prestacion AS categoria, valor_meta, escala
         FROM metas
         WHERE activo = TRUE AND anio = $1 AND programa <> $2`;

/**
 * Órdenes por profesional con citas en la carga y categoría, con el mismo
 * criterio de atribución que Cumplimiento (COLUMNA_ORDENES + joinOrdenes).
 * $1 periodo YYYYMM, $2 granularidad, $3 fecha_inicial, $4 fecha_final.
 */
export function sqlOrdenes(atribucion: Atribucion): string {
  const columna = COLUMNA_ORDENES[atribucion];
  return `SELECT c.documento::text AS documento, o.categoria,
                SUM(o.ordenes)::bigint AS ordenes,
                SUM(o.cantidad)::bigint AS cantidad
         FROM (
           SELECT documento, MAX(nombre_profesional) AS nombre_medico
           FROM v_citas_area
           WHERE granularidad = $2 AND fecha_inicial = $3 AND fecha_final = $4
           GROUP BY documento
         ) c
         LEFT JOIN medicos m ON m.identificacion = c.documento
         JOIN (
           SELECT categoria, ${columna}, SUM(ordenes) AS ordenes, SUM(cantidad) AS cantidad
           FROM vm_cumpl_ordenes
           WHERE periodo = $1
           GROUP BY 1, 2
         ) o ON ${joinOrdenes(atribucion, "o", "c", "m")}
         GROUP BY c.documento, o.categoria`;
}

/** Órdenes por categoría y regional del afiliado, de las 7 vistas vm_dash_*. $1 periodo YYYYMM. */
export const SQL_REGIONALES = Object.entries(VISTA_CATEGORIA)
  .map(
    ([categoria, vista]) => `SELECT '${categoria}' AS categoria, desc_regional_afiliado AS regional,
                SUM(total_autorizaciones)::bigint AS ordenes,
                SUM(total_cantidad)::bigint AS cantidad
         FROM ${vista}
         WHERE periodo = $1
         GROUP BY desc_regional_afiliado`
  )
  .join("\n         UNION ALL\n         ");

/* ── Alertas ─────────────────────────────────── */

/** Serie por periodo × servicio de todas las cargas de la granularidad. $1 granularidad. */
export const SQL_SERIE_SERVICIOS = `SELECT v.fecha_inicial, v.area, v.codigo_servicio,
                MAX(v.nombre_servicio) AS nombre_servicio,
                SUM(v.asignadas)::int AS asignadas,
                SUM(v.inasistidas)::int AS inasistidas,
                SUM(v.ofertadas)::int AS ofertadas,
                SUM(v.disponibles)::int AS disponibles
         FROM v_citas_area v WHERE v.granularidad = $1
         GROUP BY v.fecha_inicial, v.area, v.codigo_servicio`;

/** Totales por profesional de una carga con su área principal. $1 granularidad, $2 fecha_inicial, $3 fecha_final. */
export const SQL_PROFESIONALES_ALERTA = `SELECT v.documento::text AS documento,
                MAX(v.nombre_profesional) AS nombre,
                MAX(p.area_principal) AS area_principal,
                SUM(v.asignadas)::int AS asignadas,
                SUM(v.inasistidas)::int AS inasistidas
         FROM v_citas_area v
         LEFT JOIN v_citas_area_principal p
           ON p.granularidad = v.granularidad
          AND p.fecha_inicial = v.fecha_inicial
          AND p.fecha_final = v.fecha_final
          AND p.tipo_documento = v.tipo_documento
          AND p.documento = v.documento
         WHERE v.granularidad = $1 AND v.fecha_inicial = $2 AND v.fecha_final = $3
         GROUP BY v.documento`;

export const SQL_REGLAS = `SELECT clave, nombre, descripcion, activa, umbral, periodos, minimo, gravedad,
                actualizado_en, actualizado_por
         FROM reglas_alerta`;
