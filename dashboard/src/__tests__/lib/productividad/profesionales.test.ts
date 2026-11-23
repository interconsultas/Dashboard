import {
  MIN_ASIGNADAS_DISPERSION,
  MIN_ASIGNADAS_PERCENTIL,
  ejeMaximoLog,
  elegiblesDispersion,
  mediana,
  pareto,
  percentilInasistencia,
  umbralesDispersion,
} from "@/lib/productividad/profesionales";
import { indicadores, metricasVacias } from "@/lib/productividad/metricas";
import type { ResumenProfesional } from "@/lib/productividad/tipos";

function p(documento: string, asignadas: number, inasistidas: number, disponibles = 0): ResumenProfesional {
  return {
    documento,
    nombre: `PROFESIONAL ${documento}`,
    area_principal: "Medicina general",
    ...indicadores({ ...metricasVacias(), ofertadas: asignadas + disponibles, asignadas, inasistidas, disponibles }),
  };
}

describe("elegiblesDispersion", () => {
  it(`solo profesionales con ${MIN_ASIGNADAS_DISPERSION} o más asignadas`, () => {
    const lista = [p("1", 19, 1), p("2", 20, 1), p("3", 300, 30), p("4", 0, 0, 50)];
    expect(elegiblesDispersion(lista).map((x) => x.documento)).toEqual(["2", "3"]);
  });
});

describe("mediana", () => {
  it("impar: el valor central; par: el promedio de los dos centrales", () => {
    expect(mediana([30, 10, 20])).toBe(20);
    expect(mediana([40, 10, 20, 30])).toBe(25);
  });

  it("sin valores es null", () => {
    expect(mediana([])).toBeNull();
  });
});

describe("ejeMaximoLog", () => {
  it("la siguiente potencia de 10 por encima del máximo", () => {
    expect(ejeMaximoLog(523)).toBe(1000);
    expect(ejeMaximoLog(1000)).toBe(1000);
    expect(ejeMaximoLog(1001)).toBe(10000);
  });

  it("nunca por debajo de 10 (el mínimo del eje)", () => {
    expect(ejeMaximoLog(0)).toBe(10);
    expect(ejeMaximoLog(7)).toBe(10);
  });
});

describe("umbralesDispersion", () => {
  it("promedio ponderado de inasistencia, mediana de volumen y máximo del eje", () => {
    const u = umbralesDispersion([p("1", 100, 10), p("2", 300, 60), p("3", 40, 0)]);
    expect(u.promedio).toBeCloseTo(70 / 440);
    expect(u.medianaVolumen).toBe(100);
    expect(u.maxEje).toBe(1000);
  });

  it("sin puntos: sin promedio ni mediana y eje mínimo", () => {
    expect(umbralesDispersion([])).toEqual({ promedio: null, medianaVolumen: null, maxEje: 10 });
  });
});

describe("pareto", () => {
  // Citas perdidas: A=50, B=30, C=15, D=5 → total 100
  const lista = [p("C", 10, 5, 10), p("A", 100, 20, 30), p("D", 10, 5, 0), p("B", 50, 10, 20), p("E", 10, 0, 0)];

  it("ordena por citas perdidas, descarta quienes no tienen y acumula", () => {
    const r = pareto(lista);
    expect(r.total).toBe(100);
    expect(r.profesionales).toBe(4);
    expect(r.filas.map((f) => [f.documento, f.perdidas, f.acumulado])).toEqual([
      ["A", 50, 0.5],
      ["B", 30, 0.8],
      ["C", 15, 0.95],
      ["D", 5, 1],
    ]);
  });

  it("el corte del 80 % es el primero que alcanza el 80 % acumulado (incluido)", () => {
    const r = pareto(lista);
    expect(r.corte).toBe(2);
    expect(r.filas.map((f) => f.dentro_corte)).toEqual([true, true, false, false]);
  });

  it("si nadie llega exacto, el corte incluye al que lo cruza", () => {
    const r = pareto([p("A", 70, 70), p("B", 20, 20), p("C", 10, 10)]);
    expect(r.corte).toBe(2);
  });

  it("empata por nombre para un orden estable", () => {
    const r = pareto([p("Z", 10, 5), p("Y", 10, 5)]);
    expect(r.filas.map((f) => f.documento)).toEqual(["Y", "Z"]);
  });

  it("sin citas perdidas: total y corte en cero", () => {
    expect(pareto([p("1", 10, 0)])).toEqual({ filas: [], total: 0, corte: 0, profesionales: 0 });
  });
});

describe("percentilInasistencia", () => {
  const pares = [
    { asignadas: 100, pct_inasistencia: 0.05 },
    { asignadas: 100, pct_inasistencia: 0.1 },
    { asignadas: 100, pct_inasistencia: 0.2 },
    { asignadas: 100, pct_inasistencia: 0.3 },
    { asignadas: 30, pct_inasistencia: 0.9 }, // < 50 asignadas: no es par
  ];

  it("porcentaje de pares (≥ 50 asignadas) con mayor % de inasistencia", () => {
    expect(percentilInasistencia({ asignadas: 100, pct_inasistencia: 0.1 }, pares)).toBe(50);
    expect(percentilInasistencia({ asignadas: 100, pct_inasistencia: 0.05 }, pares)).toBe(75);
    expect(percentilInasistencia({ asignadas: 100, pct_inasistencia: 0.3 }, pares)).toBe(0);
  });

  it(`sin ${MIN_ASIGNADAS_PERCENTIL} asignadas no hay percentil`, () => {
    expect(percentilInasistencia({ asignadas: 49, pct_inasistencia: 0.1 }, pares)).toBeNull();
    expect(percentilInasistencia({ asignadas: 100, pct_inasistencia: null }, pares)).toBeNull();
  });

  it("redondea al entero", () => {
    const tres = [0.1, 0.2, 0.3].map((v) => ({ asignadas: 60, pct_inasistencia: v }));
    expect(percentilInasistencia({ asignadas: 60, pct_inasistencia: 0.1 }, tres)).toBe(67);
  });
});
