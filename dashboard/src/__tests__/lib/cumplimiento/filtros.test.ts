import { cuerpoConsulta, errorDeRango, MAX_MESES_RANGO } from "@/lib/cumplimiento/filtros";
import { mesesEntre, restarMeses } from "@/lib/cumplimiento/periodo";
import { PROGRAMAS_META } from "@/lib/cumplimiento/categorias";

const TODOS = [...PROGRAMAS_META];

describe("mesesEntre", () => {
  it("cuenta los meses del rango con ambos extremos incluidos", () => {
    expect(mesesEntre(202601, 202601)).toBe(1);
    expect(mesesEntre(202601, 202603)).toBe(3);
    expect(mesesEntre(202511, 202602)).toBe(4);
    expect(mesesEntre(202402, 202601)).toBe(24);
    expect(mesesEntre(202401, 202601)).toBe(25);
  });
});

describe("restarMeses", () => {
  it("retrocede dentro del mismo año y entre años", () => {
    expect(restarMeses(202603, 0)).toBe(202603);
    expect(restarMeses(202603, 2)).toBe(202601);
    expect(restarMeses(202603, 3)).toBe(202512);
    expect(restarMeses(202603, 23)).toBe(202404);
    expect(restarMeses(202601, 12)).toBe(202501);
  });
});

describe("cuerpoConsulta", () => {
  it("sin filtros aplicados envía un cuerpo vacío para que el servidor use el rango por defecto", () => {
    expect(cuerpoConsulta(null)).toBe("{}");
  });

  it("envía el rango de periodos", () => {
    expect(JSON.parse(cuerpoConsulta({ desde: 202601, hasta: 202603, programas: TODOS }))).toEqual({
      periodo_desde: 202601,
      periodo_hasta: 202603,
    });
  });

  it("envía los programas solo cuando son un subconjunto, en orden estable", () => {
    const a = cuerpoConsulta({ desde: 202601, hasta: 202603, programas: ["RCV", "CPR"] });
    const b = cuerpoConsulta({ desde: 202601, hasta: 202603, programas: ["CPR", "RCV"] });

    expect(JSON.parse(a).programas).toEqual(["CPR", "RCV"]);
    expect(a).toBe(b);
  });

  it("ningún programa marcado equivale a todos", () => {
    expect(JSON.parse(cuerpoConsulta({ desde: 202601, hasta: 202603, programas: [] }))).toEqual({
      periodo_desde: 202601,
      periodo_hasta: 202603,
    });
  });

  it("nunca envía el documento: el profesional se elige sobre los datos ya consultados", () => {
    expect(cuerpoConsulta({ desde: 202601, hasta: 202603, programas: TODOS })).not.toContain("documento");
  });
});

describe("errorDeRango", () => {
  it("pide ambos periodos", () => {
    expect(errorDeRango(null, 202603)).toBe("Seleccione el periodo inicial y el final");
    expect(errorDeRango(202601, null)).toBe("Seleccione el periodo inicial y el final");
  });

  it("rechaza un rango de más de 24 meses", () => {
    expect(MAX_MESES_RANGO).toBe(24);
    expect(errorDeRango(202401, 202601)).toBe("El rango no puede superar los 24 meses");
  });

  it("acepta un rango válido", () => {
    expect(errorDeRango(202402, 202601)).toBeNull();
    expect(errorDeRango(202601, 202601)).toBeNull();
  });
});
