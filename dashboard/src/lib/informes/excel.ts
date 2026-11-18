/**
 * Libro de Excel de un informe (./modelo) con la identidad de la institución.
 *
 * - Hoja de resumen: logo, título, periodo, filtros, hora de generación e
 *   indicadores (los % y la variación como fórmula).
 * - Una hoja por tabla: encabezado azul de marca congelado con autofiltro,
 *   % como fórmula sobre los conteos de la misma fila (con el resultado en
 *   caché para visores que no recalculan), totales con SUM y formato
 *   condicional del % de inasistencia contra la meta.
 *
 * La fuente es Calibri: el xlsx no admite familias de reserva y DM Sans no
 * viene instalada en Excel, LibreOffice ni Google Sheets.
 */
import ExcelJS from "exceljs";
import { COLORES } from "@/lib/tema/tokens";
import { META_INASISTENCIA } from "@/lib/productividad/metricas";
import type { ColumnaInforme, KpiInforme, ModeloInforme, TablaInforme, TipoColumna, ValorCelda } from "./modelo";

/* ── Estilos ──────────────────────────────────── */

const FUENTE = "Calibri";
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

const BLANCO = "FFFFFFFF";
const PRIMARIO = argb(COLORES.primario);
const TINTA = argb(COLORES.tinta);
const TINTA_3 = argb(COLORES["tinta-3"]);
const BORDE = argb(COLORES.borde);

const FORMATOS: Record<TipoColumna, string | undefined> = {
  texto: undefined,
  entero: "#,##0",
  decimal: "#,##0.0",
  porcentaje: "0.0%",
};
const FORMATO_RELATIVA = '+0.0%;-0.0%;0.0%';
const FORMATO_PUNTOS = '+0.0" pp";-0.0" pp";0.0" pp"';

const relleno = (color: string): ExcelJS.FillPattern => ({ type: "pattern", pattern: "solid", fgColor: { argb: color } });
const fuente = (extra: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: FUENTE, size: 11, color: { argb: TINTA }, ...extra });

/** Bandas del semáforo de inasistencia: verde bajo la meta y rojo cada vez más intenso por encima. */
const BANDAS_INASISTENCIA: { desde: number | null; hasta: number | null; fondo: string; tinta: string }[] = [
  { desde: null, hasta: 1, fondo: COLORES["bien-suave"], tinta: COLORES.bien },
  { desde: 1, hasta: 1.5, fondo: COLORES["critico-suave"], tinta: COLORES.critico },
  { desde: 1.5, hasta: 2, fondo: "#F4B4AB", tinta: COLORES.tinta },
  { desde: 2, hasta: null, fondo: COLORES.critico, tinta: "#FFFFFF" },
];

const redondear = (v: number) => Number(v.toFixed(4));

function semaforo(ws: ExcelJS.Worksheet, ref: string, celda: string) {
  ws.addConditionalFormatting({
    ref,
    rules: BANDAS_INASISTENCIA.map((b, i) => {
      const condiciones = [`ISNUMBER(${celda})`];
      if (b.desde !== null) condiciones.push(`${celda}>=${redondear(META_INASISTENCIA * b.desde)}`);
      if (b.hasta !== null) condiciones.push(`${celda}<${redondear(META_INASISTENCIA * b.hasta)}`);
      return {
        type: "expression",
        priority: i + 1,
        formulae: [`AND(${condiciones.join(",")})`],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: argb(b.fondo) } },
          font: { color: { argb: argb(b.tinta) } },
        },
      } as ExcelJS.ConditionalFormattingRule;
    }),
  });
}

/* ── Utilidades ───────────────────────────────── */

const razon = (n: ValorCelda | undefined, d: ValorCelda | undefined): number | null =>
  typeof n === "number" && typeof d === "number" && d !== 0 ? n / d : null;

/** Celda con fórmula y su resultado en caché ("" si no hay valor). */
const formula = (f: string, resultado: number | null): ExcelJS.CellFormulaValue => ({
  formula: f,
  result: resultado ?? "",
  date1904: false,
});

function anchoDe(columna: ColumnaInforme, valores: ValorCelda[]): number {
  const largos = valores.map((v) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === "string") return v.length;
    return columna.tipo === "porcentaje" ? 7 : Math.round(v).toLocaleString("es-CO").length + 2;
  });
  return Math.min(60, Math.max(10, columna.etiqueta.length + 2, ...largos.map((l) => l + 2)));
}

function encabezar(fila: ExcelJS.Row) {
  fila.eachCell((c) => {
    c.fill = relleno(PRIMARIO);
    c.font = fuente({ bold: true, color: { argb: BLANCO } });
    c.alignment = { vertical: "middle", wrapText: true };
  });
  fila.height = 30;
}

/* ── Hoja de resumen ──────────────────────────── */

function hojaResumen(wb: ExcelJS.Workbook, m: ModeloInforme, logo: Buffer | null) {
  const ws = wb.addWorksheet(m.hoja_resumen, { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 44 }, { width: 18 }, { width: 18 }, { width: 14 }];

  let r = 1;
  if (logo) {
    const id = wb.addImage({ buffer: logo as unknown as ExcelJS.Buffer, extension: "png" });
    ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: 150, height: 44 } });
    r = 4;
  }

  const titulo = ws.getCell(r, 1);
  titulo.value = m.titulo;
  titulo.font = fuente({ size: 16, bold: true, color: { argb: PRIMARIO } });
  ws.getCell(r + 1, 1).value = m.subtitulo;
  ws.getCell(r + 1, 1).font = fuente({ color: { argb: TINTA_3 } });
  r += 3;

  const etiquetaValor = (etiqueta: string, valor: string) => {
    ws.getCell(r, 1).value = etiqueta;
    ws.getCell(r, 1).font = fuente({ bold: true });
    ws.getCell(r, 2).value = valor;
    ws.getCell(r, 2).font = fuente();
    r++;
  };
  for (const f of m.filtros) etiquetaValor(f.etiqueta, f.valor);
  etiquetaValor("Generado", m.generado);
  r++;

  // Bloque de indicadores
  const inicio = r;
  ws.getRow(r).values = ["Indicador", m.periodo ?? "Periodo", m.periodo_anterior ?? "Periodo anterior", "Variación"];
  encabezar(ws.getRow(r));
  r++;
  const filaKpi = new Map(m.kpis.map((k, i) => [k.clave, r + i]));
  for (const k of m.kpis) escribirKpi(ws, r++, k, filaKpi);
  const fin = r - 1;
  for (const k of m.kpis.filter((x) => x.semaforo)) {
    const n = filaKpi.get(k.clave)!;
    semaforo(ws, `B${n}:C${n}`, `B${n}`);
  }
  for (let n = inicio + 1; n <= fin; n++) {
    ws.getRow(n).eachCell({ includeEmpty: true }, (c) => {
      c.border = { bottom: { style: "thin", color: { argb: BORDE } } };
    });
  }

  if (m.notas.length > 0) {
    r++;
    for (const nota of m.notas) {
      ws.getCell(r, 1).value = nota;
      ws.getCell(r++, 1).font = fuente({ italic: true, color: { argb: TINTA_3 } });
    }
  }
}

function escribirKpi(ws: ExcelJS.Worksheet, n: number, k: KpiInforme, filaKpi: Map<string, number>) {
  ws.getCell(n, 1).value = k.etiqueta;
  ws.getCell(n, 1).font = fuente();

  const num = k.formula && filaKpi.get(k.formula.numerador);
  const den = k.formula && filaKpi.get(k.formula.denominador);
  for (const [col, letraCol, valor] of [
    [2, "B", k.valor],
    [3, "C", k.anterior],
  ] as const) {
    const c = ws.getCell(n, col);
    if (num && den && valor !== null) {
      c.value = formula(`IFERROR(${letraCol}${num}/${letraCol}${den},"")`, valor);
    } else {
      c.value = valor;
    }
    c.numFmt = FORMATOS[k.tipo]!;
    c.font = fuente({ bold: col === 2 });
  }

  const v = ws.getCell(n, 4);
  v.font = fuente();
  if (k.variacion === "puntos") {
    const res = k.valor !== null && k.anterior !== null ? (k.valor - k.anterior) * 100 : null;
    v.value = formula(`IF(AND(ISNUMBER(B${n}),ISNUMBER(C${n})),(B${n}-C${n})*100,"")`, res);
    v.numFmt = FORMATO_PUNTOS;
  } else if (k.variacion === "relativa") {
    const res = k.valor !== null && k.anterior ? k.valor / k.anterior - 1 : null;
    v.value = formula(`IF(AND(ISNUMBER(B${n}),ISNUMBER(C${n}),C${n}<>0),B${n}/C${n}-1,"")`, res);
    v.numFmt = FORMATO_RELATIVA;
  }
}

/* ── Hojas de tabla ───────────────────────────── */

function hojaTabla(wb: ExcelJS.Workbook, t: TablaInforme) {
  const ws = wb.addWorksheet(t.titulo.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  const cols = t.columnas;
  const letras = new Map(cols.map((c, i) => [c.clave, ws.getColumn(i + 1).letter]));

  ws.getRow(1).values = cols.map((c) => c.etiqueta);
  encabezar(ws.getRow(1));

  const celdaRazon = (c: ColumnaInforme, n: number, resultado: number | null): ExcelJS.CellValue => {
    const num = c.formula && letras.get(c.formula.numerador);
    const den = c.formula && letras.get(c.formula.denominador);
    return num && den ? formula(`IFERROR(${num}${n}/${den}${n},"")`, resultado) : resultado;
  };

  t.filas.forEach((fila, i) => {
    const n = i + 2;
    cols.forEach((c, j) => {
      const celda = ws.getCell(n, j + 1);
      const valor = fila[c.clave] ?? null;
      celda.value = c.tipo === "porcentaje" ? celdaRazon(c, n, typeof valor === "number" ? valor : null) : valor === "" ? null : valor;
      if (FORMATOS[c.tipo]) celda.numFmt = FORMATOS[c.tipo]!;
      celda.font = fuente();
    });
  });

  const ultimaDatos = t.filas.length + 1;
  let ultima = ultimaDatos;
  if (t.totales && t.filas.length > 0) {
    ultima = ultimaDatos + 1;
    const totales: Record<string, number> = {};
    cols.forEach((c, j) => {
      const celda = ws.getCell(ultima, j + 1);
      const l = ws.getColumn(j + 1).letter;
      if (j === 0) {
        celda.value = "Total";
      } else if (c.tipo === "entero") {
        totales[c.clave] = t.filas.reduce((s, f) => s + (typeof f[c.clave] === "number" ? (f[c.clave] as number) : 0), 0);
        celda.value = formula(`SUM(${l}2:${l}${ultimaDatos})`, totales[c.clave]);
      }
    });
    cols.forEach((c, j) => {
      if (j === 0 || c.tipo !== "porcentaje") return;
      const celda = ws.getCell(ultima, j + 1);
      celda.value = c.formula ? celdaRazon(c, ultima, razon(totales[c.formula.numerador], totales[c.formula.denominador])) : null;
    });
    cols.forEach((c, j) => {
      const celda = ws.getCell(ultima, j + 1);
      if (FORMATOS[c.tipo]) celda.numFmt = FORMATOS[c.tipo]!;
      celda.font = fuente({ bold: true });
      celda.border = { top: { style: "thin", color: { argb: TINTA } } };
    });
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, ultimaDatos), column: cols.length } };
  cols.forEach((c, j) => {
    ws.getColumn(j + 1).width = anchoDe(c, t.filas.map((f) => f[c.clave] ?? null));
    if (c.semaforo && t.filas.length > 0) {
      const l = ws.getColumn(j + 1).letter;
      semaforo(ws, `${l}2:${l}${ultima}`, `${l}2`);
    }
  });

  if (t.nota) {
    const celda = ws.getCell(ultima + 2, 1);
    celda.value = t.nota;
    celda.font = fuente({ italic: true, color: { argb: TINTA_3 } });
  }
}

/* ── Libro ────────────────────────────────────── */

/** Libro .xlsx del informe. `logo` = PNG del logo (null para omitirlo). */
export async function construirLibro(m: ModeloInforme, logo: Buffer | null): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dashboard de Autorizaciones IPS";
  wb.title = m.titulo;
  wb.calcProperties = { fullCalcOnLoad: true };

  hojaResumen(wb, m, logo);
  for (const t of m.tablas) hojaTabla(wb, t);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
