import { COLUMNA_ORDENES, getAtribucion, joinOrdenes } from "@/lib/cumplimiento/config";

describe("getAtribucion", () => {
  const original = process.env.CUMPLIMIENTO_ATRIBUCION;

  afterEach(() => {
    if (original === undefined) delete process.env.CUMPLIMIENTO_ATRIBUCION;
    else process.env.CUMPLIMIENTO_ATRIBUCION = original;
  });

  it("usa 'ordenador' cuando la variable no está definida", () => {
    delete process.env.CUMPLIMIENTO_ATRIBUCION;
    expect(getAtribucion()).toBe("ordenador");
  });

  it.each([
    ["ordenador", "ordenador"],
    ["digitador", "digitador"],
    ["DIGITADOR", "digitador"],
    ["  Digitador  ", "digitador"],
    [" ORDENADOR ", "ordenador"],
    ["", "ordenador"],
    ["   ", "ordenador"],
    ["otro", "ordenador"],
    ["digitador; DROP TABLE medicos", "ordenador"],
  ])("interpreta %p como %p", (valor, esperado) => {
    process.env.CUMPLIMIENTO_ATRIBUCION = valor;
    expect(getAtribucion()).toBe(esperado);
  });

  it("lee la variable en cada llamada", () => {
    process.env.CUMPLIMIENTO_ATRIBUCION = "digitador";
    expect(getAtribucion()).toBe("digitador");
    process.env.CUMPLIMIENTO_ATRIBUCION = "ordenador";
    expect(getAtribucion()).toBe("ordenador");
  });
});

describe("COLUMNA_ORDENES", () => {
  it("indica la columna de vm_cumpl_ordenes por la que se agrupa en cada modo", () => {
    expect(COLUMNA_ORDENES).toEqual({ ordenador: "numero_remite", digitador: "usuario_txt" });
  });
});

describe("joinOrdenes", () => {
  it("ordenador: une las órdenes con la cédula de las citas", () => {
    expect(joinOrdenes("ordenador", "o", "c", "m")).toBe("o.numero_remite = c.documento");
  });

  it("digitador: une las órdenes con el usuario del catálogo de médicos", () => {
    expect(joinOrdenes("digitador", "o", "c", "m")).toBe("o.usuario_txt = m.usuario_txt");
  });

  it("respeta los alias recibidos", () => {
    expect(joinOrdenes("ordenador", "ord", "cit", "med")).toBe("ord.numero_remite = cit.documento");
    expect(joinOrdenes("digitador", "ord", "cit", "med")).toBe("ord.usuario_txt = med.usuario_txt");
  });

  it("rechaza un alias que no sea un identificador simple", () => {
    expect(() => joinOrdenes("ordenador", "o; DROP TABLE x", "c", "m")).toThrow();
    expect(() => joinOrdenes("digitador", "o", "c", "m m")).toThrow();
  });
});
