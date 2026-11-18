import {
  leerEstado,
  queryEstado,
  validarParametrosGrafo,
  LIMITE_BUSQUEDA,
  LIMITE_VECINOS,
} from "@/lib/inteligencia/parametros";

const p = (qs: string) => validarParametrosGrafo(new URLSearchParams(qs));

describe("validarParametrosGrafo", () => {
  it("por defecto: esquema mensual de la carga más reciente", () => {
    expect(p("")).toEqual({
      parametros: { modo: "esquema", granularidad: "mensual", periodo: null, tipo: null, id: null, q: "", limite: LIMITE_VECINOS },
    });
  });

  it("vecindario exige tipo e id válidos", () => {
    expect(p("modo=vecindario&tipo=profesional&id=1053&periodo=202610")).toEqual({
      parametros: { modo: "vecindario", granularidad: "mensual", periodo: "202610", tipo: "profesional", id: "1053", q: "", limite: LIMITE_VECINOS },
    });
    expect(p("modo=vecindario&id=1")).toEqual({ error: "El tipo de elemento no es válido" });
    expect(p("modo=vecindario&tipo=paciente&id=1")).toEqual({ error: "El tipo de elemento no es válido" });
    expect(p("modo=vecindario&tipo=profesional")).toEqual({ error: "El identificador no es válido para el tipo" });
    expect(p("modo=vecindario&tipo=profesional&id=abc")).toEqual({ error: "El identificador no es válido para el tipo" });
  });

  it("limite entre 1 y 100", () => {
    expect(p("modo=vecindario&tipo=categoria&id=rx&limite=10")).toMatchObject({ parametros: { limite: 10 } });
    for (const l of ["0", "101", "2.5", "x"]) {
      expect(p(`modo=vecindario&tipo=categoria&id=rx&limite=${l}`)).toEqual({ error: "El límite debe ser un entero entre 1 y 100" });
    }
  });

  it("buscar con texto (2 a 80 caracteres) o con un tipo", () => {
    expect(p("modo=buscar&q=%20ana%20")).toMatchObject({ parametros: { modo: "buscar", q: "ana", tipo: null, limite: LIMITE_BUSQUEDA } });
    expect(p("modo=buscar&tipo=servicio")).toMatchObject({ parametros: { q: "", tipo: "servicio" } });
    expect(p("modo=buscar&q=a")).toEqual({ error: "Escriba al menos 2 caracteres o elija un tipo" });
    expect(p(`modo=buscar&q=${"a".repeat(81)}`)).toEqual({ error: "La búsqueda no puede superar los 80 caracteres" });
    expect(p("modo=buscar&tipo=x&q=ana")).toEqual({ error: "El tipo de elemento no es válido" });
  });

  it("rechaza modo, granularidad o periodo no válidos y parámetros repetidos", () => {
    expect(p("modo=todo")).toEqual({ error: "El modo debe ser esquema, vecindario o buscar" });
    expect(p("granularidad=anual")).toEqual({ error: "La granularidad debe ser mensual o semanal" });
    expect(p("periodo=2026-10")).toEqual({ error: "El periodo debe tener el formato AAAAMM" });
    expect(p("granularidad=semanal&periodo=202610")).toEqual({ error: "La semana debe ser una fecha AAAA-MM-DD" });
    expect(p("modo=buscar&q=ab&q=cd")).toEqual({ error: "El parámetro q está repetido" });
  });

  it("acepta semanas por fecha inicial", () => {
    expect(p("granularidad=semanal&periodo=2026-11-09")).toMatchObject({ parametros: { granularidad: "semanal", periodo: "2026-11-09" } });
  });
});

describe("estado en la URL de la página", () => {
  it("lee nodo, periodo y granularidad tolerando valores no válidos", () => {
    expect(leerEstado(new URLSearchParams("nodo=profesional%3A1053&periodo=202610"))).toEqual({
      granularidad: "mensual", periodo: "202610", nodo: "profesional:1053",
    });
    expect(leerEstado(new URLSearchParams("nodo=paciente%3A1&granularidad=x"))).toEqual({
      granularidad: "mensual", periodo: null, nodo: null,
    });
  });

  it("escribe solo lo que no es por defecto", () => {
    expect(queryEstado({ granularidad: "mensual", periodo: null, nodo: null })).toBe("");
    expect(queryEstado({ granularidad: "semanal", periodo: "2026-11-09", nodo: "servicio:11" })).toBe(
      "granularidad=semanal&periodo=2026-11-09&nodo=servicio%3A11",
    );
  });
});
