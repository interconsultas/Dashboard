import {
  META_INASISTENCIA,
  indicadores,
  metricasVacias,
  sumarMetricas,
  variacion,
  type Metricas,
} from "@/lib/productividad/metricas";

function m(parcial: Partial<Metricas>): Metricas {
  return { ...metricasVacias(), ...parcial };
}

describe("META_INASISTENCIA", () => {
  it("es el 10 %", () => {
    expect(META_INASISTENCIA).toBe(0.1);
  });
});

describe("sumarMetricas", () => {
  it("suma cada métrica de todas las filas", () => {
    const total = sumarMetricas([
      m({ ofertadas: 10, asignadas: 8, inasistidas: 1, disponibles: 2, confirmadas: 7, canceladas: 1 }),
      m({ ofertadas: 5, asignadas: 4, inasistidas: 2, disponibles: 1, confirmadas: 2, bloqueadas: 3 }),
    ]);
    expect(total).toEqual(
      m({ ofertadas: 15, asignadas: 12, inasistidas: 3, disponibles: 3, confirmadas: 9, canceladas: 1, bloqueadas: 3 })
    );
  });

  it("sin filas devuelve todo en cero", () => {
    expect(sumarMetricas([])).toEqual(metricasVacias());
  });

  it("ignora campos que no son métricas", () => {
    const total = sumarMetricas([{ ...m({ asignadas: 2 }), area: "Salud oral" } as Metricas]);
    expect(total).not.toHaveProperty("area");
  });
});

describe("indicadores (fórmulas del Excel del cliente)", () => {
  const base = m({ ofertadas: 63616, asignadas: 56867, inasistidas: 9739, disponibles: 6749 });

  it("% inasistencia = inasistidas ÷ asignadas", () => {
    expect(indicadores(base).pct_inasistencia).toBeCloseTo(9739 / 56867, 10);
    expect(indicadores(base).pct_inasistencia! * 100).toBeCloseTo(17.1, 1);
  });

  it("% disponibilidad = disponibles ÷ ofertadas", () => {
    expect(indicadores(base).pct_disponibilidad! * 100).toBeCloseTo(10.6, 1);
  });

  it("citas perdidas = inasistidas + disponibles", () => {
    expect(indicadores(base).perdidas).toBe(16488);
  });

  it("atendidas = asignadas − inasistidas", () => {
    expect(indicadores(base).atendidas).toBe(56867 - 9739);
  });

  it("conserva las métricas de origen", () => {
    expect(indicadores(base)).toMatchObject(base);
  });

  it("sin denominador los porcentajes son null (no 0 %)", () => {
    const r = indicadores(metricasVacias());
    expect(r.pct_inasistencia).toBeNull();
    expect(r.pct_disponibilidad).toBeNull();
    expect(r.perdidas).toBe(0);
  });
});

describe("variacion", () => {
  it("relativa: cambio porcentual frente al anterior", () => {
    expect(variacion(110, 100, "relativa")).toBeCloseTo(10);
    expect(variacion(90, 100, "relativa")).toBeCloseTo(-10);
  });

  it("puntos: diferencia en puntos porcentuales entre dos razones", () => {
    expect(variacion(0.171, 0.15, "puntos")).toBeCloseTo(2.1);
  });

  it("es null sin valor anterior, sin actual o con anterior en cero (relativa)", () => {
    expect(variacion(10, null, "relativa")).toBeNull();
    expect(variacion(null, 0.1, "puntos")).toBeNull();
    expect(variacion(10, 0, "relativa")).toBeNull();
  });
});
