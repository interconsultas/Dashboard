import {
  calcularFila,
  construirCumplimiento,
  promedio,
  type EntradaCumplimiento,
  type MetaCumplimiento,
} from "@/lib/cumplimiento/calcular";
import { CATEGORIAS } from "@/lib/cumplimiento/categorias";

/* ── Caso de control (tomado de la hoja de cálculo del cliente) ── */

const ORDENES_CONTROL: Record<string, number> = {
  medicamentos: 3515,
  laboratorios: 1397,
  proc_dx: 17,
  rx: 11,
  ecografias: 1,
  remisiones_cap: 3,
  remisiones_ext: 21,
};

const METAS_RCV: Record<string, number> = {
  medicamentos: 5.746656734947238,
  laboratorios: 2.298328988206083,
  proc_dx: 4.758783364369956,
  rx: 1.7693358162631905,
  ecografias: 0.16685288640595905,
  remisiones_cap: 1.4182495344506518,
  remisiones_ext: 10.530850403476101,
};

const PCT_CONTROL: Record<string, number> = {
  medicamentos: 1.825850715882227,
  laboratorios: 1.8144266008611212,
  proc_dx: 1.0663706407958125,
  rx: 1.8558275141273706,
  ecografias: 1.7890458422174838,
  remisiones_cap: 0.6314279443120532,
  remisiones_ext: 0.5952659544331487,
};

const GLOBAL_CONTROL = 1.3683164589470311;

function metasDe(programa: string, valores: Record<string, number>, anio = 2026): MetaCumplimiento[] {
  return Object.entries(valores).map(([categoria, valor]) => ({ anio, programa, categoria, valor }));
}

/** Filas planas (una por categoría) de un médico en un periodo, como las entrega la consulta. */
function entradas(
  base: { documento: string; nombre: string; periodo: number; citas: number | null; programa: string | null },
  ordenes: Record<string, number> = {}
): EntradaCumplimiento[] {
  const claves = Object.keys(ordenes);
  if (claves.length === 0) return [{ ...base, categoria: null, ordenes: null }];
  return claves.map((categoria) => ({ ...base, categoria, ordenes: ordenes[categoria] }));
}

const CLAVES = CATEGORIAS.map((c) => c.clave);

describe("promedio", () => {
  it("promedia los valores definidos e ignora los nulos", () => {
    expect(promedio([1, null, 3])).toBe(2);
  });

  it("retorna null cuando no hay ningún valor definido", () => {
    expect(promedio([])).toBeNull();
    expect(promedio([null, null])).toBeNull();
  });

  it("cuenta el cero como un valor", () => {
    expect(promedio([0, 2])).toBe(1);
  });
});

describe("calcularFila", () => {
  const metaRcv = (categoria: string) => METAS_RCV[categoria] ?? null;

  it("reproduce el caso de control de la hoja de cálculo", () => {
    const fila = calcularFila({ citas: 335, ordenes: ORDENES_CONTROL, metaDe: metaRcv });

    for (const clave of CLAVES) {
      expect(fila.categorias[clave].pct).toBeCloseTo(PCT_CONTROL[clave], 10);
      expect(fila.categorias[clave].ordenes).toBe(ORDENES_CONTROL[clave]);
      expect(fila.categorias[clave].meta).toBe(METAS_RCV[clave]);
    }
    expect(fila.global).toBeCloseTo(GLOBAL_CONTROL, 10);
  });

  it("calcula la tasa por cita en las categorías 'ratio' y por cada 100 citas en las 'x100'", () => {
    const fila = calcularFila({ citas: 335, ordenes: ORDENES_CONTROL, metaDe: metaRcv });

    expect(fila.categorias.medicamentos.tasa).toBeCloseTo(3515 / 335, 12);
    expect(fila.categorias.laboratorios.tasa).toBeCloseTo(1397 / 335, 12);
    expect(fila.categorias.proc_dx.tasa).toBeCloseTo((17 * 100) / 335, 12);
    expect(fila.categorias.remisiones_ext.tasa).toBeCloseTo((21 * 100) / 335, 12);
  });

  it.each([[null], [0]])("citas %p: todas las tasas, los porcentajes y el global son null", (citas) => {
    const fila = calcularFila({ citas, ordenes: ORDENES_CONTROL, metaDe: metaRcv });

    for (const clave of CLAVES) {
      expect(fila.categorias[clave].tasa).toBeNull();
      expect(fila.categorias[clave].pct).toBeNull();
      // Las órdenes y la meta se conservan para mostrarlas en el historial
      expect(fila.categorias[clave].ordenes).toBe(ORDENES_CONTROL[clave]);
      expect(fila.categorias[clave].meta).toBe(METAS_RCV[clave]);
    }
    expect(fila.global).toBeNull();
  });

  it("sin metas (médico sin programa): hay tasas pero ningún porcentaje ni global", () => {
    const fila = calcularFila({ citas: 100, ordenes: ORDENES_CONTROL, metaDe: () => null });

    for (const clave of CLAVES) {
      expect(fila.categorias[clave].tasa).not.toBeNull();
      expect(fila.categorias[clave].meta).toBeNull();
      expect(fila.categorias[clave].pct).toBeNull();
    }
    expect(fila.global).toBeNull();
  });

  it("una categoría sin meta queda en null y se excluye del global", () => {
    const fila = calcularFila({
      citas: 335,
      ordenes: ORDENES_CONTROL,
      metaDe: (c) => (c === "medicamentos" ? null : metaRcv(c)),
    });

    expect(fila.categorias.medicamentos.pct).toBeNull();
    const resto = CLAVES.filter((c) => c !== "medicamentos").map((c) => PCT_CONTROL[c]);
    expect(fila.global).toBeCloseTo(resto.reduce((a, b) => a + b, 0) / resto.length, 10);
  });

  it("una meta en cero o negativa se trata como meta ausente", () => {
    const fila = calcularFila({
      citas: 100,
      ordenes: { medicamentos: 10, laboratorios: 10 },
      metaDe: (c) => (c === "medicamentos" ? 0 : c === "laboratorios" ? -1 : null),
    });

    expect(fila.categorias.medicamentos.pct).toBeNull();
    expect(fila.categorias.laboratorios.pct).toBeNull();
    expect(fila.global).toBeNull();
  });

  it("una categoría con citas y sin órdenes es un 0 legítimo que entra en el global", () => {
    const fila = calcularFila({
      citas: 100,
      ordenes: { medicamentos: 200 },
      metaDe: (c) => (c === "medicamentos" ? 2 : c === "ecografias" ? 5 : null),
    });

    expect(fila.categorias.ecografias).toEqual({ ordenes: 0, tasa: 0, meta: 5, pct: 0 });
    expect(fila.categorias.medicamentos.pct).toBe(1);
    expect(fila.global).toBe(0.5);
  });

  it("incluye siempre las 7 categorías", () => {
    const fila = calcularFila({ citas: 10, ordenes: {}, metaDe: () => null });
    expect(Object.keys(fila.categorias)).toEqual(CLAVES);
  });
});

describe("construirCumplimiento", () => {
  const PEREZ = { documento: "10234567", nombre: "PEREZ JUAN" };
  const GOMEZ = { documento: "30345678", nombre: "GOMEZ ANA" };

  // Metas simples: 2 para medicamentos (ratio) y 10 para rx (x100) en RCV; 4 y 20 en CPR.
  const METAS: MetaCumplimiento[] = [
    ...metasDe("RCV", { medicamentos: 2, rx: 10 }),
    ...metasDe("CPR", { medicamentos: 4, rx: 20 }),
  ];

  it("arma la fila del caso de control a partir de filas planas", () => {
    const r = construirCumplimiento({
      entradas: entradas({ ...PEREZ, periodo: 202602, citas: 335, programa: "RCV" }, ORDENES_CONTROL),
      metas: metasDe("RCV", METAS_RCV),
    });

    expect(r.filas).toHaveLength(1);
    const fila = r.filas[0];
    expect(fila).toMatchObject({ documento: "10234567", nombre: "PEREZ JUAN", periodo: 202602, citas: 335, programa: "RCV" });
    for (const clave of CLAVES) {
      expect(fila.categorias[clave].pct).toBeCloseTo(PCT_CONTROL[clave], 10);
    }
    expect(fila.global).toBeCloseTo(GLOBAL_CONTROL, 10);
    expect(r.resumen.global).toBeCloseTo(GLOBAL_CONTROL, 10);
    expect(r.profesionales[0].global).toBeCloseTo(GLOBAL_CONTROL, 10);
    expect(r.serieMensual[0].global).toBeCloseTo(GLOBAL_CONTROL, 10);
  });

  it("toma la meta del año del periodo", () => {
    const r = construirCumplimiento({
      entradas: [
        ...entradas({ ...PEREZ, periodo: 202512, citas: 100, programa: "RCV" }, { medicamentos: 200 }),
        ...entradas({ ...PEREZ, periodo: 202601, citas: 100, programa: "RCV" }, { medicamentos: 200 }),
      ],
      metas: [
        { anio: 2025, programa: "RCV", categoria: "medicamentos", valor: 4 },
        { anio: 2026, programa: "RCV", categoria: "medicamentos", valor: 2 },
      ],
    });

    expect(r.filas.map((f) => f.categorias.medicamentos.pct)).toEqual([0.5, 1]);
  });

  it("toma la meta del programa de cada fila", () => {
    const r = construirCumplimiento({
      entradas: [
        ...entradas({ ...PEREZ, periodo: 202601, citas: 100, programa: "RCV" }, { medicamentos: 200 }),
        ...entradas({ ...GOMEZ, periodo: 202601, citas: 100, programa: "CPR" }, { medicamentos: 200 }),
      ],
      metas: METAS,
    });

    const porDoc = Object.fromEntries(r.filas.map((f) => [f.documento, f.categorias.medicamentos]));
    expect(porDoc[PEREZ.documento]).toMatchObject({ meta: 2, pct: 1 });
    expect(porDoc[GOMEZ.documento]).toMatchObject({ meta: 4, pct: 0.5 });
  });

  it("un médico con citas y sin órdenes aparece con ceros legítimos", () => {
    const r = construirCumplimiento({
      entradas: entradas({ ...PEREZ, periodo: 202601, citas: 50, programa: "RCV" }),
      metas: METAS,
    });

    const fila = r.filas[0];
    expect(fila.categorias.medicamentos).toEqual({ ordenes: 0, tasa: 0, meta: 2, pct: 0 });
    expect(fila.categorias.rx).toEqual({ ordenes: 0, tasa: 0, meta: 10, pct: 0 });
    expect(fila.categorias.laboratorios).toEqual({ ordenes: 0, tasa: 0, meta: null, pct: null });
    expect(fila.global).toBe(0);
  });

  it("un médico sin programa conserva sus órdenes pero no tiene porcentajes", () => {
    const r = construirCumplimiento({
      entradas: entradas({ ...PEREZ, periodo: 202601, citas: 50, programa: null }, { medicamentos: 100 }),
      metas: METAS,
    });

    expect(r.filas[0].categorias.medicamentos).toEqual({ ordenes: 100, tasa: 2, meta: null, pct: null });
    expect(r.filas[0].global).toBeNull();
    expect(r.profesionales[0]).toMatchObject({ programa: null, citas: 50, periodosConDatos: 0, global: null });
    expect(r.serieMensual[0]).toMatchObject({ periodo: 202601, profesionalesConDatos: 0, global: null });
    expect(r.resumen.global).toBeNull();
  });

  it("suma las órdenes repetidas de una misma categoría e ignora categorías desconocidas", () => {
    const base = { ...PEREZ, periodo: 202601, citas: 100, programa: "RCV" };
    const r = construirCumplimiento({
      entradas: [
        { ...base, categoria: "medicamentos", ordenes: 150 },
        { ...base, categoria: "medicamentos", ordenes: 50 },
        { ...base, categoria: "asesorias", ordenes: 999 },
      ],
      metas: METAS,
    });

    expect(r.filas).toHaveLength(1);
    expect(r.filas[0].categorias.medicamentos.ordenes).toBe(200);
    expect(Object.keys(r.filas[0].categorias)).toEqual(CLAVES);
  });

  describe("agregados de varios meses y varios médicos", () => {
    // PEREZ (RCV): ene pct med 1.0 / rx 0.5 → global 0.75; feb sin citas → null; mar pct med 2.0 / rx 1.5 → global 1.75
    // GOMEZ (CPR): ene pct med 0.5 / rx 0 → global 0.25; mar sin fila
    const ENTRADAS: EntradaCumplimiento[] = [
      ...entradas({ ...PEREZ, periodo: 202603, citas: 300, programa: "RCV" }, { medicamentos: 1200, rx: 45 }),
      ...entradas({ ...PEREZ, periodo: 202601, citas: 100, programa: "RCV" }, { medicamentos: 200, rx: 5 }),
      ...entradas({ ...PEREZ, periodo: 202602, citas: 0, programa: "RCV" }, { medicamentos: 80 }),
      ...entradas({ ...GOMEZ, periodo: 202601, citas: 200, programa: "CPR" }, { medicamentos: 400 }),
    ];
    const r = construirCumplimiento({ entradas: ENTRADAS, metas: METAS });

    it("ordena las filas por periodo ascendente y luego por nombre", () => {
      expect(r.filas.map((f) => [f.periodo, f.nombre])).toEqual([
        [202601, "GOMEZ ANA"],
        [202601, "PEREZ JUAN"],
        [202602, "PEREZ JUAN"],
        [202603, "PEREZ JUAN"],
      ]);
    });

    it("calcula el global de cada fila", () => {
      expect(r.filas.map((f) => f.global)).toEqual([0.25, 0.75, null, 1.75]);
    });

    it("profesionales: promedio simple de sus meses, sin ponderar por citas y sin los meses nulos", () => {
      expect(r.profesionales.map((p) => p.nombre)).toEqual(["GOMEZ ANA", "PEREZ JUAN"]);

      const perez = r.profesionales[1];
      expect(perez).toMatchObject({
        documento: "10234567",
        programa: "RCV",
        citas: 400,
        periodosConDatos: 2,
        global: 1.25,
      });
      expect(perez.pct.medicamentos).toBe(1.5);
      expect(perez.pct.rx).toBe(1);
      expect(perez.pct.laboratorios).toBeNull();

      expect(r.profesionales[0]).toMatchObject({ citas: 200, periodosConDatos: 1, global: 0.25 });
      expect(r.profesionales[0].pct.rx).toBe(0);
    });

    it("serieMensual: promedio simple de los médicos de cada mes, en orden ascendente", () => {
      expect(r.serieMensual.map((s) => s.periodo)).toEqual([202601, 202602, 202603]);

      expect(r.serieMensual[0]).toMatchObject({ profesionalesConDatos: 2, global: 0.5 });
      expect(r.serieMensual[0].pct.medicamentos).toBe(0.75);
      expect(r.serieMensual[0].pct.rx).toBe(0.25);

      expect(r.serieMensual[1]).toMatchObject({ profesionalesConDatos: 0, global: null });
      expect(r.serieMensual[1].pct.medicamentos).toBeNull();

      expect(r.serieMensual[2]).toMatchObject({ profesionalesConDatos: 1, global: 1.75 });
    });

    it("resumen: promedio simple de todas las filas con dato", () => {
      // globals 0.25, 0.75, 1.75 → 2.75 / 3
      expect(r.resumen.global).toBeCloseTo(2.75 / 3, 12);
      // medicamentos 0.5, 1, 2
      expect(r.resumen.pct.medicamentos).toBeCloseTo(3.5 / 3, 12);
      // rx 0, 0.5, 1.5
      expect(r.resumen.pct.rx).toBeCloseTo(2 / 3, 12);
      expect(r.resumen.pct.ecografias).toBeNull();
    });
  });

  it("profesionales: usa el programa y el nombre del periodo más reciente", () => {
    const r = construirCumplimiento({
      entradas: [
        ...entradas({ documento: "1", nombre: "PEREZ JUAN CARLOS", periodo: 202603, citas: 10, programa: null }),
        ...entradas({ documento: "1", nombre: "PEREZ JUAN", periodo: 202601, citas: 10, programa: "RCV" }),
        ...entradas({ documento: "1", nombre: "PEREZ JUAN", periodo: 202602, citas: 10, programa: "CPR" }),
      ],
      metas: METAS,
    });

    expect(r.profesionales).toHaveLength(1);
    // El periodo más reciente no tiene programa: se usa el último programa conocido
    expect(r.profesionales[0]).toMatchObject({ nombre: "PEREZ JUAN CARLOS", programa: "CPR", citas: 30 });
  });

  it("separa a dos médicos con el mismo nombre y los ordena por cédula", () => {
    const r = construirCumplimiento({
      entradas: [
        ...entradas({ documento: "20", nombre: "PEREZ JUAN", periodo: 202601, citas: 10, programa: "RCV" }),
        ...entradas({ documento: "10", nombre: "PEREZ JUAN", periodo: 202601, citas: 10, programa: "RCV" }),
      ],
      metas: METAS,
    });

    expect(r.profesionales.map((p) => p.documento)).toEqual(["10", "20"]);
  });

  it("sin entradas retorna estructuras vacías y un resumen sin datos", () => {
    const r = construirCumplimiento({ entradas: [], metas: METAS });

    expect(r.filas).toEqual([]);
    expect(r.profesionales).toEqual([]);
    expect(r.serieMensual).toEqual([]);
    expect(r.resumen.global).toBeNull();
    expect(Object.keys(r.resumen.pct)).toEqual(CLAVES);
    expect(Object.values(r.resumen.pct).every((v) => v === null)).toBe(true);
  });
});
