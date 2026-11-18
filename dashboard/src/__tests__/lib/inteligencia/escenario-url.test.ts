import {
  leerEstadoAlertas,
  leerPestana,
  leerEstadoSimulador,
  queryEstadoAlertas,
  queryPestana,
  queryEstadoSimulador,
  type EstadoSimulador,
} from "@/lib/inteligencia/parametros";

const qs = (s: string) => new URLSearchParams(s);

describe("leerPestana", () => {
  it("mapa por defecto; simulador si se pide", () => {
    expect(leerPestana(qs(""))).toBe("mapa");
    expect(leerPestana(qs("pestana=otra"))).toBe("mapa");
    expect(leerPestana(qs("pestana=simulador"))).toBe("simulador");
    expect(leerPestana(qs("pestana=alertas"))).toBe("alertas");
  });
});

describe("estado de Alertas en la URL", () => {
  it("lee la granularidad (mensual por defecto, lo no válido vuelve al defecto)", () => {
    expect(leerEstadoAlertas(qs("pestana=alertas"))).toEqual({ granularidad: "mensual" });
    expect(leerEstadoAlertas(qs("pestana=alertas&granularidad=semanal"))).toEqual({ granularidad: "semanal" });
    expect(leerEstadoAlertas(qs("pestana=alertas&granularidad=x"))).toEqual({ granularidad: "mensual" });
  });

  it("escribe la pestaña y solo la granularidad no por defecto", () => {
    expect(queryEstadoAlertas({ granularidad: "mensual" })).toBe("pestana=alertas");
    expect(queryEstadoAlertas({ granularidad: "semanal" })).toBe("pestana=alertas&granularidad=semanal");
  });
});

describe("queryPestana", () => {
  const ctx = { granularidad: "semanal" as const, periodo: "2026-11-09" };
  it("conserva granularidad y periodo al cambiar de pestaña (Alertas usa siempre el último periodo)", () => {
    expect(queryPestana("mapa", ctx)).toBe("granularidad=semanal&periodo=2026-11-09");
    expect(queryPestana("simulador", ctx)).toBe("pestana=simulador&granularidad=semanal&periodo=2026-11-09");
    expect(queryPestana("alertas", ctx)).toBe("pestana=alertas&granularidad=semanal");
    expect(queryPestana("mapa", { granularidad: "mensual", periodo: null })).toBe("");
  });
});

describe("leerEstadoSimulador", () => {
  it("sin parámetros: periodo más reciente, sin filtros y palancas reales", () => {
    expect(leerEstadoSimulador(qs("pestana=simulador"))).toEqual({
      granularidad: "mensual",
      periodo: null,
      area: null,
      servicio: null,
      palancas: {},
    });
  });

  it("lee filtros y palancas (porcentajes en la URL como %)", () => {
    expect(
      leerEstadoSimulador(qs("pestana=simulador&periodo=202610&area=Salud+oral&servicio=50110&prof=5&oferta=-10&disp=8.5&inas=10"))
    ).toEqual({
      granularidad: "mensual",
      periodo: "202610",
      area: "Salud oral",
      servicio: "50110",
      palancas: { deltaProfesionales: 5, deltaOferta: -0.1, pctDisponibilidad: 0.085, pctInasistencia: 0.1 },
    });
  });

  it("ignora valores no válidos", () => {
    expect(leerEstadoSimulador(qs("granularidad=semanal&periodo=202610&servicio=a%20b&prof=1.5&oferta=x&disp=&inas=-3"))).toEqual({
      granularidad: "semanal",
      periodo: null,
      area: null,
      servicio: null,
      palancas: {},
    });
  });
});

describe("queryEstadoSimulador", () => {
  const vacio: EstadoSimulador = { granularidad: "mensual", periodo: null, area: null, servicio: null, palancas: {} };

  it("siempre lleva la pestaña; el resto solo si no es por defecto", () => {
    expect(queryEstadoSimulador(vacio)).toBe("pestana=simulador");
  });

  it("es el inverso de leerEstadoSimulador", () => {
    const e: EstadoSimulador = {
      granularidad: "semanal",
      periodo: "2026-11-09",
      area: "Medicina general",
      servicio: "50110",
      palancas: { deltaProfesionales: -2, deltaOferta: 0.15, pctDisponibilidad: 0.0534, pctInasistencia: 0.1 },
    };
    const q = queryEstadoSimulador(e);
    expect(q).toBe(
      "pestana=simulador&granularidad=semanal&periodo=2026-11-09&area=Medicina+general&servicio=50110&prof=-2&oferta=15&disp=5.3&inas=10"
    );
    expect(leerEstadoSimulador(qs(q))).toEqual({ ...e, palancas: { ...e.palancas, pctDisponibilidad: 0.053 } });
  });
});
