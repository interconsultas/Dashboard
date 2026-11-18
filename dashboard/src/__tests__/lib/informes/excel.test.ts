import { readFileSync } from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { construirLibro } from "@/lib/informes/excel";
import { informeFicha, informeMensual, informeVista } from "@/lib/informes/construir";
import { FILTROS_VACIOS } from "@/lib/productividad/filtros";
import { ALERTAS, FICHA, PRODUCTIVIDAD } from "@/test-utils/informes";

const GENERADO = new Date(Date.UTC(2026, 10, 18, 15, 32));
const LOGO = readFileSync(path.join(process.cwd(), "public/logo.png"));

async function leer(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

/** Columna (letra) del encabezado con esa etiqueta en la fila 1. */
function letra(ws: ExcelJS.Worksheet, etiqueta: string): string {
  let encontrada = "";
  ws.getRow(1).eachCell((c, n) => {
    if (c.value === etiqueta) encontrada = ws.getColumn(n).letter;
  });
  if (!encontrada) throw new Error(`Sin columna ${etiqueta}`);
  return encontrada;
}

describe("construirLibro — vista", () => {
  let wb: ExcelJS.Workbook;
  beforeAll(async () => {
    wb = await leer(await construirLibro(informeVista(PRODUCTIVIDAD, FILTROS_VACIOS, GENERADO), LOGO));
  });

  it("crea las hojas en orden", () => {
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumen", "Por área", "Por servicio", "Por profesional", "Tendencia"]);
  });

  it("encabeza el resumen con logo, título, periodo, filtros y hora de generación", () => {
    const ws = wb.getWorksheet("Resumen")!;
    expect(ws.getImages()).toHaveLength(1);
    const textos: string[] = [];
    ws.eachRow((r) => r.eachCell((c) => typeof c.value === "string" && textos.push(c.value)));
    expect(textos).toEqual(
      expect.arrayContaining(["Productividad de la agenda", "Octubre 2026", "Área", "Todas", "18/11/2026, 10:32"])
    );
  });

  it("escribe los indicadores con fórmulas para los % y la variación, con valores en caché", () => {
    const ws = wb.getWorksheet("Resumen")!;
    let fila = 0;
    ws.eachRow((r, n) => {
      if (r.getCell(1).value === "% inasistencia") fila = n;
    });
    expect(fila).toBeGreaterThan(0);
    const valor = ws.getCell(fila, 2).value as ExcelJS.CellFormulaValue;
    expect(valor.formula).toMatch(/^IFERROR\(B\d+\/B\d+,""\)$/);
    expect(valor.result).toBeCloseTo(0.15);
    expect(ws.getCell(fila, 2).numFmt).toBe("0.0%");
    const anterior = ws.getCell(fila, 3).value as ExcelJS.CellFormulaValue;
    expect(anterior.result).toBeCloseTo(0.1);
    const variacion = ws.getCell(fila, 4).value as ExcelJS.CellFormulaValue;
    expect(variacion.formula).toMatch(/\*100/);
    expect(variacion.result).toBeCloseTo(5);
  });

  it("da estilo de marca al encabezado, lo congela y le pone autofiltro", () => {
    const ws = wb.getWorksheet("Por área")!;
    const h = ws.getCell("A1");
    expect(h.value).toBe("Área");
    expect((h.fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FF2A5299");
    expect(h.font.bold).toBe(true);
    expect(h.font.color?.argb).toBe("FFFFFFFF");
    expect(h.font.name).toBe("Calibri");
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();
    expect(ws.getColumn(1).width).toBeGreaterThan(10);
  });

  it("escribe los % como fórmula sobre los conteos de la misma fila", () => {
    const ws = wb.getWorksheet("Por área")!;
    const [pct, inas, asig] = [letra(ws, "% inasistencia"), letra(ws, "Inasistidas"), letra(ws, "Asignadas")];
    const c = ws.getCell(`${pct}2`);
    expect((c.value as ExcelJS.CellFormulaValue).formula).toBe(`IFERROR(${inas}2/${asig}2,"")`);
    expect((c.value as ExcelJS.CellFormulaValue).result).toBeCloseTo(0.2);
    expect(c.numFmt).toBe("0.0%");
    expect(ws.getCell(`${asig}2`).value).toBe(500);
    expect(ws.getCell(`${asig}2`).numFmt).toBe("#,##0");
  });

  it("cierra con una fila de totales: sumas y razones sobre los totales", () => {
    const ws = wb.getWorksheet("Por área")!;
    const [pct, asig] = [letra(ws, "% inasistencia"), letra(ws, "Asignadas")];
    expect(ws.getCell("A4").value).toBe("Total");
    expect(ws.getCell("A4").font.bold).toBe(true);
    expect(ws.getCell(`${asig}4`).border?.top?.style).toBe("thin");
    const suma = ws.getCell(`${asig}4`).value as ExcelJS.CellFormulaValue;
    expect(suma.formula).toBe(`SUM(${asig}2:${asig}3)`);
    expect(suma.result).toBe(800);
    expect((ws.getCell(`${pct}4`).value as ExcelJS.CellFormulaValue).result).toBeCloseTo(0.15);
  });

  it("colorea el % de inasistencia: verde bajo la meta y escala roja por encima", () => {
    const ws = wb.getWorksheet("Por área")!;
    const pct = letra(ws, "% inasistencia");
    // exceljs lee el formato condicional pero no lo declara en sus tipos
    const reglas = (ws as unknown as { conditionalFormattings: ExcelJS.ConditionalFormattingOptions[] }).conditionalFormattings;
    const cf = reglas.find((f) => f.ref === `${pct}2:${pct}4`);
    expect(cf).toBeDefined();
    const formulas = cf!.rules.map((r) => (r as ExcelJS.ExpressionRuleType).formulae?.[0]);
    expect(formulas[0]).toBe(`AND(ISNUMBER(${pct}2),${pct}2<0.1)`);
    expect(cf!.rules.length).toBeGreaterThanOrEqual(3);
  });

  it("la tendencia no lleva totales", () => {
    const ws = wb.getWorksheet("Tendencia")!;
    expect(ws.rowCount).toBe(3);
  });
});

describe("construirLibro — mensual y ficha", () => {
  it("el mensual agrega Prioridades y Proyección", async () => {
    const wb = await leer(await construirLibro(informeMensual(PRODUCTIVIDAD, ALERTAS, GENERADO), LOGO));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Resumen", "Por área", "Por servicio", "Por profesional", "Tendencia", "Prioridades", "Proyección",
    ]);
    const prio = wb.getWorksheet("Prioridades")!;
    expect(prio.getCell("B2").value).toMatch(/Medicina general/);
    expect(prio.getCell(`${letra(prio, "Profesionales equivalentes")}2`).numFmt).toBe("#,##0.0");
  });

  it("la ficha usa la hoja Ficha y funciona sin logo", async () => {
    const wb = await leer(await construirLibro(informeFicha(FICHA, GENERADO), null));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Ficha", "Servicios", "Tendencia"]);
    expect(wb.getWorksheet("Ficha")!.getImages()).toHaveLength(0);
  });
});
