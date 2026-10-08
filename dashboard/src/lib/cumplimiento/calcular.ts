/**
 * Cálculo del cumplimiento de metas por profesional. Funciones puras, sin BD.
 *
 * Reglas (réplica de la hoja de cálculo del cliente):
 *  - tasa = órdenes ÷ citas ('ratio') u órdenes × 100 ÷ citas ('x100').
 *  - pct = tasa ÷ meta del programa del médico. La meta es un techo:
 *    1.0 = exactamente en la meta; un valor menor es mejor.
 *  - global = promedio simple de los pct definidos de la fila.
 *  - Todo agregado (varios meses o varios médicos) es el promedio simple de
 *    los valores de cada fila, sin ponderar por citas e ignorando los nulos.
 *
 * Diferencias deliberadas con la hoja de cálculo:
 *  - Sin citas (null o 0) la fila queda "sin datos" (null), nunca en 0.
 *  - Sin programa o sin meta, el pct de la categoría es null y no entra al global.
 */
import { CATEGORIAS } from "./categorias";

/* ── Tipos ───────────────────────────────────── */

export interface DetalleCategoria {
  ordenes: number;
  tasa: number | null;
  meta: number | null;
  pct: number | null;
}

export interface ResultadoFila {
  categorias: Record<string, DetalleCategoria>;
  global: number | null;
}

/** Fila plana de la consulta: médico × periodo × categoría (categoría null si no tuvo órdenes). */
export interface EntradaCumplimiento {
  documento: string;
  nombre: string;
  periodo: number;
  citas: number | null;
  programa: string | null;
  categoria: string | null;
  ordenes: number | null;
}

export interface MetaCumplimiento {
  anio: number;
  programa: string;
  categoria: string;
  valor: number;
}

export interface FilaCumplimiento extends ResultadoFila {
  documento: string;
  nombre: string;
  periodo: number;
  citas: number | null;
  programa: string | null;
}

export interface ProfesionalCumplimiento {
  documento: string;
  nombre: string;
  /** Programa más reciente conocido dentro del rango. */
  programa: string | null;
  citas: number;
  /** Periodos del rango en los que el médico tiene un global definido. */
  periodosConDatos: number;
  pct: Record<string, number | null>;
  global: number | null;
}

export interface PuntoMensual {
  periodo: number;
  /** Médicos del periodo con un global definido. */
  profesionalesConDatos: number;
  pct: Record<string, number | null>;
  global: number | null;
}

export interface ResumenCumplimiento {
  pct: Record<string, number | null>;
  global: number | null;
}

export interface ResultadoCumplimiento {
  filas: FilaCumplimiento[];
  profesionales: ProfesionalCumplimiento[];
  serieMensual: PuntoMensual[];
  resumen: ResumenCumplimiento;
}

/* ── Cálculo ─────────────────────────────────── */

/** Promedio simple de los valores definidos; null si no hay ninguno. */
export function promedio(valores: (number | null)[]): number | null {
  let suma = 0;
  let n = 0;
  for (const v of valores) {
    if (v === null) continue;
    suma += v;
    n++;
  }
  return n === 0 ? null : suma / n;
}

/** Calcula las 7 categorías y el global de un médico en un periodo. */
export function calcularFila(entrada: {
  citas: number | null;
  ordenes: Record<string, number>;
  metaDe: (categoria: string) => number | null;
}): ResultadoFila {
  const conCitas = entrada.citas !== null && entrada.citas > 0;
  const categorias: Record<string, DetalleCategoria> = {};

  for (const { clave, escala } of CATEGORIAS) {
    const ordenes = entrada.ordenes[clave] ?? 0;
    const metaCruda = entrada.metaDe(clave);
    // Una meta en cero no permite dividir: se trata como meta ausente
    const meta = metaCruda !== null && metaCruda > 0 ? metaCruda : null;
    const tasa = conCitas
      ? (escala === "x100" ? ordenes * 100 : ordenes) / (entrada.citas as number)
      : null;
    const pct = tasa !== null && meta !== null ? tasa / meta : null;
    categorias[clave] = { ordenes, tasa, meta, pct };
  }

  const global = promedio(CATEGORIAS.map((c) => categorias[c.clave].pct));
  return { categorias, global };
}

function promediosPorCategoria(filas: ResultadoFila[]): Record<string, number | null> {
  const pct: Record<string, number | null> = {};
  for (const { clave } of CATEGORIAS) {
    pct[clave] = promedio(filas.map((f) => f.categorias[clave].pct));
  }
  return pct;
}

function resumir(filas: ResultadoFila[]): ResumenCumplimiento {
  return {
    pct: promediosPorCategoria(filas),
    global: promedio(filas.map((f) => f.global)),
  };
}

function conDatos(filas: ResultadoFila[]): number {
  return filas.filter((f) => f.global !== null).length;
}

function porNombre(a: { nombre: string; documento: string }, b: { nombre: string; documento: string }): number {
  return a.nombre.localeCompare(b.nombre, "es") || a.documento.localeCompare(b.documento, "es", { numeric: true });
}

/** Arma filas, profesionales, serie mensual y resumen a partir de las filas planas de la consulta. */
export function construirCumplimiento(datos: {
  entradas: EntradaCumplimiento[];
  metas: MetaCumplimiento[];
}): ResultadoCumplimiento {
  const metas = new Map<string, number>();
  for (const m of datos.metas) {
    metas.set(`${m.anio}|${m.programa}|${m.categoria}`, m.valor);
  }

  // Una fila por médico × periodo, con sus órdenes por categoría
  const grupos = new Map<
    string,
    Omit<FilaCumplimiento, "categorias" | "global"> & { ordenes: Record<string, number> }
  >();
  for (const e of datos.entradas) {
    const llave = `${e.documento}|${e.periodo}`;
    let grupo = grupos.get(llave);
    if (!grupo) {
      grupo = {
        documento: e.documento,
        nombre: e.nombre,
        periodo: e.periodo,
        citas: e.citas,
        programa: e.programa,
        ordenes: {},
      };
      grupos.set(llave, grupo);
    }
    if (e.categoria !== null && e.ordenes !== null) {
      grupo.ordenes[e.categoria] = (grupo.ordenes[e.categoria] ?? 0) + e.ordenes;
    }
  }

  const filas: FilaCumplimiento[] = Array.from(grupos.values())
    .map(({ ordenes, ...base }) => {
      const anio = Math.floor(base.periodo / 100);
      const programa = base.programa;
      return {
        ...base,
        ...calcularFila({
          citas: base.citas,
          ordenes,
          metaDe: (categoria) =>
            programa === null ? null : metas.get(`${anio}|${programa}|${categoria}`) ?? null,
        }),
      };
    })
    .sort((a, b) => a.periodo - b.periodo || porNombre(a, b));

  // `filas` ya está en orden ascendente de periodo: la última fila de cada
  // médico es la más reciente.
  const porMedico = new Map<string, FilaCumplimiento[]>();
  const porPeriodo = new Map<number, FilaCumplimiento[]>();
  for (const fila of filas) {
    const delMedico = porMedico.get(fila.documento);
    if (delMedico) delMedico.push(fila);
    else porMedico.set(fila.documento, [fila]);

    const delPeriodo = porPeriodo.get(fila.periodo);
    if (delPeriodo) delPeriodo.push(fila);
    else porPeriodo.set(fila.periodo, [fila]);
  }

  const profesionales: ProfesionalCumplimiento[] = Array.from(porMedico.values())
    .map((delMedico) => {
      const reciente = delMedico[delMedico.length - 1];
      const conPrograma = delMedico.filter((f) => f.programa !== null);
      return {
        documento: reciente.documento,
        nombre: reciente.nombre,
        programa: conPrograma.length > 0 ? conPrograma[conPrograma.length - 1].programa : null,
        citas: delMedico.reduce((total, f) => total + (f.citas ?? 0), 0),
        periodosConDatos: conDatos(delMedico),
        ...resumir(delMedico),
      };
    })
    .sort(porNombre);

  const serieMensual: PuntoMensual[] = Array.from(porPeriodo.entries())
    .sort(([a], [b]) => a - b)
    .map(([periodo, delPeriodo]) => ({
      periodo,
      profesionalesConDatos: conDatos(delPeriodo),
      ...resumir(delPeriodo),
    }));

  return { filas, profesionales, serieMensual, resumen: resumir(filas) };
}
