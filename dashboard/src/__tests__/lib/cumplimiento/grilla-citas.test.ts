import {
  cambiosPendientes,
  construirFilas,
  contarFilas,
  filtrarFilas,
  parseCitas,
  type FilaCitasApi,
} from "@/lib/cumplimiento/grilla-citas";

function fila(parcial: Partial<FilaCitasApi> & { documento: string }): FilaCitasApi {
  return {
    nombre: `PROFESIONAL ${parcial.documento}`,
    estado: "ACTIVO",
    programa_meta: null,
    cantidad_citas: null,
    programa: null,
    ...parcial,
  };
}

describe("cumplimiento/grilla-citas", () => {
  describe("parseCitas", () => {
    it("retorna null para un texto vacío", () => {
      expect(parseCitas("")).toBeNull();
      expect(parseCitas("  ")).toBeNull();
    });

    it("retorna el entero para un texto de solo dígitos", () => {
      expect(parseCitas("0")).toBe(0);
      expect(parseCitas(" 120 ")).toBe(120);
    });

    it("retorna NaN para decimales, negativos, texto y enteros fuera de rango", () => {
      expect(parseCitas("12.5")).toBeNaN();
      expect(parseCitas("-1")).toBeNaN();
      expect(parseCitas("abc")).toBeNaN();
      expect(parseCitas("99999999999")).toBeNaN();
    });
  });

  describe("construirFilas", () => {
    it("sin registro guardado deja las citas vacías y propone el programa de metas", () => {
      const [f] = construirFilas([fila({ documento: "1", programa_meta: "RCV" })], {});
      expect(f).toMatchObject({
        documento: "1",
        citas: "",
        programa: "RCV",
        guardada: false,
        citasInvalida: false,
        cambiada: false,
      });
    });

    it("con registro guardado muestra las citas y el programa guardados", () => {
      const [f] = construirFilas(
        [fila({ documento: "1", programa_meta: "RCV", cantidad_citas: 80, programa: "CPR" })],
        {}
      );
      expect(f).toMatchObject({ citas: "80", programa: "CPR", guardada: true, cambiada: false });
    });

    it("con registro guardado sin programa no propone el programa de metas", () => {
      const [f] = construirFilas(
        [fila({ documento: "1", programa_meta: "RCV", cantidad_citas: 80, programa: null })],
        {}
      );
      expect(f).toMatchObject({ citas: "80", programa: "", cambiada: false });
    });

    it("aplica las ediciones sobre los valores iniciales y marca la fila como cambiada", () => {
      const [f] = construirFilas([fila({ documento: "1", programa_meta: "RCV" })], {
        "1": { citas: "45" },
      });
      expect(f).toMatchObject({ citas: "45", programa: "RCV", cambiada: true });
    });

    it("no marca como cambiada una edición que deja los valores guardados", () => {
      const [f] = construirFilas(
        [fila({ documento: "1", cantidad_citas: 80, programa: "CPR" })],
        { "1": { citas: "80", programa: "CPR" } }
      );
      expect(f.cambiada).toBe(false);
    });

    it("no marca como cambiada una fila sin citas a la que solo se le cambió el programa", () => {
      const [f] = construirFilas([fila({ documento: "1" })], { "1": { programa: "CPR" } });
      expect(f.cambiada).toBe(false);
    });

    it("marca como cambiada una fila guardada a la que se le borran las citas", () => {
      const [f] = construirFilas([fila({ documento: "1", cantidad_citas: 80 })], {
        "1": { citas: "" },
      });
      expect(f.cambiada).toBe(true);
    });

    it("marca las citas no válidas", () => {
      const [f] = construirFilas([fila({ documento: "1" })], { "1": { citas: "12,5" } });
      expect(f).toMatchObject({ citasInvalida: true, cambiada: true });
    });
  });

  describe("cambiosPendientes", () => {
    it("incluye solo las filas cambiadas, con las citas como entero y el programa vacío como null", () => {
      const filas = construirFilas(
        [
          fila({ documento: "1", programa_meta: "RCV" }),
          fila({ documento: "2" }),
          fila({ documento: "3", cantidad_citas: 10, programa: "CPR" }),
        ],
        { "1": { citas: "45" }, "2": { citas: "7" } }
      );
      expect(cambiosPendientes(filas)).toEqual([
        { documento: "1", cantidad_citas: 45, programa: "RCV" },
        { documento: "2", cantidad_citas: 7, programa: null },
      ]);
    });

    it("envía las citas borradas como null para eliminar el registro", () => {
      const filas = construirFilas(
        [fila({ documento: "3", cantidad_citas: 10, programa: "CPR" })],
        { "3": { citas: "" } }
      );
      expect(cambiosPendientes(filas)).toEqual([
        { documento: "3", cantidad_citas: null, programa: null },
      ]);
    });
  });

  describe("filtrarFilas", () => {
    const filas = construirFilas(
      [
        fila({ documento: "101", nombre: "ARIAS ANA", programa_meta: "RCV" }),
        fila({ documento: "202", nombre: "BELTRAN LUIS" }),
        fila({ documento: "303", nombre: "CANO EVA", cantidad_citas: 5 }),
        fila({ documento: "404", nombre: "DIAZ RAUL" }),
      ],
      { "404": { citas: "9" } }
    );

    it("por defecto lista los que tienen programa de metas o citas en el periodo", () => {
      const r = filtrarFilas(filas, { mostrarTodos: false, busqueda: "" });
      expect(r.map((f) => f.documento)).toEqual(["101", "303", "404"]);
    });

    it("con mostrarTodos lista todos los profesionales", () => {
      const r = filtrarFilas(filas, { mostrarTodos: true, busqueda: "" });
      expect(r).toHaveLength(4);
    });

    it("busca por nombre sin distinguir mayúsculas y por cédula", () => {
      expect(
        filtrarFilas(filas, { mostrarTodos: true, busqueda: "beltran" }).map((f) => f.documento)
      ).toEqual(["202"]);
      expect(
        filtrarFilas(filas, { mostrarTodos: true, busqueda: "30" }).map((f) => f.documento)
      ).toEqual(["303"]);
    });
  });

  describe("contarFilas", () => {
    it("cuenta el total, los que tienen citas y los que tienen citas sin programa", () => {
      const filas = construirFilas(
        [
          fila({ documento: "1", programa_meta: "RCV" }),
          fila({ documento: "2", cantidad_citas: 5, programa: "CPR" }),
          fila({ documento: "3", cantidad_citas: 0, programa: null }),
          fila({ documento: "4" }),
        ],
        { "4": { citas: "x" } }
      );
      expect(contarFilas(filas)).toEqual({ total: 4, conCitas: 2, sinPrograma: 1 });
    });
  });
});
