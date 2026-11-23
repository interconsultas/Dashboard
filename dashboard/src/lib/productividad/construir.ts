/**
 * Arma la respuesta de /api/productividad a partir de las filas que trae la
 * BD. La ruta solo consulta; toda la agregación y la semántica de filtros de
 * cada visual vive aquí:
 *
 *  | visual        | periodo | área | servicio | profesional |
 *  |---------------|---------|------|----------|-------------|
 *  | KPIs / embudo | sí      | sí   | sí       | sí          |
 *  | tendencia     | no      | sí   | sí       | sí          |
 *  | mapa de calor | no      | no   | sí       | sí          |
 *  | árbol         | sí      | no   | no       | sí          |
 *  | matriz        | sí      | sí   | sí       | sí          |
 *
 * El filtro de profesional ya viene aplicado en `filas` (SQL); los
 * profesionales de la carga llegan sin ese filtro para poblar el buscador.
 */
import type { FiltrosProductividad, OpcionServicio } from "./filtros";
import {
  META_INASISTENCIA,
  indicadores,
  metricasVacias,
  sumarMetricas,
  type Indicadores,
  type Metricas,
} from "./metricas";
import { claveCarga, etiquetaCarga, etiquetaLargaCarga, type Granularidad, type RangoCarga } from "./periodos";
import type {
  CeldaCalor,
  NodoArea,
  PeriodoCarga,
  PuntoSerie,
  ResumenProfesional,
  RespuestaProductividad,
} from "./tipos";

/** Profesionales con al menos estas asignadas cuentan para "destacados". */
export const MIN_ASIGNADAS_DESTACADO = 50;
/** Puntos de las sparklines de los KPIs. */
export const PERIODOS_SPARKLINE = 12;

export type CargaBD = RangoCarga;

/** Una fila por carga × servicio (ya filtrada por granularidad y profesional). */
export interface FilaServicioBD extends Metricas {
  fecha_inicial: string;
  codigo_servicio: string;
  nombre_servicio: string;
  area: string;
}

/** Una fila por profesional × servicio en la carga seleccionada. */
export interface FilaProfesionalBD extends Metricas {
  documento: string;
  nombre: string;
  codigo_servicio: string;
  area: string;
  area_principal: string | null;
}

export interface EntradaProductividad {
  filtros: FiltrosProductividad;
  /** Carga seleccionada (resolverCarga) o null si no hay cargas de la granularidad. */
  carga: CargaBD | null;
  /** Todas las cargas, de ambas granularidades. */
  cargas: CargaBD[];
  /** Áreas en el orden de presentación (areas_servicio.orden). */
  areas: string[];
  servicios: OpcionServicio[];
  filas: FilaServicioBD[];
  profesionales: FilaProfesionalBD[];
}

/* ── Periodos ───────────────────────────────── */

export function cargasDe(cargas: readonly CargaBD[], granularidad: Granularidad): CargaBD[] {
  return cargas
    .filter((c) => c.granularidad === granularidad)
    .sort((a, b) => a.fecha_inicial.localeCompare(b.fecha_inicial));
}

/** La carga pedida si existe; si no (o sin pedir ninguna), la más reciente. */
export function resolverCarga(
  cargas: readonly CargaBD[],
  granularidad: Granularidad,
  clave: string | null
): CargaBD | null {
  const lista = cargasDe(cargas, granularidad);
  return lista.find((c) => claveCarga(c) === clave) ?? lista[lista.length - 1] ?? null;
}

export function periodoCarga(c: CargaBD): PeriodoCarga {
  return {
    clave: claveCarga(c),
    etiqueta: etiquetaCarga(c),
    etiqueta_larga: etiquetaLargaCarga(c),
    fecha_inicial: c.fecha_inicial,
    fecha_final: c.fecha_final,
  };
}

/* ── Filtros ────────────────────────────────── */

export interface Aplica {
  area?: boolean;
  servicio?: boolean;
}

export function coincide(
  fila: { area: string; codigo_servicio: string },
  f: FiltrosProductividad,
  aplica: Aplica
): boolean {
  if (aplica.area && f.area !== null && fila.area !== f.area) return false;
  if (aplica.servicio && f.servicio !== null && fila.codigo_servicio !== f.servicio) return false;
  return true;
}

function soloMetricas(m: Metricas): Metricas {
  return sumarMetricas([m]);
}

/* ── Visuales ───────────────────────────────── */

export function serie(
  cargas: readonly CargaBD[],
  filas: readonly FilaServicioBD[],
  f: FiltrosProductividad
): PuntoSerie[] {
  return cargas.map((c) => {
    const delPeriodo = filas.filter((r) => r.fecha_inicial === c.fecha_inicial && coincide(r, f, { area: true, servicio: true }));
    return { clave: claveCarga(c), etiqueta: etiquetaCarga(c), ...indicadores(sumarMetricas(delPeriodo)) };
  });
}

function nodosArea(
  areas: readonly string[],
  filas: readonly FilaServicioBD[],
  conValor: (i: Indicadores) => boolean
): NodoArea[] {
  const nodos: NodoArea[] = [];
  for (const area of areas) {
    const porServicio = new Map<string, { nombre: string; filas: Metricas[] }>();
    for (const r of filas) {
      if (r.area !== area) continue;
      const s = porServicio.get(r.codigo_servicio) ?? { nombre: r.nombre_servicio, filas: [] };
      s.filas.push(soloMetricas(r));
      porServicio.set(r.codigo_servicio, s);
    }
    const servicios = Array.from(porServicio, ([codigo, s]) => ({
      codigo,
      nombre: s.nombre,
      ...indicadores(sumarMetricas(s.filas)),
    }))
      .filter(conValor)
      .sort((a, b) => b.perdidas - a.perdidas || a.nombre.localeCompare(b.nombre));
    if (servicios.length === 0) continue;
    const total = indicadores(sumarMetricas(servicios));
    if (!conValor(total)) continue;
    nodos.push({ area, ...total, servicios });
  }
  return nodos;
}

function mapaCalor(
  areas: readonly string[],
  cargas: readonly CargaBD[],
  filas: readonly FilaServicioBD[],
  f: FiltrosProductividad
): CeldaCalor[] {
  const celdas: CeldaCalor[] = [];
  for (const area of areas) {
    for (const c of cargas) {
      const t = sumarMetricas(
        filas.filter((r) => r.area === area && r.fecha_inicial === c.fecha_inicial && coincide(r, f, { servicio: true }))
      );
      if (t.asignadas === 0) continue;
      celdas.push({
        area,
        clave: claveCarga(c),
        pct_inasistencia: t.inasistidas / t.asignadas,
        inasistidas: t.inasistidas,
        asignadas: t.asignadas,
      });
    }
  }
  return celdas;
}

function resumenProfesionales(filas: readonly FilaProfesionalBD[], f: FiltrosProductividad): ResumenProfesional[] {
  const porDocumento = new Map<string, { nombre: string; area_principal: string | null; filas: Metricas[] }>();
  for (const r of filas) {
    if (f.profesional !== null && r.documento !== f.profesional) continue;
    if (!coincide(r, f, { area: true, servicio: true })) continue;
    const p = porDocumento.get(r.documento) ?? { nombre: r.nombre, area_principal: r.area_principal, filas: [] };
    p.filas.push(soloMetricas(r));
    porDocumento.set(r.documento, p);
  }
  return Array.from(porDocumento, ([documento, p]) => ({
    documento,
    nombre: p.nombre,
    area_principal: p.area_principal,
    ...indicadores(sumarMetricas(p.filas)),
  }))
    .filter((p) => p.asignadas + p.disponibles > 0)
    .sort((a, b) => b.perdidas - a.perdidas || a.nombre.localeCompare(b.nombre));
}

function opcionesProfesionales(filas: readonly FilaProfesionalBD[]) {
  const vistos = new Map<string, string>();
  for (const r of filas) if (!vistos.has(r.documento)) vistos.set(r.documento, r.nombre);
  return Array.from(vistos, ([documento, nombre]) => ({ documento, nombre })).sort(
    (a, b) => a.nombre.localeCompare(b.nombre) || a.documento.localeCompare(b.documento)
  );
}

/* ── Respuesta ──────────────────────────────── */

export function construirProductividad(e: EntradaProductividad): RespuestaProductividad {
  const { filtros: f, carga, areas, servicios } = e;
  const mensuales = cargasDe(e.cargas, "mensual");
  const semanales = cargasDe(e.cargas, "semanal");
  const cargas = f.granularidad === "mensual" ? mensuales : semanales;

  const base = {
    granularidad: f.granularidad,
    periodos: { mensual: mensuales.map(periodoCarga), semanal: semanales.map(periodoCarga) },
  };
  const opcionesBase = { areas: [...areas], servicios: [...servicios] };

  if (carga === null) {
    return {
      ...base,
      periodo: null,
      opciones: { ...opcionesBase, profesionales: [] },
      kpis: { actual: null, anterior: null, periodo_anterior: null, serie: [] },
      tendencia: [],
      embudo: null,
      mapa_calor: { areas: [...areas], periodos: [], celdas: [] },
      arbol: [],
      matriz: { areas: [], total: null },
      profesionales: { con_agenda: 0, destacados: 0, lista: [] },
    };
  }

  const tendencia = serie(cargas, e.filas, f);
  const idx = cargas.findIndex((c) => c.fecha_inicial === carga.fecha_inicial);
  const actual = tendencia[idx];
  const anterior = idx > 0 ? tendencia[idx - 1] : null;

  const delPeriodo = e.filas.filter((r) => r.fecha_inicial === carga.fecha_inicial);
  const filtradas = delPeriodo.filter((r) => coincide(r, f, { area: true, servicio: true }));
  const matrizAreas = nodosArea(areas, filtradas, () => true);

  const lista = resumenProfesionales(e.profesionales, f);
  const sinClave = ({ clave: _c, etiqueta: _e, ...resto }: PuntoSerie): Indicadores => resto;

  return {
    ...base,
    periodo: claveCarga(carga),
    opciones: { ...opcionesBase, profesionales: opcionesProfesionales(e.profesionales) },
    kpis: {
      actual: sinClave(actual),
      anterior: anterior ? sinClave(anterior) : null,
      periodo_anterior: anterior ? anterior.clave : null,
      serie: tendencia.slice(Math.max(0, idx + 1 - PERIODOS_SPARKLINE), idx + 1),
    },
    tendencia,
    embudo: {
      ofertadas: actual.ofertadas,
      asignadas: actual.asignadas,
      atendidas: actual.atendidas,
      disponibles: actual.disponibles,
      inasistidas: actual.inasistidas,
    },
    mapa_calor: {
      areas: [...areas],
      periodos: cargas.map((c) => ({ clave: claveCarga(c), etiqueta: etiquetaCarga(c) })),
      celdas: mapaCalor(areas, cargas, e.filas, f),
    },
    arbol: nodosArea(areas, delPeriodo, (i) => i.perdidas > 0),
    matriz: {
      areas: matrizAreas,
      total: matrizAreas.length > 0 ? indicadores(sumarMetricas(matrizAreas)) : indicadores(metricasVacias()),
    },
    profesionales: {
      con_agenda: lista.length,
      destacados: lista.filter(
        (p) => p.asignadas >= MIN_ASIGNADAS_DESTACADO && p.pct_inasistencia !== null && p.pct_inasistencia < META_INASISTENCIA
      ).length,
      lista,
    },
  };
}
