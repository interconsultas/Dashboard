import {
  evaluarAlertas,
  fmtUmbral,
  frasePeriodos,
  listaNatural,
  ordenarAlertas,
  type Alerta,
  type EntradaAlertas,
  type FilaProfesionalPeriodo,
  type FilaServicioPeriodo,
} from "@/lib/inteligencia/alertas";
import { REGLAS_POR_DEFECTO, CLAVES_REGLAS, type ClaveRegla, type ReglaAlerta } from "@/lib/inteligencia/reglas";
import type { RangoCarga } from "@/lib/productividad/periodos";

/* ── Datos de prueba ─────────────────────────── */

const mes = (periodo: number): RangoCarga => {
  const anio = Math.floor(periodo / 100);
  const m = periodo % 100;
  const fin = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { granularidad: "mensual", periodo, fecha_inicial: `${anio}-${mm}-01`, fecha_final: `${anio}-${mm}-${fin}` };
};

const CARGAS = [202607, 202608, 202609, 202610].map(mes);

function reglas(cambios: Partial<Record<ClaveRegla, Partial<ReglaAlerta>>> = {}): ReglaAlerta[] {
  return CLAVES_REGLAS.map((clave) => ({
    clave,
    ...REGLAS_POR_DEFECTO[clave],
    actualizado_en: null,
    actualizado_por: null,
    ...cambios[clave],
  }));
}

/** Fila de servicio con % de inasistencia y disponibilidad dados. */
function fila(
  periodo: number,
  area: string,
  codigo: string,
  asignadas: number,
  pctInasistencia: number,
  ofertadas = asignadas,
  disponibles = 0
): FilaServicioPeriodo {
  return {
    fecha_inicial: mes(periodo).fecha_inicial,
    area,
    codigo_servicio: codigo,
    nombre_servicio: `Servicio ${codigo}`,
    asignadas,
    inasistidas: Math.round(asignadas * pctInasistencia),
    ofertadas,
    disponibles,
  };
}

function entrada(extra: Partial<EntradaAlertas> = {}): EntradaAlertas {
  return {
    granularidad: "mensual",
    cargas: CARGAS,
    areas: ["Medicina general", "Psicosocial"],
    servicios: [],
    profesionales: [],
    reglas: reglas(),
    meta: 0.1,
    ...extra,
  };
}

const deRegla = (alertas: Alerta[], clave: ClaveRegla) => alertas.filter((a) => a.regla === clave);

/* ── Formatos ─────────────────────────────────── */

describe("formatos del mensaje", () => {
  it("fmtUmbral sin decimales innecesarios", () => {
    expect(fmtUmbral(0.2)).toBe("20 %");
    expect(fmtUmbral(0.125)).toBe("12,5 %");
  });

  it("listaNatural", () => {
    expect(listaNatural(["a"])).toBe("a");
    expect(listaNatural(["a", "b"])).toBe("a y b");
    expect(listaNatural(["a", "b", "c"])).toBe("a, b y c");
  });

  it("frasePeriodos en meses y semanas", () => {
    expect(frasePeriodos(1, "mensual")).toBe("en el último mes");
    expect(frasePeriodos(2, "mensual")).toBe("en los dos últimos meses");
    expect(frasePeriodos(6, "mensual")).toBe("en los seis últimos meses");
    expect(frasePeriodos(1, "semanal")).toBe("en la última semana");
    expect(frasePeriodos(3, "semanal")).toBe("en las tres últimas semanas");
  });
});

/* ── Regla: inasistencia por servicio ────────── */

describe("inasistencia_servicio", () => {
  it("alerta si supera el umbral en los dos últimos meses con el mínimo de asignadas", () => {
    const { alertas } = evaluarAlertas(
      entrada({
        servicios: [fila(202609, "Psicosocial", "890", 1000, 0.362), fila(202610, "Psicosocial", "890", 1000, 0.35)],
      })
    );
    const [a] = deRegla(alertas, "inasistencia_servicio");
    expect(a.mensaje).toBe("Psicosocial — Servicio 890: inasistencia 36,2 % y 35,0 % en los dos últimos meses (umbral 20 %)");
    expect(a.gravedad).toBe("alta");
    expect(a.ambito).toEqual({ tipo: "servicio", id: "890", nombre: "Servicio 890", area: "Psicosocial" });
    expect(a.valores.actual).toBeCloseTo(0.35);
    expect(a.valores.umbral).toBe(0.2);
    expect(a.valores.serie.map((s) => s.clave)).toEqual(["202609", "202610"]);
    expect(a.magnitud).toBeCloseTo(0.15);
    expect(a.enlace).toBe("/dashboard/productividad?periodo=202610&area=Psicosocial&servicio=890");
  });

  it("no alerta si solo el último mes supera el umbral", () => {
    const { alertas } = evaluarAlertas(
      entrada({ servicios: [fila(202609, "Psicosocial", "890", 400, 0.1), fila(202610, "Psicosocial", "890", 400, 0.4)] })
    );
    expect(deRegla(alertas, "inasistencia_servicio")).toHaveLength(0);
  });

  it("no alerta si un mes no llega al mínimo de asignadas", () => {
    const { alertas } = evaluarAlertas(
      entrada({ servicios: [fila(202609, "Psicosocial", "890", 29, 0.5), fila(202610, "Psicosocial", "890", 400, 0.4)] })
    );
    expect(deRegla(alertas, "inasistencia_servicio")).toHaveLength(0);
  });

  it("igual al umbral no alerta (debe superarlo)", () => {
    const { alertas } = evaluarAlertas(
      entrada({ servicios: [fila(202609, "Psicosocial", "890", 100, 0.2), fila(202610, "Psicosocial", "890", 100, 0.2)] })
    );
    expect(deRegla(alertas, "inasistencia_servicio")).toHaveLength(0);
  });

  it("los periodos deben ser consecutivos: un mes faltante corta la racha", () => {
    const { alertas } = evaluarAlertas(
      entrada({
        cargas: [202607, 202608, 202610].map(mes),
        servicios: [fila(202608, "Psicosocial", "890", 400, 0.4), fila(202610, "Psicosocial", "890", 400, 0.4)],
      })
    );
    expect(deRegla(alertas, "inasistencia_servicio")).toHaveLength(0);
  });

  it("con más periodos que cargas no alerta", () => {
    const { alertas } = evaluarAlertas(
      entrada({
        cargas: [mes(202610)],
        servicios: [fila(202610, "Psicosocial", "890", 400, 0.4)],
      })
    );
    expect(deRegla(alertas, "inasistencia_servicio")).toHaveLength(0);
  });

  it("respeta los periodos configurados (3) y suma las filas del mismo servicio", () => {
    const servicios = [202608, 202609, 202610].flatMap((p) => [fila(p, "Psicosocial", "890", 20, 0.3), fila(p, "Psicosocial", "890", 20, 0.3)]);
    const { alertas } = evaluarAlertas(entrada({ servicios, reglas: reglas({ inasistencia_servicio: { periodos: 3 } }) }));
    const [a] = deRegla(alertas, "inasistencia_servicio");
    expect(a.mensaje).toBe("Psicosocial — Servicio 890: inasistencia 30,0 %, 30,0 % y 30,0 % en los tres últimos meses (umbral 20 %)");
  });

  it("una regla inactiva no se evalúa y cuenta 0", () => {
    const { alertas, conteo } = evaluarAlertas(
      entrada({
        servicios: [fila(202609, "Psicosocial", "890", 400, 0.4), fila(202610, "Psicosocial", "890", 400, 0.4)],
        reglas: reglas({ inasistencia_servicio: { activa: false } }),
      })
    );
    expect(deRegla(alertas, "inasistencia_servicio")).toHaveLength(0);
    expect(conteo.inasistencia_servicio).toBe(0);
  });
});

/* ── Regla: disponibilidad por servicio ──────── */

describe("disponibilidad_servicio", () => {
  it("alerta en el último periodo con el mínimo de ofertadas", () => {
    const { alertas } = evaluarAlertas(
      entrada({ servicios: [fila(202610, "Medicina general", "100", 532, 0, 652, 120)] })
    );
    const [a] = deRegla(alertas, "disponibilidad_servicio");
    expect(a.mensaje).toBe(
      "Medicina general — Servicio 100: disponibilidad 18,4 % en Octubre 2026 (umbral 15 %); 120 de 652 citas ofertadas sin asignar"
    );
    expect(a.gravedad).toBe("media");
    expect(a.valores.volumen).toBe(652);
  });

  it("no alerta con menos ofertadas que el mínimo ni por periodos anteriores", () => {
    const { alertas } = evaluarAlertas(
      entrada({
        servicios: [fila(202610, "Medicina general", "100", 10, 0, 29, 19), fila(202609, "Medicina general", "200", 10, 0, 100, 90)],
      })
    );
    expect(deRegla(alertas, "disponibilidad_servicio")).toHaveLength(0);
  });
});

/* ── Regla: inasistencia por profesional ─────── */

describe("inasistencia_profesional", () => {
  const prof = (documento: string, asignadas: number, inasistidas: number): FilaProfesionalPeriodo => ({
    documento,
    nombre: `PROFESIONAL ${documento}`,
    area_principal: "Medicina general",
    asignadas,
    inasistidas,
  });

  it("alerta con el mínimo de asignadas y enlaza a la ficha", () => {
    const { alertas } = evaluarAlertas(entrada({ profesionales: [prof("1", 50, 17), prof("2", 49, 40), prof("3", 100, 30)] }));
    const lista = deRegla(alertas, "inasistencia_profesional");
    expect(lista).toHaveLength(1);
    expect(lista[0].mensaje).toBe(
      "PROFESIONAL 1 (Medicina general): inasistencia 34,0 % en Octubre 2026 (umbral 30 %); 17 inasistidas de 50 asignadas"
    );
    expect(lista[0].ambito).toEqual({ tipo: "profesional", id: "1", nombre: "PROFESIONAL 1", area: "Medicina general" });
    expect(lista[0].enlace).toBe("/dashboard/productividad?periodo=202610&ficha=1");
  });
});

/* ── Regla: proyección sobre la meta ─────────── */

describe("proyeccion_sobre_meta y proyecciones", () => {
  const serieArea = (area: string, codigo: string, pcts: number[]) => CARGAS.map((c, i) => fila(c.periodo, area, codigo, 1000, pcts[i]));

  it("alerta si la proyección supera la meta y viene en alza", () => {
    const { alertas, proyeccion, siguiente } = evaluarAlertas(
      entrada({ servicios: [...serieArea("Psicosocial", "890", [0.08, 0.1, 0.12, 0.14]), ...serieArea("Medicina general", "100", [0.2, 0.18, 0.16, 0.14])] })
    );
    expect(siguiente).toMatchObject({ clave: "202611", etiqueta_larga: "Noviembre 2026" });
    const lista = deRegla(alertas, "proyeccion_sobre_meta");
    expect(lista).toHaveLength(1); // Medicina general está sobre la meta pero viene a la baja
    expect(lista[0].ambito).toEqual({ tipo: "area", id: "Psicosocial", nombre: "Psicosocial", area: "Psicosocial" });
    expect(lista[0].mensaje).toBe("Psicosocial: inasistencia proyectada 16,0 % para Noviembre 2026 (rango 16,0 %–16,0 %), en alza (meta 10 %)");
    expect(lista[0].enlace).toBe("/dashboard/productividad?periodo=202610&area=Psicosocial");

    const psico = proyeccion.areas.find((a) => a.id === "Psicosocial")!;
    expect(psico.inasistencia!.valor).toBeCloseTo(0.16);
    expect(psico.asignadas!.valor).toBe(1000);
    expect(psico.historia.map((h) => h.valor)).toEqual([0.08, 0.1, 0.12, 0.14]);
    expect(psico.historia[3]).toMatchObject({ clave: "202610", etiqueta: "Oct 2026" });
    // Las áreas siguen el orden de areas_servicio
    expect(proyeccion.areas.map((a) => a.id)).toEqual(["Medicina general", "Psicosocial"]);
  });

  it("con umbral configurado lo usa en vez de la meta", () => {
    const { alertas } = evaluarAlertas(
      entrada({
        servicios: serieArea("Psicosocial", "890", [0.08, 0.1, 0.12, 0.14]),
        reglas: reglas({ proyeccion_sobre_meta: { umbral: 0.2 } }),
      })
    );
    expect(deRegla(alertas, "proyeccion_sobre_meta")).toHaveLength(0);
  });

  it("con menos de 3 periodos no hay proyección ni alerta", () => {
    const { alertas, proyeccion } = evaluarAlertas(
      entrada({ cargas: CARGAS.slice(-2), servicios: serieArea("Psicosocial", "890", [0.1, 0.2, 0.3, 0.4]).slice(-2) })
    );
    expect(proyeccion.areas.find((a) => a.id === "Psicosocial")!.inasistencia).toBeNull();
    expect(deRegla(alertas, "proyeccion_sobre_meta")).toHaveLength(0);
  });

  it("los servicios proyectados son los de más asignadas en el último periodo", () => {
    const servicios = [
      ...CARGAS.map((c) => fila(c.periodo, "Psicosocial", "A", 100, 0.1)),
      ...CARGAS.map((c) => fila(c.periodo, "Psicosocial", "B", 300, 0.1)),
      fila(202609, "Psicosocial", "C", 900, 0.1), // no tuvo citas en el último periodo
    ];
    const { proyeccion } = evaluarAlertas(entrada({ servicios }));
    expect(proyeccion.servicios.map((s) => s.id)).toEqual(["B", "A"]);
    expect(proyeccion.servicios[0].area).toBe("Psicosocial");
  });

  it("un periodo sin asignadas queda sin valor en la historia y no cuenta", () => {
    const servicios = [fila(202607, "Psicosocial", "A", 100, 0.1), fila(202609, "Psicosocial", "A", 100, 0.1), fila(202610, "Psicosocial", "A", 100, 0.1)];
    const { proyeccion } = evaluarAlertas(entrada({ servicios }));
    const a = proyeccion.areas.find((x) => x.id === "Psicosocial")!;
    expect(a.historia.map((h) => h.valor)).toEqual([0.1, null, 0.1, 0.1]);
    expect(a.inasistencia!.periodos).toBe(3);
  });
});

/* ── Orden y casos vacíos ─────────────────────── */

describe("orden y conteo", () => {
  it("primero gravedad alta, luego mayor magnitud", () => {
    const base = { ambito: { tipo: "servicio" as const, id: "x", nombre: "x", area: null }, mensaje: "", valores: { actual: 0, umbral: 0, serie: [] }, enlace: "" };
    const lista: Alerta[] = [
      { ...base, regla: "disponibilidad_servicio", gravedad: "media", magnitud: 0.5 },
      { ...base, regla: "inasistencia_servicio", gravedad: "alta", magnitud: 0.05 },
      { ...base, regla: "inasistencia_servicio", gravedad: "alta", magnitud: 0.2 },
    ];
    expect(ordenarAlertas(lista).map((a) => a.magnitud)).toEqual([0.2, 0.05, 0.5]);
  });

  it("cuenta por regla y total", () => {
    const { conteo, total } = evaluarAlertas(
      entrada({ servicios: [fila(202609, "Psicosocial", "890", 400, 0.4), fila(202610, "Psicosocial", "890", 400, 0.4, 600, 200)] })
    );
    expect(conteo).toEqual({ inasistencia_servicio: 1, disponibilidad_servicio: 1, inasistencia_profesional: 0, proyeccion_sobre_meta: 0 });
    expect(total).toBe(2);
  });

  it("sin cargas no hay periodo, alertas ni proyecciones", () => {
    const r = evaluarAlertas(entrada({ cargas: [] }));
    expect(r.periodo).toBeNull();
    expect(r.siguiente).toBeNull();
    expect(r.alertas).toEqual([]);
    expect(r.proyeccion.areas.every((a) => a.inasistencia === null)).toBe(true);
  });

  it("semanal: frases en semanas y siguiente semana", () => {
    const semanas: RangoCarga[] = [
      { granularidad: "semanal", periodo: 202611, fecha_inicial: "2026-11-02", fecha_final: "2026-11-08" },
      { granularidad: "semanal", periodo: 202611, fecha_inicial: "2026-11-09", fecha_final: "2026-11-15" },
    ];
    const f = (fecha: string): FilaServicioPeriodo => ({ ...fila(202611, "Psicosocial", "890", 100, 0.4), fecha_inicial: fecha });
    const r = evaluarAlertas(entrada({ granularidad: "semanal", cargas: semanas, servicios: [f("2026-11-02"), f("2026-11-09")] }));
    expect(r.siguiente).toMatchObject({ clave: "2026-11-16", etiqueta_larga: "16–22 nov 2026" });
    expect(deRegla(r.alertas, "inasistencia_servicio")[0].mensaje).toContain("en las dos últimas semanas");
    expect(deRegla(r.alertas, "inasistencia_servicio")[0].enlace).toBe(
      "/dashboard/productividad?granularidad=semanal&periodo=2026-11-09&area=Psicosocial&servicio=890"
    );
  });
});
