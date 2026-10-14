import { COLUMNA_ORDENES, getAtribucion, joinOrdenes } from "@/lib/cumplimiento/config";

describe("getAtribucion", () => {
  const original = process.env.CUMPLIMIENTO_ATRIBUCION;

  afterEach(() => {
    if (original === undefined) delete process.env.CUMPLIMIENTO_ATRIBUCION;
    else process.env.CUMPLIMIENTO_ATRIBUCION = original;
  });

  it("usa 'nombre' cuando la variable no está definida", () => {
    delete process.env.CUMPLIMIENTO_ATRIBUCION;
    expect(getAtribucion()).toBe("nombre");
  });

  it.each([
    ["ordenador", "ordenador"],
    ["digitador", "digitador"],
    ["DIGITADOR", "digitador"],
    ["  Digitador  ", "digitador"],
    [" ORDENADOR ", "ordenador"],
    ["nombre", "nombre"],
    ["NOMBRE", "nombre"],
    ["  Nombre  ", "nombre"],
    ["", "nombre"],
    ["   ", "nombre"],
    ["otro", "nombre"],
    ["digitador; DROP TABLE medicos", "nombre"],
  ])("interpreta %p como %p", (valor, esperado) => {
    process.env.CUMPLIMIENTO_ATRIBUCION = valor;
    expect(getAtribucion()).toBe(esperado);
  });

  it("lee la variable en cada llamada", () => {
    process.env.CUMPLIMIENTO_ATRIBUCION = "digitador";
    expect(getAtribucion()).toBe("digitador");
    process.env.CUMPLIMIENTO_ATRIBUCION = "ordenador";
    expect(getAtribucion()).toBe("ordenador");
    process.env.CUMPLIMIENTO_ATRIBUCION = "nombre";
    expect(getAtribucion()).toBe("nombre");
  });
});

describe("COLUMNA_ORDENES", () => {
  it("indica la columna de vm_cumpl_ordenes por la que se agrupa en cada modo", () => {
    expect(COLUMNA_ORDENES).toEqual({
      ordenador: "numero_remite",
      digitador: "usuario_txt",
      nombre: "nombre_medico",
    });
  });
});

describe("joinOrdenes", () => {
  it("ordenador: une las órdenes con la cédula de las citas", () => {
    expect(joinOrdenes("ordenador", "o", "c", "m")).toBe("o.numero_remite = c.documento");
  });

  it("digitador: une las órdenes con el usuario del catálogo de médicos", () => {
    expect(joinOrdenes("digitador", "o", "c", "m")).toBe("o.usuario_txt = m.usuario_txt");
  });

  it("nombre: une las órdenes por nombre normalizado, con el del catálogo o el de las citas", () => {
    expect(joinOrdenes("nombre", "o", "c", "m")).toBe(
      "UPPER(TRIM(o.nombre_medico)) = UPPER(TRIM(COALESCE(m.nombre, c.nombre_medico)))"
    );
  });

  it("respeta los alias recibidos", () => {
    expect(joinOrdenes("ordenador", "ord", "cit", "med")).toBe("ord.numero_remite = cit.documento");
    expect(joinOrdenes("digitador", "ord", "cit", "med")).toBe("ord.usuario_txt = med.usuario_txt");
    expect(joinOrdenes("nombre", "ord", "cit", "med")).toBe(
      "UPPER(TRIM(ord.nombre_medico)) = UPPER(TRIM(COALESCE(med.nombre, cit.nombre_medico)))"
    );
  });

  it("rechaza un alias que no sea un identificador simple", () => {
    expect(() => joinOrdenes("ordenador", "o; DROP TABLE x", "c", "m")).toThrow();
    expect(() => joinOrdenes("digitador", "o", "c", "m m")).toThrow();
    expect(() => joinOrdenes("nombre", "o", "c)", "m")).toThrow();
  });
});
