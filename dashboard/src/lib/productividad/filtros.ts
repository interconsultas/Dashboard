/**
 * Filtros del tablero de productividad. Viven en la query string de la URL
 * para que una vista filtrada se pueda compartir y el botón Atrás funcione.
 */
import { esClavePeriodo, GRANULARIDADES, type Granularidad } from "./periodos";

export interface FiltrosProductividad {
  granularidad: Granularidad;
  /** Clave del periodo (YYYYMM o fecha inicial ISO); null = la carga más reciente. */
  periodo: string | null;
  area: string | null;
  /** codigo_servicio */
  servicio: string | null;
  /** Documento (cédula) del profesional. */
  profesional: string | null;
}

export const FILTROS_VACIOS: FiltrosProductividad = {
  granularidad: "mensual",
  periodo: null,
  area: null,
  servicio: null,
  profesional: null,
};

export interface OpcionServicio {
  codigo: string;
  nombre: string;
  area: string;
}

const PARAMETROS = ["granularidad", "periodo", "area", "servicio", "profesional"] as const;

const RE_SERVICIO = /^[A-Za-z0-9._-]{1,20}$/;
const RE_DOCUMENTO = /^\d{1,15}$/;

function texto(params: URLSearchParams, clave: string): string | null {
  const v = params.get(clave)?.trim();
  return v ? v : null;
}

/** Lectura tolerante para el cliente: lo desconocido vuelve al valor por defecto. */
export function leerFiltros(params: URLSearchParams): FiltrosProductividad {
  return {
    granularidad: params.get("granularidad") === "semanal" ? "semanal" : "mensual",
    periodo: texto(params, "periodo"),
    area: texto(params, "area"),
    servicio: texto(params, "servicio"),
    profesional: texto(params, "profesional"),
  };
}

/** Query string con solo los filtros activos (sin "?"). */
export function aQueryString(f: FiltrosProductividad): string {
  const params = new URLSearchParams();
  if (f.granularidad !== FILTROS_VACIOS.granularidad) params.set("granularidad", f.granularidad);
  if (f.periodo) params.set("periodo", f.periodo);
  if (f.area) params.set("area", f.area);
  if (f.servicio) params.set("servicio", f.servicio);
  if (f.profesional) params.set("profesional", f.profesional);
  return params.toString();
}

/** ¿El texto es un documento (cédula) válido? */
export function esDocumento(valor: string): boolean {
  return RE_DOCUMENTO.test(valor);
}

/**
 * Documento del profesional cuya ficha está abierta (`ficha` en la URL).
 * No es un filtro: abrirla no vuelve a consultar el tablero.
 */
export function leerFicha(params: URLSearchParams): string | null {
  const v = texto(params, "ficha");
  return v !== null && esDocumento(v) ? v : null;
}

/** Query string de los filtros activos con la ficha abierta (o cerrada con null). */
export function queryConFicha(f: FiltrosProductividad, documento: string | null): string {
  const params = new URLSearchParams(aQueryString(f));
  if (documento) params.set("ficha", documento);
  return params.toString();
}

/** Cambia el área; un servicio de otra área deja de aplicar. */
export function aplicarArea(
  f: FiltrosProductividad,
  area: string | null,
  servicios: readonly OpcionServicio[]
): FiltrosProductividad {
  const servicio = servicios.find((s) => s.codigo === f.servicio);
  const conservaServicio = area !== null && servicio?.area === area;
  return { ...f, area, servicio: conservaServicio ? f.servicio : null };
}

/** Cambia el servicio; elegir uno fija también su área. */
export function aplicarServicio(
  f: FiltrosProductividad,
  codigo: string | null,
  servicios: readonly OpcionServicio[]
): FiltrosProductividad {
  if (codigo === null) return { ...f, servicio: null };
  const area = servicios.find((s) => s.codigo === codigo)?.area ?? f.area;
  return { ...f, servicio: codigo, area };
}

/** Validación estricta para la API: cualquier valor no válido es un 400. */
export function validarParametros(
  params: URLSearchParams,
  areasValidas: readonly string[]
): { filtros: FiltrosProductividad } | { error: string } {
  for (const p of PARAMETROS) {
    if (params.getAll(p).length > 1) return { error: `El parámetro ${p} está repetido` };
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

  const area = texto(params, "area");
  if (area !== null && !areasValidas.includes(area)) return { error: "El área no es válida" };

  const servicio = texto(params, "servicio");
  if (servicio !== null && !RE_SERVICIO.test(servicio)) return { error: "El código de servicio no es válido" };

  const profesional = texto(params, "profesional");
  if (profesional !== null && !esDocumento(profesional)) {
    return { error: "El documento del profesional debe contener solo dígitos" };
  }

  return { filtros: { granularidad, periodo, area, servicio, profesional } };
}
