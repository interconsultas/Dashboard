import {
  construirProductividad,
  resolverCarga,
  type CargaBD,
  type EntradaProductividad,
  type FilaProfesionalBD,
  type FilaServicioBD,
} from "@/lib/productividad/construir";
import { FILTROS_VACIOS, type FiltrosProductividad } from "@/lib/productividad/filtros";
import { metricasVacias, type Metricas } from "@/lib/productividad/metricas";

const MG = "Medicina general";
const SO = "Salud oral";
const ENF = "Enfermería";
const AREAS = [MG, SO, ENF];

const SERVICIOS = [
  { codigo: "11", nombre: "CONSULTA MEDICINA GENERAL", area: MG },
  { codigo: "12", nombre: "CONTROL MEDICINA GENERAL", area: MG },
  { codigo: "152", nombre: "ODONTOLOGIA", area: SO },
  { codigo: "300", nombre: "ENFERMERIA", area: ENF },
];

const CARGAS: CargaBD[] = [
  { granularidad: "mensual", periodo: 202608, fecha_inicial: "2026-08-01", fecha_final: "2026-08-31" },
  { granularidad: "mensual", periodo: 202609, fecha_inicial: "2026-09-01", fecha_final: "2026-09-30" },
  { granularidad: "mensual", periodo: 202610, fecha_inicial: "2026-10-01", fecha_final: "2026-10-31" },
  { granularidad: "semanal", periodo: 202610, fecha_inicial: "2026-10-05", fecha_final: "2026-10-11" },
];

function met(ofertadas: number, asignadas: number, inasistidas: number, disponibles: number): Metricas {
  return { ...metricasVacias(), ofertadas, asignadas, inasistidas, disponibles };
}

function fila(fecha: string, codigo: string, m: Metricas): FilaServicioBD {
  const s = SERVICIOS.find((x) => x.codigo === codigo)!;
  return { fecha_inicial: fecha, codigo_servicio: codigo, nombre_servicio: s.nombre, area: s.area, ...m };
}

const FILAS: FilaServicioBD[] = [
  fila("2026-08-01", "11", met(100, 90, 9, 10)),
  fila("2026-08-01", "152", met(50, 40, 8, 10)),
  fila("2026-09-01", "11", met(100, 80, 20, 20)),
  fila("2026-09-01", "300", met(10, 10, 0, 0)),
  fila("2026-10-01", "11", met(200, 180, 36, 20)),
  fila("2026-10-01", "12", met(20, 20, 2, 0)),
  fila("2026-10-01", "152", met(60, 50, 15, 10)),
  fila("2026-10-01", "300", met(30, 20, 1, 10)),
];

function prof(documento: string, codigo: string, m: Metricas, area_principal = MG): FilaProfesionalBD {
  const s = SERVICIOS.find((x) => x.codigo === codigo)!;
  return { documento, nombre: `PROFESIONAL ${documento}`, codigo_servicio: codigo, area: s.area, area_principal, ...m };
}

const PROFESIONALES: FilaProfesionalBD[] = [
  prof("1", "11", met(120, 100, 5, 20)), // ≥50 asignadas, 5 % → destacado
  prof("1", "152", met(10, 10, 5, 0)),
  prof("2", "11", met(80, 80, 31, 0)), // 38,75 % → no destacado
  prof("3", "300", met(30, 20, 1, 10), ENF), // < 50 asignadas
  prof("4", "12", met(0, 0, 0, 0)), // sin agenda
];

function entrada(filtros: Partial<FiltrosProductividad> = {}, extra: Partial<EntradaProductividad> = {}): EntradaProductividad {
  const f = { ...FILTROS_VACIOS, ...filtros };
  return {
    filtros: f,
    carga: resolverCarga(CARGAS, f.granularidad, f.periodo),
    cargas: CARGAS,
    areas: AREAS,
    servicios: SERVICIOS,
    filas: FILAS,
    profesionales: PROFESIONALES,
    ...extra,
  };
}

describe("resolverCarga", () => {
  it("sin periodo: la carga más reciente de la granularidad", () => {
    expect(resolverCarga(CARGAS, "mensual", null)?.periodo).toBe(202610);
    expect(resolverCarga(CARGAS, "semanal", null)?.fecha_inicial).toBe("2026-10-05");
  });

  it("con periodo existente: esa carga", () => {
    expect(resolverCarga(CARGAS, "mensual", "202609")?.periodo).toBe(202609);
  });

  it("con periodo inexistente: la más reciente", () => {
    expect(resolverCarga(CARGAS, "mensual", "202501")?.periodo).toBe(202610);
  });

  it("sin cargas de la granularidad: null", () => {
    expect(resolverCarga(CARGAS.filter((c) => c.granularidad === "mensual"), "semanal", null)).toBeNull();
  });
});

describe("construirProductividad — periodos y selección", () => {
  it("lista los periodos mensuales y semanales en orden cronológico con su etiqueta", () => {
    const r = construirProductividad(entrada());
    expect(r.periodos.mensual.map((p) => p.clave)).toEqual(["202608", "202609", "202610"]);
    expect(r.periodos.mensual[2].etiqueta).toBe("Oct 2026");
    expect(r.periodos.semanal.map((p) => p.clave)).toEqual(["2026-10-05"]);
    expect(r.granularidad).toBe("mensual");
    expect(r.periodo).toBe("202610");
  });

  it("opciones: áreas en orden, servicios y profesionales de la carga ordenados por nombre", () => {
    const r = construirProductividad(entrada());
    expect(r.opciones.areas).toEqual(AREAS);
    expect(r.opciones.servicios).toEqual(SERVICIOS);
    expect(r.opciones.profesionales.map((p) => p.documento)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("construirProductividad — KPIs", () => {
  it("periodo seleccionado y anterior, respetando área y servicio", () => {
    const r = construirProductividad(entrada({ area: MG }));
    expect(r.kpis.actual).toMatchObject({ ofertadas: 220, asignadas: 200, inasistidas: 38, disponibles: 20, perdidas: 58 });
    expect(r.kpis.actual!.pct_inasistencia).toBeCloseTo(0.19);
    expect(r.kpis.anterior).toMatchObject({ asignadas: 80, inasistidas: 20 });
    expect(r.kpis.periodo_anterior).toBe("202609");
  });

  it("el primer periodo no tiene anterior", () => {
    const r = construirProductividad(entrada({ periodo: "202608" }));
    expect(r.kpis.anterior).toBeNull();
    expect(r.kpis.periodo_anterior).toBeNull();
  });

  it("serie para sparklines: hasta el periodo seleccionado, máximo 12", () => {
    const r = construirProductividad(entrada({ periodo: "202609" }));
    expect(r.kpis.serie.map((p) => p.clave)).toEqual(["202608", "202609"]);

    const muchas: CargaBD[] = Array.from({ length: 14 }, (_, i) => {
      const periodo = 202501 + (i % 12) + Math.floor(i / 12) * 100;
      const mes = String(periodo % 100).padStart(2, "0");
      const anio = Math.floor(periodo / 100);
      return { granularidad: "mensual", periodo, fecha_inicial: `${anio}-${mes}-01`, fecha_final: `${anio}-${mes}-28` };
    });
    const r2 = construirProductividad({ ...entrada(), cargas: muchas, carga: resolverCarga(muchas, "mensual", null) });
    expect(r2.kpis.serie).toHaveLength(12);
    expect(r2.kpis.serie[11].clave).toBe("202602");
  });

  it("profesionales con agenda y destacados (≥ 50 asignadas y < 10 % de inasistencia)", () => {
    const r = construirProductividad(entrada());
    expect(r.profesionales.con_agenda).toBe(3);
    expect(r.profesionales.destacados).toBe(1);
  });

  it("los profesionales respetan área, servicio y profesional", () => {
    expect(construirProductividad(entrada({ area: ENF })).profesionales.con_agenda).toBe(1);
    expect(construirProductividad(entrada({ servicio: "152", area: SO })).profesionales.con_agenda).toBe(1);
    const soloUno = construirProductividad(entrada({ profesional: "2" }));
    expect(soloUno.profesionales.con_agenda).toBe(1);
    expect(soloUno.profesionales.lista[0]).toMatchObject({ documento: "2", asignadas: 80, inasistidas: 31 });
  });

  it("la lista de profesionales trae sus totales y su área principal, ordenada por citas perdidas", () => {
    const r = construirProductividad(entrada());
    expect(r.profesionales.lista.map((p) => p.documento)).toEqual(["2", "1", "3"]);
    expect(r.profesionales.lista[1]).toMatchObject({ documento: "1", asignadas: 110, inasistidas: 10, area_principal: MG });
  });
});

describe("construirProductividad — semántica de filtros por visual", () => {
  it("tendencia: todos los periodos, respeta área/servicio pero no el periodo", () => {
    const r = construirProductividad(entrada({ periodo: "202608", servicio: "11", area: MG }));
    expect(r.tendencia.map((p) => p.clave)).toEqual(["202608", "202609", "202610"]);
    expect(r.tendencia.map((p) => p.pct_inasistencia)).toEqual([0.1, 0.25, 0.2]);
  });

  it("tendencia: un periodo sin filas queda con porcentaje null", () => {
    const r = construirProductividad(entrada({ area: SO }));
    expect(r.tendencia.map((p) => p.pct_inasistencia)).toEqual([0.2, null, 0.3]);
  });

  it("embudo: periodo seleccionado con todos los filtros; atendidas = asignadas − inasistidas", () => {
    const r = construirProductividad(entrada({ area: SO }));
    expect(r.embudo).toEqual({ ofertadas: 60, asignadas: 50, atendidas: 35, disponibles: 10, inasistidas: 15 });
  });

  it("mapa de calor: área × periodo, respeta servicio pero no área ni periodo", () => {
    const r = construirProductividad(entrada({ area: SO, periodo: "202608" }));
    expect(r.mapa_calor.areas).toEqual(AREAS);
    expect(r.mapa_calor.periodos.map((p) => p.clave)).toEqual(["202608", "202609", "202610"]);
    expect(r.mapa_calor.celdas).toContainEqual({ area: MG, clave: "202610", pct_inasistencia: 0.19, inasistidas: 38, asignadas: 200 });
    // Sin asignadas no hay celda
    expect(r.mapa_calor.celdas.find((c) => c.area === SO && c.clave === "202609")).toBeUndefined();

    const conServicio = construirProductividad(entrada({ servicio: "11", area: MG }));
    expect(conServicio.mapa_calor.celdas.every((c) => c.area === MG)).toBe(true);
    expect(conServicio.mapa_calor.celdas.find((c) => c.clave === "202610")).toMatchObject({ asignadas: 180, inasistidas: 36 });
  });

  it("árbol: citas perdidas área → servicio del periodo, ignora área y servicio", () => {
    const r = construirProductividad(entrada({ area: SO, servicio: "152" }));
    expect(r.arbol.map((a) => [a.area, a.perdidas])).toEqual([[MG, 58], [SO, 25], [ENF, 11]]);
    expect(r.arbol[0].servicios.map((s) => [s.codigo, s.perdidas])).toEqual([["11", 56], ["12", 2]]);
  });

  it("árbol: omite áreas y servicios sin citas perdidas", () => {
    const r = construirProductividad(entrada({ periodo: "202609" }));
    expect(r.arbol.map((a) => a.area)).toEqual([MG]);
  });

  it("matriz: periodo seleccionado con todos los filtros, áreas con sus servicios y total", () => {
    const r = construirProductividad(entrada());
    expect(r.matriz.areas.map((a) => a.area)).toEqual(AREAS);
    expect(r.matriz.areas[0].servicios.map((s) => s.codigo)).toEqual(["11", "12"]);
    expect(r.matriz.areas[0]).toMatchObject({ ofertadas: 220, asignadas: 200, inasistidas: 38, disponibles: 20, perdidas: 58 });
    expect(r.matriz.total).toMatchObject({ ofertadas: 310, asignadas: 270, inasistidas: 54, disponibles: 40, perdidas: 94 });
    expect(r.matriz.total!.pct_disponibilidad).toBeCloseTo(40 / 310);

    const filtrada = construirProductividad(entrada({ servicio: "12", area: MG }));
    expect(filtrada.matriz.areas).toHaveLength(1);
    expect(filtrada.matriz.areas[0].servicios.map((s) => s.codigo)).toEqual(["12"]);
    expect(filtrada.matriz.total).toMatchObject({ asignadas: 20 });
  });

  it("un servicio que no pertenece al área filtrada deja vacíos los visuales filtrados", () => {
    const r = construirProductividad(entrada({ area: SO, servicio: "11" }));
    expect(r.matriz.areas).toEqual([]);
    expect(r.kpis.actual).toMatchObject({ asignadas: 0 });
    expect(r.arbol.length).toBeGreaterThan(0);
  });
});

describe("construirProductividad — sin datos", () => {
  it("sin cargas devuelve todo vacío sin fallar", () => {
    const r = construirProductividad({ ...entrada(), cargas: [], carga: null, filas: [], profesionales: [] });
    expect(r.periodo).toBeNull();
    expect(r.periodos).toEqual({ mensual: [], semanal: [] });
    expect(r.kpis).toEqual({ actual: null, anterior: null, periodo_anterior: null, serie: [] });
    expect(r.tendencia).toEqual([]);
    expect(r.embudo).toBeNull();
    expect(r.mapa_calor.celdas).toEqual([]);
    expect(r.arbol).toEqual([]);
    expect(r.matriz).toEqual({ areas: [], total: null });
    expect(r.profesionales).toEqual({ con_agenda: 0, destacados: 0, lista: [] });
  });

  it("semanal sin cargas semanales: vacío pero conserva la lista mensual", () => {
    const r = construirProductividad(entrada({ granularidad: "semanal" }, { cargas: CARGAS.slice(0, 3), carga: null, filas: [] }));
    expect(r.periodo).toBeNull();
    expect(r.periodos.mensual).toHaveLength(3);
    expect(r.periodos.semanal).toEqual([]);
  });
});
