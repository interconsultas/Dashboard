import {
  COLORES_AREA,
  ESCALA_SECUENCIAL,
  buscarProfesional,
  celdaCalor,
  colorArea,
  etiquetaProfesional,
  fmtNumero,
  fmtPct,
  fmtVariacion,
} from "@/lib/productividad/presentacion";

describe("formatos", () => {
  it("números con separador de miles es-CO", () => {
    expect(fmtNumero(63616)).toBe("63.616");
  });

  it("porcentajes con coma decimal y espacio; null es guion", () => {
    expect(fmtPct(9739 / 56867)).toBe("17,1 %");
    expect(fmtPct(0.5, 0)).toBe("50 %");
    expect(fmtPct(null)).toBe("—");
  });

  it("variaciones con flecha y unidad", () => {
    expect(fmtVariacion(2.14, "puntos")).toBe("▲ 2,1 pp");
    expect(fmtVariacion(-10, "relativa")).toBe("▼ 10 %");
    expect(fmtVariacion(0, "relativa")).toBe("= 0 %");
  });
});

describe("colorArea", () => {
  const areas = ["Medicina general", "Salud oral", "Enfermería"];

  it("el color sigue a la entidad: posición del área en el catálogo", () => {
    expect(colorArea("Medicina general", areas)).toBe(COLORES_AREA[0]);
    expect(colorArea("Enfermería", areas)).toBe(COLORES_AREA[2]);
  });

  it("filtrar áreas no repinta las demás", () => {
    expect(colorArea("Enfermería", areas)).toBe(colorArea("Enfermería", areas.slice()));
  });

  it("un área desconocida usa gris neutro", () => {
    expect(colorArea("Otra", areas)).toMatch(/^#/);
    expect(COLORES_AREA).not.toContain(colorArea("Otra", areas));
  });
});

describe("celdaCalor (formato condicional)", () => {
  it("el mínimo usa el tono más claro con tinta oscura y el máximo el más oscuro con tinta blanca", () => {
    expect(celdaCalor(0.05, 0.05, 0.3)).toEqual({ fondo: ESCALA_SECUENCIAL[0], tinta: expect.not.stringMatching(/#fff/i) });
    expect(celdaCalor(0.3, 0.05, 0.3)).toEqual({ fondo: ESCALA_SECUENCIAL[ESCALA_SECUENCIAL.length - 1], tinta: "#fff" });
  });

  it("satura fuera de rango y tolera rango vacío o null", () => {
    expect(celdaCalor(0.9, 0.05, 0.3)?.fondo).toBe(ESCALA_SECUENCIAL[ESCALA_SECUENCIAL.length - 1]);
    expect(celdaCalor(0.1, 0.1, 0.1)?.fondo).toBe(ESCALA_SECUENCIAL[0]);
    expect(celdaCalor(null, 0, 1)).toBeNull();
  });
});

describe("buscarProfesional", () => {
  const opciones = [
    { documento: "1053", nombre: "PÉREZ ANA" },
    { documento: "2077", nombre: "GOMEZ LUIS" },
  ];

  it("resuelve la opción elegida del datalist", () => {
    expect(buscarProfesional(etiquetaProfesional(opciones[1]), opciones)).toBe("2077");
  });

  it("resuelve una cédula exacta", () => {
    expect(buscarProfesional(" 1053 ", opciones)).toBe("1053");
  });

  it("resuelve un nombre exacto sin tildes ni mayúsculas", () => {
    expect(buscarProfesional("perez ana", opciones)).toBe("1053");
  });

  it("texto parcial o desconocido no resuelve", () => {
    expect(buscarProfesional("PER", opciones)).toBeNull();
    expect(buscarProfesional("999", opciones)).toBeNull();
    expect(buscarProfesional("", opciones)).toBeNull();
  });
});
