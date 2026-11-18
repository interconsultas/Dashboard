import {
  baseDesdeIndicadores,
  limitesPalancas,
  palancasBase,
  normalizarPalancas,
  resultadoBase,
  simular,
  compararEscenario,
  resumenEscenario,
  type BaseSimulador,
} from "@/lib/inteligencia/simulador";
import { indicadores, metricasVacias } from "@/lib/productividad/metricas";

/** O = A + D, como en el informe de Agenda Web. */
const BASE: BaseSimulador = { ofertadas: 1000, disponibles: 100, asignadas: 900, inasistidas: 180, profesionales: 10 };

describe("baseDesdeIndicadores", () => {
  it("toma los totales del periodo y los profesionales con agenda", () => {
    const ind = indicadores({ ...metricasVacias(), ofertadas: 1000, disponibles: 100, asignadas: 900, inasistidas: 180 });
    expect(baseDesdeIndicadores(ind, 10)).toEqual(BASE);
  });

  it("sin indicadores devuelve null", () => {
    expect(baseDesdeIndicadores(null, 10)).toBeNull();
  });
});

describe("palancasBase y límites", () => {
  it("los valores por defecto reproducen la realidad", () => {
    expect(palancasBase(BASE)).toEqual({ deltaProfesionales: 0, deltaOferta: 0, pctDisponibilidad: 0.1, pctInasistencia: 0.2 });
  });

  it("sin ofertadas ni asignadas los porcentajes base son 0", () => {
    const vacia = { ofertadas: 0, disponibles: 0, asignadas: 0, inasistidas: 0, profesionales: 0 };
    expect(palancasBase(vacia)).toEqual({ deltaProfesionales: 0, deltaOferta: 0, pctDisponibilidad: 0, pctInasistencia: 0 });
  });

  it("Δ profesionales va de −P+1 a +⌈P·0,5⌉", () => {
    expect(limitesPalancas(BASE).deltaProfesionales).toEqual({ min: -9, max: 5 });
    expect(limitesPalancas({ ...BASE, profesionales: 3 }).deltaProfesionales).toEqual({ min: -2, max: 2 });
  });

  it("sin profesionales la palanca de profesionales queda fija en 0", () => {
    expect(limitesPalancas({ ...BASE, profesionales: 0 }).deltaProfesionales).toEqual({ min: 0, max: 0 });
  });

  it("los rangos de porcentaje se amplían para incluir el valor real", () => {
    const l = limitesPalancas({ ...BASE, disponibles: 500, asignadas: 500, inasistidas: 300 });
    expect(l.deltaOferta).toEqual({ min: -0.3, max: 0.3 });
    expect(l.pctDisponibilidad).toEqual({ min: 0, max: 0.5 });
    expect(l.pctInasistencia).toEqual({ min: 0, max: 0.6 });
    expect(limitesPalancas(BASE).pctDisponibilidad).toEqual({ min: 0, max: 0.4 });
    expect(limitesPalancas(BASE).pctInasistencia).toEqual({ min: 0, max: 0.5 });
  });

  it("normalizarPalancas recorta a los límites y redondea Δ profesionales", () => {
    expect(
      normalizarPalancas(BASE, { deltaProfesionales: 99.4, deltaOferta: -2, pctDisponibilidad: -1, pctInasistencia: 0.9 })
    ).toEqual({ deltaProfesionales: 5, deltaOferta: -0.3, pctDisponibilidad: 0, pctInasistencia: 0.5 });
    expect(normalizarPalancas(BASE, { deltaProfesionales: NaN, deltaOferta: NaN, pctDisponibilidad: NaN, pctInasistencia: NaN })).toEqual(
      palancasBase(BASE)
    );
  });
});

describe("resultadoBase", () => {
  it("calcula atendidas, perdidas, equivalentes y la meta", () => {
    expect(resultadoBase(BASE)).toEqual({
      profesionales: 10,
      ofertadas: 1000,
      asignadas: 900,
      atendidas: 720,
      inasistidas: 180,
      disponibles: 100,
      perdidas: 280,
      pct_inasistencia: 0.2,
      pct_disponibilidad: 0.1,
      oferta_por_profesional: 100,
      profesionales_equivalentes_perdidos: 2.8,
      cumple_meta: false,
      inasistencias_a_evitar: 91,
    });
  });

  it("protege las divisiones por cero", () => {
    const r = resultadoBase({ ofertadas: 0, disponibles: 0, asignadas: 0, inasistidas: 0, profesionales: 0 });
    expect(r.pct_inasistencia).toBeNull();
    expect(r.pct_disponibilidad).toBeNull();
    expect(r.oferta_por_profesional).toBeNull();
    expect(r.profesionales_equivalentes_perdidos).toBeNull();
    expect(r.cumple_meta).toBeNull();
    expect(r.inasistencias_a_evitar).toBe(0);
  });
});

describe("simular", () => {
  it("con las palancas por defecto el escenario es igual a la realidad", () => {
    expect(simular(BASE, palancasBase(BASE))).toEqual(resultadoBase(BASE));
  });

  it("con porcentajes reales no redondos también reproduce la base", () => {
    const real = { ofertadas: 63616, disponibles: 6749, asignadas: 56867, inasistidas: 9739, profesionales: 174 };
    expect(simular(real, palancasBase(real))).toEqual(resultadoBase(real));
  });

  it("Δ profesionales escala la oferta por (P+Δ)/P", () => {
    const r = simular(BASE, { ...palancasBase(BASE), deltaProfesionales: 5 });
    expect(r.profesionales).toBe(15);
    expect(r.ofertadas).toBe(1500);
    expect(r.disponibles).toBe(150);
    expect(r.asignadas).toBe(1350);
    expect(r.inasistidas).toBe(270);
    expect(r.atendidas).toBe(1080);
    expect(r.oferta_por_profesional).toBe(100);
  });

  it("Δ oferta por profesional multiplica la oferta", () => {
    const r = simular(BASE, { ...palancasBase(BASE), deltaOferta: -0.2 });
    expect(r.ofertadas).toBe(800);
    expect(r.oferta_por_profesional).toBe(80);
  });

  it("% disponibilidad objetivo fija las disponibles y deja el resto asignado", () => {
    const r = simular(BASE, { ...palancasBase(BASE), pctDisponibilidad: 0 });
    expect(r.disponibles).toBe(0);
    expect(r.asignadas).toBe(1000);
    expect(r.inasistidas).toBe(200);
  });

  it("% inasistencia objetivo fija las inasistidas sobre las asignadas", () => {
    const r = simular(BASE, { ...palancasBase(BASE), pctInasistencia: 0.099 });
    expect(r.inasistidas).toBe(89);
    expect(r.atendidas).toBe(811);
    expect(r.perdidas).toBe(189);
    expect(r.cumple_meta).toBe(true);
    expect(r.inasistencias_a_evitar).toBe(0);
  });

  it("la meta es de un dígito: exactamente 10 % no la cumple", () => {
    const r = simular(BASE, { ...palancasBase(BASE), pctInasistencia: 0.1 });
    expect(r.inasistidas).toBe(90);
    expect(r.cumple_meta).toBe(false);
    expect(r.inasistencias_a_evitar).toBe(1);
  });

  it("redondea a citas enteras", () => {
    const r = simular({ ...BASE, profesionales: 3 }, { ...palancasBase(BASE), deltaProfesionales: 1 });
    expect(r.ofertadas).toBe(1333);
    expect(Number.isInteger(r.disponibles)).toBe(true);
    expect(Number.isInteger(r.inasistidas)).toBe(true);
    expect(r.asignadas + r.disponibles).toBe(r.ofertadas);
  });

  it("recorta las palancas fuera de rango", () => {
    expect(simular(BASE, { ...palancasBase(BASE), deltaProfesionales: 50 }).profesionales).toBe(15);
    expect(simular(BASE, { ...palancasBase(BASE), deltaProfesionales: -50 }).profesionales).toBe(1);
  });

  it("la meta: inasistencias a evitar hasta quedar por debajo del 10 %", () => {
    const r = simular(BASE, { ...palancasBase(BASE), pctInasistencia: 0.15 });
    expect(r.inasistidas).toBe(135);
    expect(r.inasistencias_a_evitar).toBe(46);
    expect(r.cumple_meta).toBe(false);
  });
});

describe("compararEscenario", () => {
  it("da la diferencia absoluta y porcentual de cada métrica", () => {
    const base = resultadoBase(BASE);
    const esc = simular(BASE, { ...palancasBase(BASE), deltaProfesionales: 5, pctInasistencia: 0.1 });
    const c = compararEscenario(base, esc);
    expect(c.ofertadas).toEqual({ base: 1000, escenario: 1500, delta: 500, delta_pct: 0.5 });
    expect(c.inasistidas).toEqual({ base: 180, escenario: 135, delta: -45, delta_pct: -0.25 });
    expect(c.atendidas.delta).toBe(495);
  });

  it("sin base el % de cambio es null", () => {
    const vacia = resultadoBase({ ofertadas: 0, disponibles: 0, asignadas: 0, inasistidas: 0, profesionales: 0 });
    expect(compararEscenario(vacia, vacia).ofertadas.delta_pct).toBeNull();
  });
});

describe("resumenEscenario", () => {
  it("describe el escenario en lenguaje llano", () => {
    const p = { ...palancasBase(BASE), deltaProfesionales: 3, pctInasistencia: 0.1 };
    const texto = resumenEscenario(resultadoBase(BASE), simular(BASE, p), p, palancasBase(BASE));
    expect(texto).toBe(
      "Con 3 profesionales más y la inasistencia en 10 %, se atenderían 333 citas más en el periodo y se perderían 33 citas menos — equivale a 0,3 profesionales."
    );
  });

  it("sin cambios lo dice", () => {
    expect(resumenEscenario(resultadoBase(BASE), resultadoBase(BASE), palancasBase(BASE), palancasBase(BASE))).toBe(
      "Mueva las palancas para comparar un escenario con lo que pasó en el periodo."
    );
  });

  it("con menos profesionales y más oferta lo describe en singular y plural", () => {
    const p = { ...palancasBase(BASE), deltaProfesionales: -1, deltaOferta: 0.1 };
    const texto = resumenEscenario(resultadoBase(BASE), simular(BASE, p), p, palancasBase(BASE));
    expect(texto).toMatch(/^Con 1 profesional menos y 10 % más de oferta por profesional, /);
  });
});
