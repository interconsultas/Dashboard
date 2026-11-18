import type { CargaBD, FilaProfesionalBD } from "@/lib/productividad/construir";
import { construirFicha, type EntradaFicha, type FilaFichaBD } from "@/lib/productividad/ficha";
import { FILTROS_VACIOS } from "@/lib/productividad/filtros";
import { metricasVacias, type Metricas } from "@/lib/productividad/metricas";

const MG = "Medicina general";
const SO = "Salud oral";

const CARGAS: CargaBD[] = [
  { granularidad: "mensual", periodo: 202609, fecha_inicial: "2026-09-01", fecha_final: "2026-09-30" },
  { granularidad: "mensual", periodo: 202610, fecha_inicial: "2026-10-01", fecha_final: "2026-10-31" },
  { granularidad: "semanal", periodo: 202610, fecha_inicial: "2026-10-05", fecha_final: "2026-10-11" },
];
const OCT = CARGAS[1];

function met(asignadas: number, inasistidas: number, disponibles = 0): Metricas {
  return { ...metricasVacias(), ofertadas: asignadas + disponibles, asignadas, inasistidas, disponibles };
}

const NOMBRES: Record<string, [string, string]> = {
  "11": ["CONSULTA MEDICINA GENERAL", MG],
  "12": ["CONTROL MEDICINA GENERAL", MG],
  "152": ["ODONTOLOGIA", SO],
};

function fila(fecha: string, codigo: string, m: Metricas): FilaFichaBD {
  const [nombre_servicio, area] = NOMBRES[codigo];
  return { fecha_inicial: fecha, codigo_servicio: codigo, nombre_servicio, area, nombre: "PROFESIONAL 1", ...m };
}

function par(documento: string, codigo: string, m: Metricas): FilaProfesionalBD {
  return { documento, nombre: `PROFESIONAL ${documento}`, codigo_servicio: codigo, area: NOMBRES[codigo][1], area_principal: MG, ...m };
}

// Profesional 1 en octubre: 11 → 100/10, 152 → 50/20 (total 150/30 = 20 %)
const FILAS: FilaFichaBD[] = [
  fila("2026-09-01", "11", met(80, 4)),
  fila("2026-10-01", "11", met(100, 10, 5)),
  fila("2026-10-01", "152", met(50, 20, 15)),
];

const PARES: FilaProfesionalBD[] = [
  par("1", "11", met(100, 10, 5)),
  par("1", "152", met(50, 20, 15)),
  par("2", "11", met(100, 5)), // 5 %
  par("3", "11", met(100, 40)), // 40 %
  par("4", "11", met(60, 30)), // 50 %
  par("5", "152", met(30, 15)), // < 50 asignadas: no es par
];

function entrada(e: Partial<EntradaFicha> = {}): EntradaFicha {
  return { filtros: FILTROS_VACIOS, documento: "1", carga: OCT, cargas: CARGAS, filas: FILAS, pares: PARES, ...e };
}

describe("construirFicha", () => {
  it("sin filas del profesional en la granularidad no hay ficha", () => {
    expect(construirFicha(entrada({ filas: [] }))).toBeNull();
  });

  it("identifica al profesional y el periodo", () => {
    const f = construirFicha(entrada())!;
    expect(f).toMatchObject({
      documento: "1",
      nombre: "PROFESIONAL 1",
      area_principal: MG,
      granularidad: "mensual",
      periodo: "202610",
      etiqueta_periodo: "Octubre 2026",
    });
  });

  it("totales del periodo y servicios ordenados por asignadas", () => {
    const f = construirFicha(entrada())!;
    expect(f.actual).toMatchObject({ asignadas: 150, inasistidas: 30, disponibles: 20, pct_inasistencia: 0.2 });
    expect(f.servicios.map((s) => [s.codigo, s.asignadas, s.inasistidas])).toEqual([
      ["11", 100, 10],
      ["152", 50, 20],
    ]);
  });

  it("tendencia: un punto por carga de la granularidad", () => {
    const f = construirFicha(entrada())!;
    expect(f.tendencia.map((p) => [p.clave, p.etiqueta, p.pct_inasistencia])).toEqual([
      ["202609", "Sep 2026", 0.05],
      ["202610", "Oct 2026", 0.2],
    ]);
  });

  it("institución y percentil entre pares con ≥ 50 asignadas", () => {
    const f = construirFicha(entrada())!;
    // Todos los profesionales: 440 asignadas, 120 inasistidas
    expect(f.institucion.pct_inasistencia).toBeCloseTo(120 / 440);
    // Pares: 1 (20 %), 2 (5 %), 3 (40 %), 4 (50 %) → mayor inasistencia: 3 y 4 → 50
    expect(f.pares).toBe(4);
    expect(f.percentil).toBe(50);
  });

  it("los filtros de área y servicio aplican a totales, servicios, tendencia, institución y percentil", () => {
    const f = construirFicha(entrada({ filtros: { ...FILTROS_VACIOS, area: SO } }))!;
    expect(f.actual).toMatchObject({ asignadas: 50, inasistidas: 20 });
    expect(f.servicios.map((s) => s.codigo)).toEqual(["152"]);
    expect(f.tendencia.map((p) => p.asignadas)).toEqual([0, 50]);
    expect(f.institucion.pct_inasistencia).toBeCloseTo(35 / 80);
    // Solo él tiene ≥ 50 en Salud oral
    expect(f.pares).toBe(1);
    expect(f.percentil).toBe(0);
  });

  it("con menos de 50 asignadas no hay percentil", () => {
    const f = construirFicha(entrada({ filtros: { ...FILTROS_VACIOS, servicio: "12" } }))!;
    expect(f.actual).toBeNull();
    expect(f.percentil).toBeNull();
  });

  it("el filtro de profesional del tablero no afecta la comparación", () => {
    const f = construirFicha(entrada({ filtros: { ...FILTROS_VACIOS, profesional: "1" } }))!;
    expect(f.pares).toBe(4);
  });

  it("sin el profesional en el periodo: sin totales pero con tendencia", () => {
    const f = construirFicha(entrada({ carga: CARGAS[0] }))!;
    expect(f.periodo).toBe("202609");
    expect(f.actual).toMatchObject({ asignadas: 80 });
    const g = construirFicha(entrada({ pares: [], filas: FILAS.filter((r) => r.fecha_inicial === "2026-09-01") }))!;
    expect(g.actual).toBeNull();
    expect(g.servicios).toEqual([]);
    expect(g.area_principal).toBeNull();
    expect(g.tendencia).toHaveLength(2);
  });

  it("sin carga de la granularidad: periodo null", () => {
    const f = construirFicha(entrada({ carga: null }))!;
    expect(f.periodo).toBeNull();
    expect(f.etiqueta_periodo).toBeNull();
    expect(f.actual).toBeNull();
  });
});
