/**
 * Parámetros de GET /api/inteligencia/grafo y estado de la página en la URL
 * (`?nodo=tipo:clave&periodo=...`). Módulo puro: lo usan la API y el cliente.
 */
import { esClavePeriodo, GRANULARIDADES, type Granularidad } from "@/lib/productividad/periodos";
import { esClaveValida, esTipoObjeto, parseIdNodo, type TipoObjeto } from "./ontologia";
import type { Palancas } from "./simulador";

export type Modo = "esquema" | "vecindario" | "buscar";

export const MODOS: readonly Modo[] = ["esquema", "vecindario", "buscar"];

/** Vecinos por tipo de relación en un vecindario. */
export const LIMITE_VECINOS = 25;
/** Resultados de una búsqueda. */
export const LIMITE_BUSQUEDA = 20;
export const MAX_LIMITE = 100;
const MIN_BUSQUEDA = 2;
const MAX_BUSQUEDA = 80;

export interface ParametrosGrafo {
  modo: Modo;
  granularidad: Granularidad;
  /** Clave del periodo (YYYYMM o fecha inicial ISO); null = la carga más reciente. */
  periodo: string | null;
  tipo: TipoObjeto | null;
  id: string | null;
  q: string;
  limite: number;
}

const PARAMETROS = ["modo", "granularidad", "periodo", "tipo", "id", "q", "limite"] as const;

function texto(params: URLSearchParams, clave: string): string | null {
  const v = params.get(clave)?.trim();
  return v ? v : null;
}

/** Validación estricta para la API: cualquier valor no válido es un 400. */
export function validarParametrosGrafo(
  params: URLSearchParams
): { parametros: ParametrosGrafo } | { error: string } {
  for (const p of PARAMETROS) {
    if (params.getAll(p).length > 1) return { error: `El parámetro ${p} está repetido` };
  }

  const modo = texto(params, "modo") ?? "esquema";
  if (!(MODOS as readonly string[]).includes(modo)) {
    return { error: "El modo debe ser esquema, vecindario o buscar" };
  }

  const gran = texto(params, "granularidad") ?? "mensual";
  if (!(GRANULARIDADES as readonly string[]).includes(gran)) {
    return { error: "La granularidad debe ser mensual o semanal" };
  }
  const granularidad = gran as Granularidad;

  const periodo = texto(params, "periodo");
  if (periodo !== null && !esClavePeriodo(granularidad, periodo)) {
    return {
      error:
        granularidad === "mensual"
          ? "El periodo debe tener el formato AAAAMM"
          : "La semana debe ser una fecha AAAA-MM-DD",
    };
  }

  const base: ParametrosGrafo = {
    modo: modo as Modo,
    granularidad,
    periodo,
    tipo: null,
    id: null,
    q: "",
    limite: modo === "buscar" ? LIMITE_BUSQUEDA : LIMITE_VECINOS,
  };
  if (modo === "esquema") return { parametros: base };

  const limiteTexto = texto(params, "limite");
  if (limiteTexto !== null) {
    const limite = Number(limiteTexto);
    if (!/^\d+$/.test(limiteTexto) || limite < 1 || limite > MAX_LIMITE) {
      return { error: `El límite debe ser un entero entre 1 y ${MAX_LIMITE}` };
    }
    base.limite = limite;
  }

  const tipo = texto(params, "tipo");
  if (tipo !== null && !esTipoObjeto(tipo)) return { error: "El tipo de elemento no es válido" };

  if (modo === "vecindario") {
    if (tipo === null) return { error: "El tipo de elemento no es válido" };
    // El id no se recorta: puede ser un nombre con espacios (solo se exige que no sea vacío)
    const id = params.get("id");
    if (id === null || !esClaveValida(tipo, id)) return { error: "El identificador no es válido para el tipo" };
    return { parametros: { ...base, tipo, id } };
  }

  const q = texto(params, "q") ?? "";
  if (q.length > MAX_BUSQUEDA) return { error: `La búsqueda no puede superar los ${MAX_BUSQUEDA} caracteres` };
  if (q.length < MIN_BUSQUEDA && tipo === null) return { error: "Escriba al menos 2 caracteres o elija un tipo" };
  return { parametros: { ...base, tipo, q } };
}

/* ── Estado de la página ────────────────────── */

export interface EstadoInteligencia {
  granularidad: Granularidad;
  periodo: string | null;
  /** Nodo seleccionado "tipo:clave"; null = vista del modelo (esquema). */
  nodo: string | null;
}

/** Lectura tolerante para el cliente: lo no válido vuelve al valor por defecto. */
export function leerEstado(params: URLSearchParams): EstadoInteligencia {
  const granularidad: Granularidad = params.get("granularidad") === "semanal" ? "semanal" : "mensual";
  const periodo = texto(params, "periodo");
  const nodo = params.get("nodo");
  return {
    granularidad,
    periodo: periodo !== null && esClavePeriodo(granularidad, periodo) ? periodo : null,
    nodo: nodo !== null && parseIdNodo(nodo) !== null ? nodo : null,
  };
}

/** Query string con solo lo que no es por defecto (sin "?"). */
export function queryEstado(e: EstadoInteligencia): string {
  const params = new URLSearchParams();
  if (e.granularidad !== "mensual") params.set("granularidad", e.granularidad);
  if (e.periodo) params.set("periodo", e.periodo);
  if (e.nodo) params.set("nodo", e.nodo);
  return params.toString();
}

/* ── Pestañas y simulador ───────────────────── */

export type Pestana = "mapa" | "simulador" | "alertas";

export function leerPestana(params: URLSearchParams): Pestana {
  const p = params.get("pestana");
  return p === "simulador" || p === "alertas" ? p : "mapa";
}

/** Alertas: solo la granularidad; siempre se evalúa el último periodo cargado. */
export interface EstadoAlertas {
  granularidad: Granularidad;
}

export function leerEstadoAlertas(params: URLSearchParams): EstadoAlertas {
  return { granularidad: params.get("granularidad") === "semanal" ? "semanal" : "mensual" };
}

export function queryEstadoAlertas(e: EstadoAlertas): string {
  const params = new URLSearchParams({ pestana: "alertas" });
  if (e.granularidad !== "mensual") params.set("granularidad", e.granularidad);
  return params.toString();
}

/** Query string (sin "?") para abrir otra pestaña conservando granularidad y periodo. */
export function queryPestana(p: Pestana, ctx: { granularidad: Granularidad; periodo: string | null }): string {
  if (p === "alertas") return queryEstadoAlertas({ granularidad: ctx.granularidad });
  if (p === "simulador") {
    return queryEstadoSimulador({ granularidad: ctx.granularidad, periodo: ctx.periodo, area: null, servicio: null, palancas: {} });
  }
  return queryEstado({ granularidad: ctx.granularidad, periodo: ctx.periodo, nodo: null });
}

/**
 * Estado del simulador en la URL. Solo se guardan las palancas que el usuario
 * movió: las ausentes siguen al valor real del periodo y filtro elegidos.
 * Δ profesionales y Δ oferta son relativos a la base, así que se conservan al
 * cambiar de periodo o área (recortados a los nuevos límites); los % objetivo
 * se conservan como metas absolutas.
 */
export interface EstadoSimulador {
  granularidad: Granularidad;
  periodo: string | null;
  area: string | null;
  /** codigo_servicio */
  servicio: string | null;
  palancas: Partial<Palancas>;
}

const RE_SERVICIO = /^[A-Za-z0-9._-]{1,20}$/;
const MAX_AREA = 80;
const RE_ENTERO = /^-?\d{1,4}$/;
const RE_PORCENTAJE = /^-?\d{1,3}(\.\d{1,2})?$/;

/** Palancas en la URL: Δ profesionales entero; el resto en % (10 = 0,1). */
const PALANCAS_URL: { clave: keyof Palancas; param: string; porcentaje: boolean; min: number }[] = [
  { clave: "deltaProfesionales", param: "prof", porcentaje: false, min: -Infinity },
  { clave: "deltaOferta", param: "oferta", porcentaje: true, min: -100 },
  { clave: "pctDisponibilidad", param: "disp", porcentaje: true, min: 0 },
  { clave: "pctInasistencia", param: "inas", porcentaje: true, min: 0 },
];

export function leerEstadoSimulador(params: URLSearchParams): EstadoSimulador {
  const granularidad: Granularidad = params.get("granularidad") === "semanal" ? "semanal" : "mensual";
  const periodo = texto(params, "periodo");
  const area = texto(params, "area");
  const servicio = texto(params, "servicio");
  const palancas: Partial<Palancas> = {};
  for (const { clave, param, porcentaje, min } of PALANCAS_URL) {
    const v = texto(params, param);
    if (v === null || !(porcentaje ? RE_PORCENTAJE : RE_ENTERO).test(v)) continue;
    const n = Number(v);
    if (n < min || (porcentaje && n > 100)) continue;
    palancas[clave] = porcentaje ? n / 100 : n;
  }
  return {
    granularidad,
    periodo: periodo !== null && esClavePeriodo(granularidad, periodo) ? periodo : null,
    area: area !== null && area.length <= MAX_AREA ? area : null,
    servicio: servicio !== null && RE_SERVICIO.test(servicio) ? servicio : null,
    palancas,
  };
}

/** Query string del simulador (sin "?"), con la pestaña y lo que no es por defecto. */
export function queryEstadoSimulador(e: EstadoSimulador): string {
  const params = new URLSearchParams({ pestana: "simulador" });
  if (e.granularidad !== "mensual") params.set("granularidad", e.granularidad);
  if (e.periodo) params.set("periodo", e.periodo);
  if (e.area) params.set("area", e.area);
  if (e.servicio) params.set("servicio", e.servicio);
  for (const { clave, param, porcentaje } of PALANCAS_URL) {
    const v = e.palancas[clave];
    if (v === undefined || !Number.isFinite(v)) continue;
    params.set(param, porcentaje ? String(Math.round(v * 1000) / 10) : String(Math.round(v)));
  }
  return params.toString();
}
