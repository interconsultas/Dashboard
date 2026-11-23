/**
 * Consultas a la BD de productividad, compartidas por GET /api/productividad,
 * GET /api/productividad/profesional y los informes (Excel y PDF). Los
 * filtros llegan ya validados (ver ./filtros validarParametros).
 */
import { query } from "@/lib/db";
import { getCached, setCache } from "@/lib/cache";
import type { FiltrosProductividad, OpcionServicio } from "./filtros";
import { SQL_CARGAS, SQL_PROFESIONALES_CARGA, SUMAS, conNumeros } from "./sql";
import {
  construirProductividad,
  resolverCarga,
  type CargaBD,
  type FilaProfesionalBD,
  type FilaServicioBD,
} from "./construir";
import { construirFicha, type FilaFichaBD } from "./ficha";
import type { RespuestaFichaProfesional, RespuestaProductividad } from "./tipos";

/** Las áreas se editan en Citas › Áreas, que no vacía el caché: TTL corto. */
const CACHE_TTL_MS = 60_000;

/** Áreas de servicio en su orden: lista blanca del filtro de área. */
export async function leerAreas(): Promise<string[]> {
  return (await query<{ nombre: string }>(`SELECT nombre FROM areas_servicio ORDER BY orden, nombre`)).map(
    (r) => r.nombre
  );
}

async function leerCargas() {
  return (await query<CargaBD>(SQL_CARGAS)).map((c) => ({ ...c, periodo: Number(c.periodo) }));
}

/** Tablero de productividad con los filtros dados (con caché). */
export async function consultarProductividad(
  filtros: FiltrosProductividad,
  areas: readonly string[]
): Promise<RespuestaProductividad> {
  const cacheStr = `productividad:${JSON.stringify(filtros)}`;
  const cached = getCached<RespuestaProductividad>(cacheStr);
  if (cached) return cached;

  // Filas por carga × servicio de la granularidad; el profesional se filtra aquí
  const paramsFilas: unknown[] = [filtros.granularidad];
  let filtroProfesional = "";
  if (filtros.profesional !== null) {
    paramsFilas.push(filtros.profesional);
    filtroProfesional = `AND v.documento = $${paramsFilas.length}`;
  }

  const [cargas, serviciosR, filasR] = await Promise.all([
    leerCargas(),
    query<OpcionServicio>(
      `SELECT s.codigo_servicio AS codigo, s.nombre_servicio AS nombre, s.area
       FROM servicios_citas s
       JOIN areas_servicio a ON a.nombre = s.area
       WHERE EXISTS (
         SELECT 1 FROM citas_profesional_servicio c
         WHERE c.codigo_servicio = s.codigo_servicio AND c.granularidad = $1
       )
       ORDER BY a.orden, s.nombre_servicio`,
      [filtros.granularidad]
    ),
    query<FilaServicioBD>(
      `SELECT v.fecha_inicial, v.codigo_servicio, v.nombre_servicio, v.area,
              ${SUMAS}
       FROM v_citas_area v
       WHERE v.granularidad = $1
         ${filtroProfesional}
       GROUP BY v.fecha_inicial, v.codigo_servicio, v.nombre_servicio, v.area`,
      paramsFilas
    ),
  ]);

  const carga = resolverCarga(cargas, filtros.granularidad, filtros.periodo);

  // Profesionales × servicio de la carga seleccionada, con su área principal
  const profesionalesR =
    carga === null
      ? []
      : await query<FilaProfesionalBD>(SQL_PROFESIONALES_CARGA, [
          carga.granularidad,
          carga.fecha_inicial,
          carga.fecha_final,
        ]);

  const result = construirProductividad({
    filtros,
    carga,
    cargas,
    areas: [...areas],
    servicios: serviciosR,
    filas: filasR.map(conNumeros),
    profesionales: profesionalesR.map(conNumeros),
  });

  setCache(cacheStr, result, CACHE_TTL_MS);
  return result;
}

/**
 * Ficha individual de un profesional (con caché). El filtro de profesional
 * no aplica. null si no tiene agenda en los periodos cargados.
 */
export async function consultarFicha(
  documento: string,
  filtrosTablero: FiltrosProductividad
): Promise<RespuestaFichaProfesional | null> {
  const filtros = { ...filtrosTablero, profesional: null };
  const cacheStr = `productividad-ficha:${documento}:${JSON.stringify(filtros)}`;
  const cached = getCached<RespuestaFichaProfesional>(cacheStr);
  if (cached) return cached;

  const [cargas, filasR] = await Promise.all([
    leerCargas(),
    query<FilaFichaBD>(
      `SELECT v.fecha_inicial, v.codigo_servicio, v.nombre_servicio, v.area,
              MAX(v.nombre_profesional) AS nombre,
              ${SUMAS}
       FROM v_citas_area v
       WHERE v.granularidad = $1 AND v.documento = $2
       GROUP BY v.fecha_inicial, v.codigo_servicio, v.nombre_servicio, v.area`,
      [filtros.granularidad, documento]
    ),
  ]);
  if (filasR.length === 0) return null;

  const carga = resolverCarga(cargas, filtros.granularidad, filtros.periodo);
  const paresR =
    carga === null
      ? []
      : await query<FilaProfesionalBD>(SQL_PROFESIONALES_CARGA, [
          carga.granularidad,
          carga.fecha_inicial,
          carga.fecha_final,
        ]);

  const result = construirFicha({
    filtros,
    documento,
    carga,
    cargas,
    filas: filasR.map(conNumeros),
    pares: paresR.map(conNumeros),
  });
  if (result !== null) setCache(cacheStr, result, CACHE_TTL_MS);
  return result;
}
