/**
 * Parámetros de GET /api/inteligencia/grafo y estado de la página en la URL
 * (`?nodo=tipo:clave&periodo=...`). Módulo puro: lo usan la API y el cliente.
 */
import { esClavePeriodo, GRANULARIDADES, type Granularidad } from "@/lib/productividad/periodos";
import { esClaveValida, esTipoObjeto, parseIdNodo, type TipoObjeto } from "./ontologia";

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
