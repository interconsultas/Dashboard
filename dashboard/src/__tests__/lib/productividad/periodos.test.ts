import {
  claveCarga,
  esClavePeriodo,
  etiquetaCarga,
  etiquetaLargaCarga,
} from "@/lib/productividad/periodos";

describe("claveCarga", () => {
  it("mensual: el periodo YYYYMM", () => {
    expect(claveCarga({ granularidad: "mensual", periodo: 202610, fecha_inicial: "2026-10-01" })).toBe("202610");
  });

  it("semanal: la fecha inicial ISO", () => {
    expect(claveCarga({ granularidad: "semanal", periodo: 202610, fecha_inicial: "2026-10-05" })).toBe("2026-10-05");
  });
});

describe("esClavePeriodo", () => {
  it.each([
    ["mensual", "202610", true],
    ["mensual", "202613", false],
    ["mensual", "2026-10-01", false],
    ["mensual", "20261", false],
    ["semanal", "2026-10-05", true],
    ["semanal", "2026-02-30", false],
    ["semanal", "2026-1-5", false],
    ["semanal", "202610", false],
    ["semanal", "2026-10-05'; DROP TABLE x", false],
  ] as const)("%s %s → %s", (granularidad, clave, esperado) => {
    expect(esClavePeriodo(granularidad, clave)).toBe(esperado);
  });
});

describe("etiquetas", () => {
  const mes = { granularidad: "mensual" as const, periodo: 202610, fecha_inicial: "2026-10-01", fecha_final: "2026-10-31" };
  const semana = { granularidad: "semanal" as const, periodo: 202610, fecha_inicial: "2026-10-05", fecha_final: "2026-10-11" };
  const cruzaMes = { granularidad: "semanal" as const, periodo: 202610, fecha_inicial: "2026-10-26", fecha_final: "2026-11-01" };

  it("mensual corta y larga", () => {
    expect(etiquetaCarga(mes)).toBe("Oct 2026");
    expect(etiquetaLargaCarga(mes)).toBe("Octubre 2026");
  });

  it("semanal: rango de días", () => {
    expect(etiquetaCarga(semana)).toBe("5–11 oct");
    expect(etiquetaLargaCarga(semana)).toBe("5–11 oct 2026");
  });

  it("semanal que cruza el mes muestra ambos meses", () => {
    expect(etiquetaCarga(cruzaMes)).toBe("26 oct–1 nov");
    expect(etiquetaLargaCarga(cruzaMes)).toBe("26 oct–1 nov 2026");
  });
});
