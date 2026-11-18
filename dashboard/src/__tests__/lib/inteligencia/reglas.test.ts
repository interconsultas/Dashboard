import {
  CLAVES_REGLAS,
  PARAMETROS_REGLA,
  REGLAS_POR_DEFECTO,
  filaARegla,
  validarCambiosReglas,
} from "@/lib/inteligencia/reglas";

const valido = (extra: Record<string, unknown> = {}) => ({
  clave: "inasistencia_servicio",
  activa: true,
  umbral: 0.2,
  periodos: 2,
  minimo: 30,
  ...extra,
});

function error(cuerpo: unknown): string {
  const r = validarCambiosReglas(cuerpo);
  if (!("error" in r)) throw new Error("se esperaba un error");
  return r.error;
}

describe("catálogo de reglas", () => {
  it("cuatro reglas con sus valores por defecto", () => {
    expect(CLAVES_REGLAS).toEqual([
      "inasistencia_servicio",
      "disponibilidad_servicio",
      "inasistencia_profesional",
      "proyeccion_sobre_meta",
    ]);
    expect(REGLAS_POR_DEFECTO.inasistencia_servicio).toMatchObject({ umbral: 0.2, periodos: 2, minimo: 30, gravedad: "alta" });
    expect(REGLAS_POR_DEFECTO.disponibilidad_servicio).toMatchObject({ umbral: 0.15, periodos: null, minimo: 30, gravedad: "media" });
    expect(REGLAS_POR_DEFECTO.inasistencia_profesional).toMatchObject({ umbral: 0.3, periodos: null, minimo: 50, gravedad: "media" });
    expect(REGLAS_POR_DEFECTO.proyeccion_sobre_meta).toMatchObject({ umbral: null, periodos: null, minimo: null, gravedad: "alta" });
  });

  it("solo la inasistencia por servicio usa periodos y solo la proyección admite umbral vacío", () => {
    expect(CLAVES_REGLAS.filter((c) => PARAMETROS_REGLA[c].periodos)).toEqual(["inasistencia_servicio"]);
    expect(CLAVES_REGLAS.filter((c) => PARAMETROS_REGLA[c].umbralOpcional)).toEqual(["proyeccion_sobre_meta"]);
    expect(CLAVES_REGLAS.filter((c) => !PARAMETROS_REGLA[c].minimo)).toEqual(["proyeccion_sobre_meta"]);
  });
});

describe("filaARegla", () => {
  it("convierte NUMERIC (texto) a número y conserva los nulos", () => {
    const r = filaARegla({
      clave: "proyeccion_sobre_meta",
      nombre: "N",
      descripcion: "D",
      activa: true,
      umbral: null,
      periodos: null,
      minimo: null,
      gravedad: "alta",
      actualizado_en: "2026-11-18T10:00:00Z",
      actualizado_por: null,
    });
    expect(r.umbral).toBeNull();
    const s = filaARegla({ ...r, clave: "inasistencia_servicio", umbral: "0.2000", periodos: "2", minimo: 30 });
    expect(s).toMatchObject({ umbral: 0.2, periodos: 2, minimo: 30 });
  });

  it("TIMESTAMPTZ (Date de pg) se entrega en ISO", () => {
    const r = filaARegla({ clave: "inasistencia_servicio", nombre: "N", descripcion: "D", activa: true, umbral: "0.2", periodos: 2, minimo: 30, gravedad: "alta", actualizado_en: new Date("2026-11-18T15:00:00Z"), actualizado_por: "admin@ips.local" });
    expect(r.actualizado_en).toBe("2026-11-18T15:00:00.000Z");
  });
});

describe("validarCambiosReglas", () => {
  it("acepta cambios válidos", () => {
    const r = validarCambiosReglas({
      reglas: [
        valido(),
        { clave: "proyeccion_sobre_meta", activa: false, umbral: null, periodos: null, minimo: null },
        { clave: "disponibilidad_servicio", activa: true, umbral: 0, minimo: 0 },
      ],
    });
    expect(r).toEqual({
      cambios: [
        { clave: "inasistencia_servicio", activa: true, umbral: 0.2, periodos: 2, minimo: 30 },
        { clave: "proyeccion_sobre_meta", activa: false, umbral: null, periodos: null, minimo: null },
        { clave: "disponibilidad_servicio", activa: true, umbral: 0, periodos: null, minimo: 0 },
      ],
    });
  });

  it("exige al menos un cambio", () => {
    expect(error(null)).toBe("Debe enviar al menos una regla");
    expect(error({ reglas: [] })).toBe("Debe enviar al menos una regla");
  });

  it("regla desconocida o repetida", () => {
    expect(error({ reglas: [valido({ clave: "otra" })] })).toBe("Fila 1: la regla no existe");
    expect(error({ reglas: [valido(), valido()] })).toBe("Fila 2: la regla está repetida");
  });

  it("activa debe ser booleano", () => {
    expect(error({ reglas: [valido({ activa: "sí" })] })).toBe("Fila 1: indique si la regla está activa");
  });

  it.each([-0.01, 1.01, "0.2", null, Number.NaN])("umbral %p fuera de rango", (umbral) => {
    expect(error({ reglas: [valido({ umbral })] })).toBe("Fila 1: el umbral debe estar entre 0 % y 100 %");
  });

  it.each([0, 7, 1.5, null])("periodos %p fuera de rango", (periodos) => {
    expect(error({ reglas: [valido({ periodos })] })).toBe("Fila 1: los periodos deben ser un entero entre 1 y 6");
  });

  it.each([-1, 2.5, null, 1_000_001])("mínimo %p no válido", (minimo) => {
    expect(error({ reglas: [valido({ minimo })] })).toBe("Fila 1: el mínimo debe ser un entero mayor o igual que 0");
  });

  it("una regla que no usa periodos o mínimo no los acepta", () => {
    expect(error({ reglas: [{ clave: "disponibilidad_servicio", activa: true, umbral: 0.1, minimo: 30, periodos: 2 }] })).toBe(
      "Fila 1: esta regla no usa periodos"
    );
    expect(error({ reglas: [{ clave: "proyeccion_sobre_meta", activa: true, umbral: null, minimo: 5 }] })).toBe(
      "Fila 1: esta regla no usa mínimo"
    );
  });
});
