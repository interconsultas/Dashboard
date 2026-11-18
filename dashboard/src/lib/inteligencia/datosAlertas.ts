/**
 * Lectura de reglas y evaluación de alertas contra la BD, con caché de 5
 * minutos por granularidad. Lo usan GET /api/inteligencia/alertas y
 * /alertas/conteo; PUT /api/inteligencia/reglas invalida el caché.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCached, setCache } from "@/lib/cache";
import { SQL_CARGAS } from "@/lib/productividad/sql";
import { cargasDe, type CargaBD } from "@/lib/productividad/construir";
import { META_INASISTENCIA } from "@/lib/productividad/metricas";
import { claveCarga, type Granularidad, type RangoCarga } from "@/lib/productividad/periodos";
import {
  evaluarAlertas,
  type EntradaAlertas,
  type FilaProfesionalPeriodo,
  type FilaServicioPeriodo,
  type ResultadoAlertas,
} from "./alertas";
import { IMPACTO_MINIMO, candidatosPrioridad, ofertaPromedioPorProfesional, priorizar, type Candidato } from "./prioridades";
import { MIN_PERIODOS_PROYECCION } from "./proyeccion";
import { CLAVES_REGLAS, filaARegla, type ReglaAlerta } from "./reglas";
import type { RespuestaAlertas } from "./tipos";

export type { RespuestaAlertas };
import { SQL_AREAS, SQL_PROFESIONALES_ALERTA, SQL_REGLAS, SQL_SERIE_SERVICIOS } from "./sql";

export const PREFIJO_CACHE_ALERTAS = "inteligencia:alertas:";
const CACHE_TTL_MS = 300_000;

const num = (v: unknown) => Number(v ?? 0);

/** Reglas en el orden del catálogo; filas con claves desconocidas se ignoran. */
export async function leerReglas(ejecutar: typeof query = query): Promise<ReglaAlerta[]> {
  const filas = await ejecutar<Record<string, unknown>>(SQL_REGLAS);
  const porClave = new Map(filas.map((f) => [String(f.clave), f]));
  return CLAVES_REGLAS.filter((c) => porClave.has(c)).map((c) => filaARegla(porClave.get(c)!));
}

/** Candidatos a prioridad de una evaluación (la oferta promedio es la del periodo evaluado). */
function candidatosDe(e: EntradaAlertas, r: ResultadoAlertas, ultima: RangoCarga): Candidato[] {
  const ofertadas = e.servicios.filter((f) => f.fecha_inicial === ultima.fecha_inicial).reduce((s, f) => s + f.ofertadas, 0);
  return candidatosPrioridad({
    granularidad: e.granularidad,
    periodo: claveCarga(ultima),
    alertas: r.alertas,
    proyeccionAreas: r.proyeccion.areas,
    siguiente: r.siguiente,
    ofertaPorProfesional: ofertaPromedioPorProfesional(ofertadas, e.profesionales.length),
    meta: e.meta,
  });
}

const aServicio = (f: FilaServicioPeriodo): FilaServicioPeriodo => ({
  ...f,
  codigo_servicio: String(f.codigo_servicio),
  asignadas: num(f.asignadas),
  inasistidas: num(f.inasistidas),
  ofertadas: num(f.ofertadas),
  disponibles: num(f.disponibles),
});

const aProfesional = (p: FilaProfesionalPeriodo): FilaProfesionalPeriodo => ({
  ...p,
  documento: String(p.documento),
  asignadas: num(p.asignadas),
  inasistidas: num(p.inasistidas),
});

export async function obtenerAlertas(granularidad: Granularidad): Promise<RespuestaAlertas> {
  const clave = `${PREFIJO_CACHE_ALERTAS}${granularidad}`;
  const cached = getCached<RespuestaAlertas>(clave);
  if (cached) return cached;

  const todas = (await query<CargaBD>(SQL_CARGAS)).map((c) => ({ ...c, periodo: Number(c.periodo) }));
  const cargas = cargasDe(todas, granularidad);
  const ultima = cargas[cargas.length - 1];
  const anterior = cargas.length > 1 ? cargas[cargas.length - 2] : null;
  const profesionalesDe = (c: RangoCarga | null | undefined) =>
    c ? query<FilaProfesionalPeriodo>(SQL_PROFESIONALES_ALERTA, [granularidad, c.fecha_inicial, c.fecha_final]) : Promise.resolve([]);

  const [areasR, reglas, serviciosR, profesionalesR, profesionalesAnteriorR] = await Promise.all([
    query<{ nombre: string }>(SQL_AREAS),
    leerReglas(),
    ultima ? query<FilaServicioPeriodo>(SQL_SERIE_SERVICIOS, [granularidad]) : Promise.resolve([]),
    profesionalesDe(ultima),
    profesionalesDe(anterior),
  ]);

  const entrada: EntradaAlertas = {
    granularidad,
    cargas,
    areas: areasR.map((r) => r.nombre),
    servicios: serviciosR.map(aServicio),
    profesionales: profesionalesR.map(aProfesional),
    reglas,
    meta: META_INASISTENCIA,
  };
  const resultado = evaluarAlertas(entrada);

  // Misma evaluación sobre el periodo anterior, para marcar Nuevo / Empeora / Persiste.
  let candidatosAnteriores: Candidato[] | null = null;
  if (anterior) {
    const entradaAnterior: EntradaAlertas = {
      ...entrada,
      cargas: cargas.slice(0, -1),
      servicios: entrada.servicios.filter((f) => f.fecha_inicial !== ultima.fecha_inicial),
      profesionales: profesionalesAnteriorR.map(aProfesional),
    };
    candidatosAnteriores = candidatosDe(entradaAnterior, evaluarAlertas(entradaAnterior), anterior);
  }
  const prioridades = ultima ? priorizar(candidatosDe(entrada, resultado, ultima), candidatosAnteriores) : [];

  const respuesta: RespuestaAlertas = {
    ...resultado,
    granularidad,
    meta: META_INASISTENCIA,
    periodos_cargados: cargas.length,
    min_periodos_proyeccion: MIN_PERIODOS_PROYECCION,
    reglas,
    prioridades,
    periodo_anterior: anterior ? claveCarga(anterior) : null,
    impacto_minimo: IMPACTO_MINIMO,
  };
  setCache(clave, respuesta, CACHE_TTL_MS);
  return respuesta;
}

/** Respuesta de error de consulta (503 reintentable si las vistas se están actualizando). */
export function errorConsulta(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[inteligencia/alertas] Query failed:", msg);
  if (/timeout|lock|concurrent|materialized/i.test(msg)) {
    return NextResponse.json(
      { error: "Los datos se están actualizando, reintente en unos segundos", retryable: true },
      { status: 503, headers: { "Retry-After": "5" } }
    );
  }
  return NextResponse.json({ error: "Error al consultar los datos" }, { status: 500 });
}
