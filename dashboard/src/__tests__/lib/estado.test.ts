import { estadoLabel } from "@/lib/estado";

describe("estadoLabel", () => {
  it("capitaliza primera letra y pasa el resto a minúsculas", () => {
    expect(estadoLabel("activo")).toBe("Activo");
  });

  it("maneja string todo mayúsculas", () => {
    expect(estadoLabel("INACTIVO")).toBe("Inactivo");
  });

  it("maneja string de un solo carácter", () => {
    expect(estadoLabel("a")).toBe("A");
  });

  it("maneja cadena vacía sin error", () => {
    expect(estadoLabel("")).toBe("");
  });

  it("maneja strings mixtos", () => {
    expect(estadoLabel("eXtErNo")).toBe("Externo");
  });
});
