/**
 * Periodos del tablero de productividad. Cada carga del informe detallado
 * es un mes (granularidad mensual) o una semana (semanal). La clave que
 * viaja en la URL es el periodo YYYYMM para los meses y la fecha inicial
 * ISO para las semanas.
 */
import { parsePeriodo } from "@/lib/cumplimiento/periodo";

export type Granularidad = "mensual" | "semanal";

export const GRANULARIDADES: readonly Granularidad[] = ["mensual", "semanal"];

export interface IdentidadCarga {
  granularidad: Granularidad;
  periodo: number;
  fecha_inicial: string;
}

export interface RangoCarga extends IdentidadCarga {
  fecha_final: string;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function claveCarga(c: IdentidadCarga): string {
  return c.granularidad === "mensual" ? String(c.periodo) : c.fecha_inicial;
}

function esFechaIso(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

/** ¿El texto es una clave de periodo válida para la granularidad? */
export function esClavePeriodo(granularidad: Granularidad, clave: string): boolean {
  return granularidad === "mensual" ? parsePeriodo(clave) !== null : esFechaIso(clave);
}

function partes(fecha: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return { anio, mes, dia };
}

function rangoSemana(c: RangoCarga): string {
  const ini = partes(c.fecha_inicial);
  const fin = partes(c.fecha_final);
  if (ini.mes === fin.mes && ini.anio === fin.anio) {
    return `${ini.dia}–${fin.dia} ${MESES_CORTOS[fin.mes - 1]}`;
  }
  return `${ini.dia} ${MESES_CORTOS[ini.mes - 1]}–${fin.dia} ${MESES_CORTOS[fin.mes - 1]}`;
}

/** Etiqueta corta para ejes: "Oct 2026" o "5–11 oct". */
export function etiquetaCarga(c: RangoCarga): string {
  if (c.granularidad === "mensual") {
    const mes = MESES_CORTOS[(c.periodo % 100) - 1];
    return `${mes[0].toUpperCase()}${mes.slice(1)} ${Math.floor(c.periodo / 100)}`;
  }
  return rangoSemana(c);
}

/** Etiqueta larga para selectores y títulos: "Octubre 2026" o "5–11 oct 2026". */
export function etiquetaLargaCarga(c: RangoCarga): string {
  if (c.granularidad === "mensual") {
    return `${MESES_LARGOS[(c.periodo % 100) - 1]} ${Math.floor(c.periodo / 100)}`;
  }
  return `${rangoSemana(c)} ${partes(c.fecha_final).anio}`;
}
