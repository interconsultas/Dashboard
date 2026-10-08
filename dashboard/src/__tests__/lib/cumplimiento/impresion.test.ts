import { fmtFechaGeneracion, programasFiltrados, rangoPeriodos } from "@/lib/cumplimiento/impresion";
import { PROGRAMAS_META } from "@/lib/cumplimiento/categorias";

describe("rangoPeriodos", () => {
  it("describe el rango con el periodo inicial y el final", () => {
    expect(rangoPeriodos(202512, 202602)).toBe("Dic 2025 – Feb 2026");
  });

  it("con un solo mes no repite el periodo", () => {
    expect(rangoPeriodos(202601, 202601)).toBe("Ene 2026");
  });

  it("sin rango resuelto devuelve null", () => {
    expect(rangoPeriodos(null, null)).toBeNull();
    expect(rangoPeriodos(202601, null)).toBeNull();
  });
});

describe("programasFiltrados", () => {
  it("devuelve los programas cuando el filtro deja algunos por fuera", () => {
    expect(programasFiltrados(["RCV", "CPR"])).toBe("RCV, CPR");
  });

  it("sin filtro aplicado, sin programas o con todos los programas no hay filtro que informar", () => {
    expect(programasFiltrados(null)).toBeNull();
    expect(programasFiltrados([])).toBeNull();
    expect(programasFiltrados([...PROGRAMAS_META])).toBeNull();
  });
});

describe("fmtFechaGeneracion", () => {
  it("escribe la fecha en formato largo es-CO", () => {
    expect(fmtFechaGeneracion(new Date(2026, 9, 8, 14, 30))).toBe("8 de octubre de 2026");
  });
});
