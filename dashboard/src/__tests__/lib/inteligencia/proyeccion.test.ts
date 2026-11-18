import {
  MIN_PERIODOS_PROYECCION,
  VENTANA_PROYECCION,
  pronosticoPunto,
  proyectarCantidad,
  proyectarPct,
  secuenciaCarga,
  siguienteCarga,
} from "@/lib/inteligencia/proyeccion";

const cerca = (v: number | null | undefined, esperado: number) => expect(v).toBeCloseTo(esperado, 6);

describe("pronosticoPunto", () => {
  it("una serie lineal se proyecta exacta (promedio ponderado + tendencia)", () => {
    cerca(pronosticoPunto([0.1, 0.2, 0.3]), 0.4);
    cerca(pronosticoPunto([10, 8, 6, 4]), 2);
  });

  it("una serie constante se proyecta igual", () => {
    cerca(pronosticoPunto([0.2, 0.2, 0.2, 0.2]), 0.2);
  });

  it("con dos puntos sigue la recta que los une", () => {
    cerca(pronosticoPunto([0.2, 0.1]), 0);
  });

  it("caso no lineal calculado a mano", () => {
    // PMP = (1·0,2 + 2·0,1 + 3·0,3) / 6 = 0,21667 centrado en t = 7/3; pendiente 0,05 → 0,21667 + 0,05·(4 − 7/3) = 0,3
    cerca(pronosticoPunto([0.2, 0.1, 0.3]), 0.3);
  });

  it("con menos de dos puntos no hay pronóstico", () => {
    expect(pronosticoPunto([0.3])).toBeNull();
    expect(pronosticoPunto([])).toBeNull();
  });
});

describe("proyectarPct", () => {
  it(`necesita al menos ${MIN_PERIODOS_PROYECCION} periodos`, () => {
    expect(proyectarPct([0.1, 0.2])).toBeNull();
    expect(proyectarPct([])).toBeNull();
  });

  it("rango = ± error absoluto medio del backtest a un paso", () => {
    // Backtest: con [0,2; 0,1] se pronostica 0 y fue 0,3 → EAM 0,3
    const p = proyectarPct([0.2, 0.1, 0.3])!;
    cerca(p.valor, 0.3);
    cerca(p.error, 0.3);
    cerca(p.min, 0); // recortado a [0, 1]
    cerca(p.max, 0.6);
    expect(p.periodos).toBe(3);
  });

  it("serie lineal: error 0 y rango puntual", () => {
    const p = proyectarPct([0.1, 0.12, 0.14, 0.16])!;
    cerca(p.valor, 0.18);
    cerca(p.error, 0);
    cerca(p.min, 0.18);
    cerca(p.max, 0.18);
    expect(p.direccion).toBe("sube");
    cerca(p.pendiente, 0.02);
  });

  it(`usa solo los últimos ${VENTANA_PROYECCION} periodos`, () => {
    const p = proyectarPct([0.9, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1])!;
    cerca(p.valor, 0.1);
    expect(p.periodos).toBe(VENTANA_PROYECCION);
    expect(p.direccion).toBe("estable");
  });

  it("recorta a [0, 1]", () => {
    expect(proyectarPct([0.5, 0.8, 0.95, 0.99])!.valor).toBeLessThanOrEqual(1);
    expect(proyectarPct([0.3, 0.2, 0.1, 0.02])!.valor).toBe(0);
    expect(proyectarPct([0.3, 0.2, 0.1, 0.02])!.direccion).toBe("baja");
  });

  it("dirección con tolerancia de 0,25 pp por periodo", () => {
    expect(proyectarPct([0.2, 0.202, 0.204])!.direccion).toBe("estable");
    expect(proyectarPct([0.2, 0.204, 0.208])!.direccion).toBe("sube");
    expect(proyectarPct([0.208, 0.204, 0.2])!.direccion).toBe("baja");
  });

  it("ignora valores no finitos", () => {
    expect(proyectarPct([0.1, Number.NaN, 0.2])).toBeNull();
    cerca(proyectarPct([0.1, Number.NaN, 0.2, 0.3])!.valor, 0.4);
  });
});

describe("proyectarCantidad", () => {
  it("redondea, no baja de 0 y no tiene techo", () => {
    const p = proyectarCantidad([100, 200, 300])!;
    expect(p.valor).toBe(400);
    expect(p.direccion).toBe("sube");
    expect(proyectarCantidad([30, 20, 10, 0])!.valor).toBe(0);
  });

  it("estable si la pendiente es menor al 1 % del promedio por periodo", () => {
    expect(proyectarCantidad([1000, 1005, 1010])!.direccion).toBe("estable");
    expect(proyectarCantidad([1000, 1020, 1040])!.direccion).toBe("sube");
  });

  it(`necesita ${MIN_PERIODOS_PROYECCION} periodos`, () => {
    expect(proyectarCantidad([1, 2])).toBeNull();
  });
});

describe("siguienteCarga", () => {
  it("mensual: el mes siguiente, también al cambiar de año", () => {
    expect(siguienteCarga({ granularidad: "mensual", periodo: 202610, fecha_inicial: "2026-10-01", fecha_final: "2026-10-31" })).toEqual({
      granularidad: "mensual",
      periodo: 202611,
      fecha_inicial: "2026-11-01",
      fecha_final: "2026-11-30",
    });
    expect(siguienteCarga({ granularidad: "mensual", periodo: 202612, fecha_inicial: "2026-12-01", fecha_final: "2026-12-31" })).toEqual({
      granularidad: "mensual",
      periodo: 202701,
      fecha_inicial: "2027-01-01",
      fecha_final: "2027-01-31",
    });
    expect(siguienteCarga({ granularidad: "mensual", periodo: 202801, fecha_inicial: "2028-01-01", fecha_final: "2028-01-31" }).fecha_final).toBe(
      "2028-02-29"
    );
  });

  it("semanal: los 7 días siguientes; el periodo es el mes de la fecha inicial", () => {
    expect(siguienteCarga({ granularidad: "semanal", periodo: 202611, fecha_inicial: "2026-11-09", fecha_final: "2026-11-15" })).toEqual({
      granularidad: "semanal",
      periodo: 202611,
      fecha_inicial: "2026-11-16",
      fecha_final: "2026-11-22",
    });
    expect(siguienteCarga({ granularidad: "semanal", periodo: 202612, fecha_inicial: "2026-12-28", fecha_final: "2027-01-03" })).toEqual({
      granularidad: "semanal",
      periodo: 202701,
      fecha_inicial: "2027-01-04",
      fecha_final: "2027-01-10",
    });
  });
});

describe("secuenciaCarga", () => {
  it("meses consecutivos difieren en 1, también entre años", () => {
    const dic = secuenciaCarga({ granularidad: "mensual", periodo: 202612, fecha_inicial: "2026-12-01" });
    const ene = secuenciaCarga({ granularidad: "mensual", periodo: 202701, fecha_inicial: "2027-01-01" });
    expect(ene - dic).toBe(1);
  });

  it("semanas consecutivas difieren en 1", () => {
    const a = secuenciaCarga({ granularidad: "semanal", periodo: 202611, fecha_inicial: "2026-11-02" });
    const b = secuenciaCarga({ granularidad: "semanal", periodo: 202611, fecha_inicial: "2026-11-09" });
    const c = secuenciaCarga({ granularidad: "semanal", periodo: 202611, fecha_inicial: "2026-11-23" });
    expect(b - a).toBe(1);
    expect(c - b).toBe(2);
  });
});

describe("dirección frente al último periodo real", () => {
  it("si la proyección queda por debajo del último valor, baja aunque la ventana venga en alza", () => {
    // Tendencia creciente con un salto al final: el pronóstico no alcanza el último valor
    const p = proyectarPct([0.26, 0.27, 0.28, 0.29, 0.3, 0.4])!;
    expect(p.pendiente).toBeGreaterThan(0);
    expect(p.valor).toBeLessThan(0.4);
    expect(p.direccion).toBe("baja");
  });

  it("si la proyección supera el último valor, sube", () => {
    expect(proyectarPct([0.1, 0.12, 0.14, 0.16])!.direccion).toBe("sube");
  });
});

