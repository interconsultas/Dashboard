/**
 * Del modelo de informe (./modelo) a lo que pinta el PDF: textos ya
 * formateados en es-CO, alineación y peso de cada columna, fila de totales
 * y semáforo del % de inasistencia con su etiqueta (no solo color).
 * Módulo puro: lo prueban las pruebas sin @react-pdf.
 */
import { fmtNumero, fmtPct } from "@/lib/productividad/presentacion";
import { variacion } from "@/lib/productividad/metricas";
import type { ColumnaInforme, FilaInforme, KpiInforme, TablaInforme, TipoColumna, ValorCelda } from "./modelo";
import { bandaInasistencia } from "./semaforo";

/* ── Formatos ─────────────────────────────────── */

const fmtDecimal = (v: number) => v.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Texto de un valor según su tipo: "12.345", "2,3", "17,1 %"; "—" sin valor numérico. */
export function fmtValor(tipo: TipoColumna, valor: ValorCelda | undefined): string {
  if (tipo === "texto") return valor === null || valor === undefined ? "" : String(valor);
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "—";
  if (tipo === "entero") return fmtNumero(Math.round(valor));
  if (tipo === "decimal") return fmtDecimal(valor);
  return fmtPct(valor);
}

export interface Semaforo {
  etiqueta: string;
  fondo: string;
  tinta: string;
}

/** Semáforo del % de inasistencia contra la meta; null sin valor. */
export function semaforoInasistencia(valor: number | null): Semaforo | null {
  const b = bandaInasistencia(valor);
  return b ? { etiqueta: b.etiqueta, fondo: b.fondo, tinta: b.tinta } : null;
}

/** "↑ 14,3 %" / "↓ 2,1 pp" / "= 0 %"; null si no hay con qué comparar. */
export function fmtVariacionKpi(k: KpiInforme): string | null {
  if (k.variacion === null) return null;
  const v = variacion(k.valor, k.anterior, k.variacion);
  if (v === null) return null;
  const redondeado = Number(v.toFixed(1));
  const flecha = redondeado > 0 ? "↑" : redondeado < 0 ? "↓" : "=";
  const abs = Math.abs(redondeado).toLocaleString("es-CO", { maximumFractionDigits: 1 });
  return `${flecha} ${abs}${k.variacion === "puntos" ? " pp" : " %"}`;
}

/* ── Tablas ───────────────────────────────────── */

const razon = (n: ValorCelda | undefined, d: ValorCelda | undefined): number | null =>
  typeof n === "number" && typeof d === "number" && d !== 0 ? n / d : null;

/**
 * Fila de totales, como en el Excel: "Total" en la primera columna, suma de
 * los enteros y las razones calculadas sobre esos totales. null si la tabla
 * no lleva totales o está vacía.
 */
export function filaTotales(t: TablaInforme): FilaInforme | null {
  if (!t.totales || t.filas.length === 0) return null;
  const fila: FilaInforme = {};
  t.columnas.forEach((c, j) => {
    if (j === 0) fila[c.clave] = "Total";
    else if (c.tipo === "entero") fila[c.clave] = t.filas.reduce<number>((s, f) => s + (typeof f[c.clave] === "number" ? (f[c.clave] as number) : 0), 0);
    else fila[c.clave] = null;
  });
  for (const c of t.columnas) {
    if (c.tipo === "porcentaje" && c.formula) fila[c.clave] = razon(fila[c.formula.numerador], fila[c.formula.denominador]);
  }
  return fila;
}

export interface CeldaPdf {
  texto: string;
  semaforo?: Semaforo;
}

export interface ColumnaPdf {
  etiqueta: string;
  alineacion: "izquierda" | "derecha";
  /** Peso relativo del ancho (flex). */
  peso: number;
}

export interface TablaPdf {
  id: string;
  titulo: string;
  nota?: string;
  columnas: ColumnaPdf[];
  filas: CeldaPdf[][];
  total: CeldaPdf[] | null;
}

/** Columnas de texto con contenido largo (nombres, descripciones). */
const PESOS_TEXTO: Record<string, number> = {
  servicio: 3,
  nombre: 3,
  prioridad: 3.4,
  revisar: 3,
  detalle: 3.6,
  area: 2,
  area_principal: 2,
  referencia: 1.6,
  documento: 1.3,
  codigo: 0.9,
  periodo: 1.3,
  ambito: 1,
  direccion: 1.1,
  novedad: 1,
};

/** Columnas numéricas con encabezado largo o muy corto. */
const PESOS_NUMERO: Record<string, number> = { posicion: 0.6, profesionales: 1.4, citas_anterior: 1.2 };

function pesoDe(c: ColumnaInforme): number {
  if (c.tipo === "texto") return PESOS_TEXTO[c.clave] ?? 1.5;
  if (PESOS_NUMERO[c.clave]) return PESOS_NUMERO[c.clave];
  return c.semaforo ? 1.25 : 1;
}

function celda(c: ColumnaInforme, valor: ValorCelda | undefined): CeldaPdf {
  const texto = fmtValor(c.tipo, valor);
  const s = c.semaforo && typeof valor === "number" ? semaforoInasistencia(valor) : null;
  return s ? { texto, semaforo: s } : { texto };
}

/**
 * Tabla lista para pintar. Con `limite` se queda con las primeras filas (el
 * modelo ya llega ordenado), sin totales —serían de una parte— y lo aclara.
 */
export function prepararTabla(t: TablaInforme, opciones: { limite?: number } = {}): TablaPdf {
  const recortada = opciones.limite !== undefined && t.filas.length > opciones.limite;
  const filas = recortada ? t.filas.slice(0, opciones.limite) : t.filas;
  const total = recortada ? null : filaTotales(t);
  return {
    id: t.id,
    titulo: t.titulo,
    nota: recortada
      ? `Se muestran ${fmtNumero(filas.length)} de ${fmtNumero(t.filas.length)} filas; el listado completo está en el Excel.`
      : t.nota,
    columnas: t.columnas.map((c) => ({ etiqueta: c.etiqueta, alineacion: c.tipo === "texto" ? "izquierda" : "derecha", peso: pesoDe(c) })),
    filas: filas.map((f) => t.columnas.map((c) => celda(c, f[c.clave]))),
    total: total ? t.columnas.map((c) => celda(c, total[c.clave])) : null,
  };
}

/* ── Indicadores ──────────────────────────────── */

export interface KpiPdf {
  clave: string;
  etiqueta: string;
  valor: string;
  variacion: string | null;
  semaforo: Semaforo | null;
}

export function prepararKpis(kpis: readonly KpiInforme[]): KpiPdf[] {
  return kpis.map((k) => ({
    clave: k.clave,
    etiqueta: k.etiqueta,
    valor: fmtValor(k.tipo, k.valor),
    variacion: fmtVariacionKpi(k),
    semaforo: k.semaforo ? semaforoInasistencia(k.valor) : null,
  }));
}
