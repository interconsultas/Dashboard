import { fmtPeriodo, fmtPeriodos } from "@/lib/periodo";

describe("fmtPeriodo", () => {
  it("formatea un periodo YYYYMM", () => {
    expect(fmtPeriodo(202603)).toBe("Mar 2026");
    expect(fmtPeriodo(202601)).toBe("Ene 2026");
  });

  it("retorna guion para null", () => {
    expect(fmtPeriodo(null)).toBe("—");
  });
});

describe("fmtPeriodos", () => {
  it("con un solo periodo en el array, se comporta igual que fmtPeriodo", () => {
    expect(fmtPeriodos([202603], null)).toBe("Mar 2026");
  });

  it("con dos periodos, los une con ' / '", () => {
    expect(fmtPeriodos([202602, 202603], null)).toBe("Feb 2026 / Mar 2026");
  });

  it("respeta el orden en que vienen los periodos (ya deberian venir ordenados)", () => {
    expect(fmtPeriodos([202601, 202603, 202605], null)).toBe("Ene 2026 / Mar 2026 / May 2026");
  });

  // Regresion: filas cargadas antes de este fix no tienen periodos_detectados
  // poblado — deben seguir mostrando el valor unico de periodo_detectado.
  it("cae al fallback si periodos es null", () => {
    expect(fmtPeriodos(null, 202603)).toBe("Mar 2026");
  });

  it("cae al fallback si periodos es un array vacio", () => {
    expect(fmtPeriodos([], 202603)).toBe("Mar 2026");
  });

  it("cae al fallback si periodos es undefined", () => {
    expect(fmtPeriodos(undefined, 202603)).toBe("Mar 2026");
  });

  it("retorna guion si no hay ni periodos ni fallback", () => {
    expect(fmtPeriodos(null, null)).toBe("—");
  });
});
