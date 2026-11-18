/**
 * Arma la ficha individual de un profesional (GET /api/productividad/profesional).
 *
 * Totales, servicios, tendencia, institución y percentil respetan los
 * filtros de área y servicio del tablero, igual que el punto del
 * dispersograma desde el que se abre. El filtro de profesional no aplica:
 * la comparación es siempre contra todos sus pares.
 */
import {
  cargasDe,
  coincide,
  serie,
  type CargaBD,
  type FilaProfesionalBD,
  type FilaServicioBD,
} from "./construir";
import type { FiltrosProductividad } from "./filtros";
import { indicadores, sumarMetricas, type Metricas } from "./metricas";
import { claveCarga, etiquetaLargaCarga } from "./periodos";
import { MIN_ASIGNADAS_PERCENTIL, percentilInasistencia } from "./profesionales";
import type { NodoServicio, RespuestaFichaProfesional } from "./tipos";

/** Una fila por carga × servicio del profesional (todas las cargas de la granularidad). */
export interface FilaFichaBD extends FilaServicioBD {
  nombre: string;
}

export interface EntradaFicha {
  filtros: FiltrosProductividad;
  documento: string;
  /** Carga seleccionada (resolverCarga) o null si no hay cargas de la granularidad. */
  carga: CargaBD | null;
  cargas: CargaBD[];
  filas: FilaFichaBD[];
  /** Todos los profesionales × servicio de la carga seleccionada. */
  pares: FilaProfesionalBD[];
}

const FILTRO_AREA_SERVICIO = { area: true, servicio: true };

function soloMetricas(m: Metricas): Metricas {
  return sumarMetricas([m]);
}

function serviciosDe(filas: readonly FilaServicioBD[]): NodoServicio[] {
  const porCodigo = new Map<string, { nombre: string; filas: Metricas[] }>();
  for (const r of filas) {
    const s = porCodigo.get(r.codigo_servicio) ?? { nombre: r.nombre_servicio, filas: [] };
    s.filas.push(soloMetricas(r));
    porCodigo.set(r.codigo_servicio, s);
  }
  return Array.from(porCodigo, ([codigo, s]) => ({ codigo, nombre: s.nombre, ...indicadores(sumarMetricas(s.filas)) })).sort(
    (a, b) => b.asignadas - a.asignadas || a.nombre.localeCompare(b.nombre)
  );
}

function totalesPorDocumento(pares: readonly FilaProfesionalBD[]) {
  const porDocumento = new Map<string, Metricas[]>();
  for (const r of pares) {
    const lista = porDocumento.get(r.documento) ?? [];
    lista.push(soloMetricas(r));
    porDocumento.set(r.documento, lista);
  }
  return Array.from(porDocumento.values(), (filas) => indicadores(sumarMetricas(filas)));
}

export function construirFicha(e: EntradaFicha): RespuestaFichaProfesional | null {
  if (e.filas.length === 0) return null;
  const f: FiltrosProductividad = { ...e.filtros, profesional: null };
  const cargas = cargasDe(e.cargas, f.granularidad);

  const propias = e.pares.filter((r) => r.documento === e.documento);
  const masReciente = [...e.filas].sort((a, b) => b.fecha_inicial.localeCompare(a.fecha_inicial))[0];
  const identidad = {
    documento: e.documento,
    nombre: propias[0]?.nombre ?? masReciente.nombre,
    area_principal: propias[0]?.area_principal ?? null,
    granularidad: f.granularidad,
    tendencia: serie(cargas, e.filas, f),
  };

  if (e.carga === null) {
    return {
      ...identidad,
      periodo: null,
      etiqueta_periodo: null,
      actual: null,
      institucion: { pct_inasistencia: null },
      percentil: null,
      pares: 0,
      servicios: [],
    };
  }

  const carga = e.carga;
  const delPeriodo = e.filas.filter((r) => r.fecha_inicial === carga.fecha_inicial && coincide(r, f, FILTRO_AREA_SERVICIO));
  const actual = delPeriodo.length > 0 ? indicadores(sumarMetricas(delPeriodo.map(soloMetricas))) : null;

  const paresFiltrados = e.pares.filter((r) => coincide(r, f, FILTRO_AREA_SERVICIO));
  const totales = totalesPorDocumento(paresFiltrados);

  return {
    ...identidad,
    periodo: claveCarga(carga),
    etiqueta_periodo: etiquetaLargaCarga(carga),
    actual,
    institucion: { pct_inasistencia: indicadores(sumarMetricas(paresFiltrados.map(soloMetricas))).pct_inasistencia },
    percentil: actual ? percentilInasistencia(actual, totales) : null,
    pares: totales.filter((t) => t.asignadas >= MIN_ASIGNADAS_PERCENTIL).length,
    servicios: serviciosDe(delPeriodo),
  };
}
