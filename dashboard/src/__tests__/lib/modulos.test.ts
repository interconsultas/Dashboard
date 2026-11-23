import {
  MODULOS_EN_DESARROLLO_POR_DEFECTO,
  leerModulosEnDesarrollo,
  modulosEnDesarrollo,
} from "@/lib/modulos";

describe("leerModulosEnDesarrollo", () => {
  it("sin variable usa el valor por defecto del código (Productividad e Inteligencia bloqueadas)", () => {
    expect(MODULOS_EN_DESARROLLO_POR_DEFECTO).toEqual(["productividad", "inteligencia"]);
    expect(leerModulosEnDesarrollo(undefined)).toEqual(["productividad", "inteligencia"]);
  });

  it("toma la lista separada por comas, sin espacios ni mayúsculas que estorben", () => {
    expect(leerModulosEnDesarrollo("inteligencia")).toEqual(["inteligencia"]);
    expect(leerModulosEnDesarrollo(" Productividad , inteligencia ")).toEqual(["productividad", "inteligencia"]);
  });

  it("vacía libera todos los módulos", () => {
    expect(leerModulosEnDesarrollo("")).toEqual([]);
    expect(leerModulosEnDesarrollo("  ")).toEqual([]);
  });

  it("ignora claves desconocidas, vacías y repetidas", () => {
    expect(leerModulosEnDesarrollo("foo,,productividad,productividad,bar")).toEqual(["productividad"]);
    expect(leerModulosEnDesarrollo("foo")).toEqual([]);
  });
});

describe("modulosEnDesarrollo", () => {
  const original = process.env.MODULOS_EN_DESARROLLO;
  afterEach(() => {
    if (original === undefined) delete process.env.MODULOS_EN_DESARROLLO;
    else process.env.MODULOS_EN_DESARROLLO = original;
  });

  it("lee MODULOS_EN_DESARROLLO del entorno en cada llamada", () => {
    delete process.env.MODULOS_EN_DESARROLLO;
    expect(modulosEnDesarrollo()).toEqual(["productividad", "inteligencia"]);
    process.env.MODULOS_EN_DESARROLLO = "";
    expect(modulosEnDesarrollo()).toEqual([]);
    process.env.MODULOS_EN_DESARROLLO = "inteligencia";
    expect(modulosEnDesarrollo()).toEqual(["inteligencia"]);
  });
});
