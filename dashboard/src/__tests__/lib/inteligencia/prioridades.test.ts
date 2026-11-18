import type { Alerta, SerieProyectada } from "@/lib/inteligencia/alertas";
import {
  IMPACTO_MINIMO,
  MAX_PRIORIDADES,
  candidatosPrioridad,
  impactoAlerta,
  ofertaPromedioPorProfesional,
  priorizar,
  type Candidato,
  type EntradaPrioridades,
} from "@/lib/inteligencia/prioridades";

/* ── Datos de prueba ─────────────────────────── */

const SIGUIENTE = { clave: "202611", etiqueta: "Nov 2026", etiqueta_larga: "Noviembre 2026" };

function servicio(area: string, id: string, actual: number, volumen: number, extra: Partial<Alerta> = {}): Alerta {
  return {
    regla: "inasistencia_servicio",
    gravedad: "alta",
    ambito: { tipo: "servicio", id, nombre: `Servicio ${id}`, area },
    mensaje: "m",
    valores: { actual, umbral: 0.2, serie: [], volumen },
    magnitud: actual - 0.2,
    enlace: `/dashboard/productividad?periodo=202610&area=${area}&servicio=${id}`,
    ...extra,
  };
}

function disponibilidad(area: string, id: string, actual: number, volumen: number): Alerta {
  return {
    ...servicio(area, id, actual, volumen),
    regla: "disponibilidad_servicio",
    gravedad: "media",
    valores: { actual, umbral: 0.15, serie: [], volumen },
  };
}

function profesional(id: string, actual: number, volumen: number): Alerta {
  return {
    regla: "inasistencia_profesional",
    gravedad: "media",
    ambito: { tipo: "profesional", id, nombre: `Profesional ${id}`, area: "Psicosocial" },
    mensaje: "m",
    valores: { actual, umbral: 0.3, serie: [], volumen },
    magnitud: actual - 0.3,
    enlace: `/dashboard/productividad?periodo=202610&ficha=${id}`,
  };
}

function proyeccion(area: string, valor: number): Alerta {
  return {
    regla: "proyeccion_sobre_meta",
    gravedad: "alta",
    ambito: { tipo: "area", id: area, nombre: area, area },
    mensaje: "m",
    valores: { actual: valor, umbral: 0.1, serie: [], rango: { min: valor - 0.02, max: valor + 0.02 } },
    magnitud: valor - 0.1,
    enlace: `/dashboard/productividad?periodo=202610&area=${area}`,
  };
}

const serieArea = (id: string, asignadasProyectadas: number | null, asignadasUltimo = 1000): SerieProyectada => ({
  id,
  nombre: id,
  area: id,
  historia: [],
  asignadas_ultimo: asignadasUltimo,
  inasistencia: null,
  asignadas:
    asignadasProyectadas === null
      ? null
      : { valor: asignadasProyectadas, min: 0, max: 0, error: 0, pendiente: 0, direccion: "estable", periodos: 3 },
});

function entrada(alertas: Alerta[], extra: Partial<EntradaPrioridades> = {}): EntradaPrioridades {
  return {
    granularidad: "mensual",
    periodo: "202610",
    alertas,
    proyeccionAreas: [serieArea("Psicosocial", 2000), serieArea("Nutrición", 500)],
    siguiente: SIGUIENTE,
    ofertaPorProfesional: 100,
    meta: 0.1,
    ...extra,
  };
}

const candidato = (id: string, citas: number, extra: Partial<Candidato> = {}): Candidato => ({
  id,
  tipo: "inasistencia_area",
  area: id,
  titular: id,
  citas,
  profesionales: citas / 100,
  referencia: "por encima de la meta del 10 %",
  revisar: "r",
  enlace: "/dashboard/productividad",
  detalle: [],
  ...extra,
});

/* ── Impacto ─────────────────────────────────── */

describe("impactoAlerta", () => {
  it("inasistencia: inasistidas − asignadas × meta institucional (no el umbral de la regla)", () => {
    // 200 asignadas al 35 % = 70 inasistidas; meta 10 % → 20 permitidas → 50 por encima
    expect(impactoAlerta(servicio("Psicosocial", "1", 0.35, 200), [], 0.1)).toBeCloseTo(50);
  });

  it("disponibilidad: disponibles − ofertadas × umbral de la regla (no hay meta institucional)", () => {
    expect(impactoAlerta(disponibilidad("Nutrición", "2", 0.25, 400), [], 0.1)).toBeCloseTo(40);
  });

  it("profesional: inasistidas por encima de la meta", () => {
    expect(impactoAlerta(profesional("9", 0.4, 100), [], 0.1)).toBeCloseTo(30);
  });

  it("proyección: (proyectado − meta) × asignadas proyectadas, aunque la regla tenga otro umbral", () => {
    const conUmbral = { ...proyeccion("Psicosocial", 0.15), valores: { ...proyeccion("Psicosocial", 0.15).valores, umbral: 0.12 } };
    expect(impactoAlerta(conUmbral, [serieArea("Psicosocial", 2000)], 0.1)).toBeCloseTo(100);
    expect(impactoAlerta(proyeccion("Psicosocial", 0.15), [serieArea("Psicosocial", null, 800)], 0.1)).toBeCloseTo(40);
    expect(impactoAlerta(proyeccion("Otra", 0.15), [], 0.1)).toBe(0);
  });
});

describe("ofertaPromedioPorProfesional", () => {
  it("ofertadas ÷ profesionales con agenda (mismo cálculo del simulador); sin profesionales null", () => {
    expect(ofertaPromedioPorProfesional(1000, 8)).toBe(125);
    expect(ofertaPromedioPorProfesional(1000, 0)).toBeNull();
  });
});

/* ── Consolidación ───────────────────────────── */

describe("candidatosPrioridad", () => {
  it("consolida los servicios con inasistencia en una prioridad por área y nombra los 3 peores", () => {
    const alertas = [
      servicio("Psicosocial", "1", 0.36, 500), // 130 sobre la meta
      servicio("Psicosocial", "2", 0.31, 200), // 42
      servicio("Psicosocial", "3", 0.25, 100), // 15
      servicio("Psicosocial", "4", 0.4, 300), // 90
      servicio("Nutrición", "5", 0.3, 100), // 20
    ];
    const c = candidatosPrioridad(entrada(alertas));
    const psico = c.find((x) => x.id === "inasistencia|Psicosocial")!;
    expect(psico.tipo).toBe("inasistencia_area");
    expect(psico.area).toBe("Psicosocial");
    expect(psico.titular).toBe(
      "Psicosocial: 4 servicios con inasistencia sostenida sobre 20 % — Servicio 1 (36 %), Servicio 4 (40 %), Servicio 2 (31 %) y 1 más"
    );
    expect(psico.citas).toBe(277);
    expect(psico.referencia).toBe("por encima de la meta del 10 %");
    expect(psico.profesionales).toBeCloseTo(2.77);
    expect(psico.revisar).toBe("Revisar recordatorios y sobreagenda en Psicosocial");
    expect(psico.enlace).toBe("/dashboard/productividad?periodo=202610&area=Psicosocial");
    expect(psico.detalle.map((d) => d.nombre)).toEqual(["Servicio 1", "Servicio 4", "Servicio 2", "Servicio 3"]);
    expect(psico.detalle[0].enlace).toBe(alertas[0].enlace);
    const nutri = c.find((x) => x.id === "inasistencia|Nutrición")!;
    expect(nutri.titular).toBe("Nutrición: 1 servicio con inasistencia sostenida sobre 20 % — Servicio 5 (30 %)");
  });

  it("disponibilidad: una prioridad por área", () => {
    const c = candidatosPrioridad(entrada([disponibilidad("Nutrición", "2", 0.25, 400), disponibilidad("Nutrición", "3", 0.2, 200)]));
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      id: "disponibilidad|Nutrición",
      tipo: "disponibilidad_area",
      citas: 50,
      referencia: "sin asignar por encima del 15 %",
      titular: "Nutrición: 2 servicios con más de 15 % de citas sin asignar — Servicio 2 (25 %) y Servicio 3 (20 %)",
      revisar: "Reasignar o reducir oferta en Nutrición",
    });
  });

  it("profesionales: una sola prioridad con el exceso combinado y los 3 de mayor exceso en el detalle", () => {
    const c = candidatosPrioridad(
      entrada([profesional("1", 0.4, 100), profesional("2", 0.5, 100), profesional("3", 0.35, 100), profesional("4", 0.6, 100)])
    );
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      id: "profesionales",
      tipo: "profesionales",
      area: null,
      citas: 145,
      referencia: "por encima de la meta del 10 %",
      titular: "4 profesionales con inasistencia sobre 30 %",
      revisar: "Conversar con los profesionales listados",
      enlace: "/dashboard/productividad?periodo=202610",
    });
    expect(c[0].detalle.map((d) => d.nombre)).toEqual(["Profesional 4", "Profesional 2", "Profesional 1"]);
    expect(c[0].detalle[0].enlace).toBe("/dashboard/productividad?periodo=202610&ficha=4");
  });

  it("proyección: prioridad propia si el área no tiene inasistencia sostenida", () => {
    const c = candidatosPrioridad(entrada([proyeccion("Nutrición", 0.3)]));
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      id: "proyeccion|Nutrición",
      tipo: "proyeccion_area",
      citas: 100,
      referencia: "por encima de la meta del 10 % (proyectadas)",
      titular: "Nutrición: se proyecta 30 % de inasistencia para Noviembre 2026, en alza (meta 10 %)",
      revisar: "Anticipar recordatorios y sobreagenda en Nutrición",
    });
  });

  it("proyección: se fusiona con la inasistencia del área solo como texto; el impacto es el del periodo actual", () => {
    const c = candidatosPrioridad(entrada([servicio("Psicosocial", "1", 0.3, 100), proyeccion("Psicosocial", 0.15)]));
    expect(c).toHaveLength(1);
    expect(c[0].id).toBe("inasistencia|Psicosocial");
    expect(c[0].titular).toBe(
      "Psicosocial: 1 servicio con inasistencia sostenida sobre 20 % — Servicio 1 (30 %), y se proyecta 15 % para Noviembre 2026"
    );
    // 100 × (30 % − 10 %) = 20; la proyección (100) no cambia el número
    expect(c[0].citas).toBe(20);
    expect(c[0].referencia).toBe("por encima de la meta del 10 %");
  });

  it("sin oferta por profesional no calcula profesionales equivalentes; con granularidad semanal la conserva en el enlace", () => {
    const [c] = candidatosPrioridad(entrada([servicio("Psicosocial", "1", 0.3, 1000)], { ofertaPorProfesional: null }));
    expect(c.profesionales).toBeNull();
    const [s] = candidatosPrioridad(entrada([servicio("Psicosocial", "1", 0.3, 1000)], { granularidad: "semanal", periodo: "2026-11-09" }));
    expect(s.enlace).toBe("/dashboard/productividad?granularidad=semanal&periodo=2026-11-09&area=Psicosocial");
  });

  it("sin alertas no hay candidatos", () => {
    expect(candidatosPrioridad(entrada([]))).toEqual([]);
  });
});

/* ── Priorización ────────────────────────────── */

describe("priorizar", () => {
  it("solo entran las de impacto material (≥ mínimo), ordenadas por impacto", () => {
    const p = priorizar([candidato("A", 60), candidato("B", IMPACTO_MINIMO - 1), candidato("C", 300)], null);
    expect(p.map((x) => x.id)).toEqual(["C", "A"]);
    expect(IMPACTO_MINIMO).toBe(50);
  });

  it("como máximo 5", () => {
    const p = priorizar([100, 200, 300, 400, 500, 600, 700].map((n) => candidato(`P${n}`, n)), null);
    expect(MAX_PRIORIDADES).toBe(5);
    expect(p.map((x) => x.id)).toEqual(["P700", "P600", "P500", "P400", "P300"]);
  });

  it("ninguna supera el mínimo: lista vacía", () => {
    expect(priorizar([candidato("A", 10)], null)).toEqual([]);
  });

  it("novedad: Nuevo si no calificaba en el periodo anterior, Empeora si creció ≥ 10 %, si no Persiste", () => {
    const anterior = [candidato("Empeora", 100), candidato("Persiste", 100), candidato("Bajo", 20)];
    const p = priorizar([candidato("Empeora", 110), candidato("Persiste", 105), candidato("Bajo", 60), candidato("Nuevo", 70)], anterior);
    const por = Object.fromEntries(p.map((x) => [x.id, x]));
    expect(por.Empeora.novedad).toBe("empeora");
    expect(por.Empeora.citas_anterior).toBe(100);
    expect(por.Persiste.novedad).toBe("persiste");
    expect(por.Bajo.novedad).toBe("nuevo");
    expect(por.Bajo.citas_anterior).toBe(20);
    expect(por.Nuevo.novedad).toBe("nuevo");
    expect(por.Nuevo.citas_anterior).toBeNull();
  });

  it("sin periodo anterior todas son nuevas", () => {
    expect(priorizar([candidato("A", 60)], null)[0].novedad).toBe("nuevo");
  });

  it("Nuevo o Empeora desempatan impactos cercanos (≤ 10 %), pero no saltan una diferencia grande", () => {
    const anterior = [candidato("Persiste", 100), candidato("Grande", 300)];
    const p = priorizar([candidato("Persiste", 105), candidato("Nuevo", 100), candidato("Grande", 300)], anterior);
    expect(p.map((x) => x.id)).toEqual(["Grande", "Nuevo", "Persiste"]);
    const q = priorizar([candidato("Persiste", 150), candidato("Nuevo", 100)], [candidato("Persiste", 150)]);
    expect(q.map((x) => x.id)).toEqual(["Persiste", "Nuevo"]);
  });

  it("el mínimo es configurable", () => {
    expect(priorizar([candidato("A", 30)], null, { minimo: 20 })).toHaveLength(1);
  });
});
