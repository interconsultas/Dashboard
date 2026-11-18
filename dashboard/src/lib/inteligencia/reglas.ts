/**
 * Reglas de alerta de Inteligencia (tabla reglas_alerta, etl/sql/020).
 * Módulo puro: catálogo, conversión de filas y validación de PUT
 * /api/inteligencia/reglas. La evaluación vive en ./alertas.
 */

export const CLAVES_REGLAS = [
  "inasistencia_servicio",
  "disponibilidad_servicio",
  "inasistencia_profesional",
  "proyeccion_sobre_meta",
] as const;

export type ClaveRegla = (typeof CLAVES_REGLAS)[number];

export type Gravedad = "alta" | "media";

export interface ReglaAlerta {
  clave: ClaveRegla;
  nombre: string;
  descripcion: string;
  activa: boolean;
  /** Fracción (0,2 = 20 %). null solo en la proyección: usa la meta institucional. */
  umbral: number | null;
  /** Periodos consecutivos que debe cumplirse; null si la regla no lo usa. */
  periodos: number | null;
  /** Volumen mínimo (asignadas u ofertadas); null si la regla no lo usa. */
  minimo: number | null;
  gravedad: Gravedad;
  actualizado_en: string | null;
  actualizado_por: string | null;
}

/** Qué parámetros usa cada regla (lo demás debe ir vacío). */
export const PARAMETROS_REGLA: Record<ClaveRegla, { umbralOpcional: boolean; periodos: boolean; minimo: boolean }> = {
  inasistencia_servicio: { umbralOpcional: false, periodos: true, minimo: true },
  disponibilidad_servicio: { umbralOpcional: false, periodos: false, minimo: true },
  inasistencia_profesional: { umbralOpcional: false, periodos: false, minimo: true },
  proyeccion_sobre_meta: { umbralOpcional: true, periodos: false, minimo: false },
};

export const MAX_PERIODOS_REGLA = 6;
const MAX_MINIMO = 1_000_000;

type Semilla = Pick<ReglaAlerta, "nombre" | "descripcion" | "activa" | "umbral" | "periodos" | "minimo" | "gravedad">;

/** Semilla de 020_reglas_alerta.sql (la prueba de la migración verifica que coincidan). */
export const REGLAS_POR_DEFECTO: Record<ClaveRegla, Semilla> = {
  inasistencia_servicio: {
    nombre: "Inasistencia alta sostenida por servicio",
    descripcion:
      "Servicio con % de inasistencia sobre el umbral en los últimos periodos consecutivos, con un mínimo de citas asignadas en cada uno.",
    activa: true,
    umbral: 0.2,
    periodos: 2,
    minimo: 30,
    gravedad: "alta",
  },
  disponibilidad_servicio: {
    nombre: "Citas sin asignar por servicio",
    descripcion: "Servicio con % de disponibilidad (ofertadas sin asignar) sobre el umbral en el último periodo, con un mínimo de citas ofertadas.",
    activa: true,
    umbral: 0.15,
    periodos: null,
    minimo: 30,
    gravedad: "media",
  },
  inasistencia_profesional: {
    nombre: "Inasistencia alta por profesional",
    descripcion: "Profesional con % de inasistencia sobre el umbral en el último periodo, con un mínimo de citas asignadas.",
    activa: true,
    umbral: 0.3,
    periodos: null,
    minimo: 50,
    gravedad: "media",
  },
  proyeccion_sobre_meta: {
    nombre: "Proyección por encima de la meta",
    descripcion:
      "Área cuya inasistencia proyectada para el siguiente periodo supera el umbral (vacío = la meta institucional) y viene en alza.",
    activa: true,
    umbral: null,
    periodos: null,
    minimo: null,
    gravedad: "alta",
  },
};

export function esClaveRegla(v: unknown): v is ClaveRegla {
  return typeof v === "string" && (CLAVES_REGLAS as readonly string[]).includes(v);
}

const numONulo = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** Fila de reglas_alerta → regla (pg entrega NUMERIC como texto). */
export function filaARegla(f: Record<string, unknown>): ReglaAlerta {
  return {
    clave: f.clave as ClaveRegla,
    nombre: String(f.nombre),
    descripcion: String(f.descripcion),
    activa: Boolean(f.activa),
    umbral: numONulo(f.umbral),
    periodos: numONulo(f.periodos),
    minimo: numONulo(f.minimo),
    gravedad: f.gravedad === "alta" ? "alta" : "media",
    actualizado_en: f.actualizado_en == null ? null : f.actualizado_en instanceof Date ? f.actualizado_en.toISOString() : String(f.actualizado_en),
    actualizado_por: f.actualizado_por == null ? null : String(f.actualizado_por),
  };
}

export interface CambioRegla {
  clave: ClaveRegla;
  activa: boolean;
  umbral: number | null;
  periodos: number | null;
  minimo: number | null;
}

const esEntero = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const vacio = (v: unknown) => v === null || v === undefined;

/** Valida el cuerpo de PUT /api/inteligencia/reglas: { reglas: [{ clave, activa, umbral, periodos, minimo }] }. */
export function validarCambiosReglas(cuerpo: unknown): { cambios: CambioRegla[] } | { error: string } {
  const lista = (cuerpo as { reglas?: unknown } | null)?.reglas;
  if (!Array.isArray(lista) || lista.length === 0) return { error: "Debe enviar al menos una regla" };

  const cambios: CambioRegla[] = [];
  const vistas = new Set<string>();
  for (let i = 0; i < lista.length; i++) {
    const n = `Fila ${i + 1}`;
    const fila = lista[i] as Record<string, unknown> | null;
    if (!fila || typeof fila !== "object") return { error: `${n}: formato no válido` };
    const { clave, activa, umbral, periodos, minimo } = fila;
    if (!esClaveRegla(clave)) return { error: `${n}: la regla no existe` };
    if (vistas.has(clave)) return { error: `${n}: la regla está repetida` };
    vistas.add(clave);
    if (typeof activa !== "boolean") return { error: `${n}: indique si la regla está activa` };

    const usa = PARAMETROS_REGLA[clave];
    const umbralVacio = usa.umbralOpcional && vacio(umbral);
    if (!umbralVacio && !(typeof umbral === "number" && Number.isFinite(umbral) && umbral >= 0 && umbral <= 1)) {
      return { error: `${n}: el umbral debe estar entre 0 % y 100 %` };
    }

    if (usa.periodos) {
      if (!esEntero(periodos) || periodos < 1 || periodos > MAX_PERIODOS_REGLA) {
        return { error: `${n}: los periodos deben ser un entero entre 1 y ${MAX_PERIODOS_REGLA}` };
      }
    } else if (!vacio(periodos)) {
      return { error: `${n}: esta regla no usa periodos` };
    }

    if (usa.minimo) {
      if (!esEntero(minimo) || minimo < 0 || minimo > MAX_MINIMO) {
        return { error: `${n}: el mínimo debe ser un entero mayor o igual que 0` };
      }
    } else if (!vacio(minimo)) {
      return { error: `${n}: esta regla no usa mínimo` };
    }

    cambios.push({
      clave,
      activa,
      umbral: umbralVacio ? null : (umbral as number),
      periodos: usa.periodos ? (periodos as number) : null,
      minimo: usa.minimo ? (minimo as number) : null,
    });
  }
  return { cambios };
}
