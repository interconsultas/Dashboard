import {
  CATEGORIAS,
  PROGRAMAS_META,
  esCategoria,
  esProgramaMeta,
  escalaDe,
  normalizarProgramaMeta,
} from "@/lib/cumplimiento/categorias";

describe("cumplimiento/categorias", () => {
  describe("CATEGORIAS", () => {
    it("contiene las 7 categorías en el orden esperado, con su etiqueta y escala", () => {
      expect(CATEGORIAS).toEqual([
        { clave: "medicamentos", etiqueta: "Medicamentos", escala: "ratio" },
        { clave: "laboratorios", etiqueta: "Laboratorios", escala: "ratio" },
        { clave: "proc_dx", etiqueta: "Proc. dx no capitados", escala: "x100" },
        { clave: "rx", etiqueta: "Radiografías", escala: "x100" },
        { clave: "ecografias", etiqueta: "Ecografías capitadas", escala: "x100" },
        { clave: "remisiones_cap", etiqueta: "Remisiones capitadas", escala: "x100" },
        { clave: "remisiones_ext", etiqueta: "Remisiones red externa", escala: "x100" },
      ]);
    });
  });

  describe("PROGRAMAS_META", () => {
    it("contiene los 5 programas en el orden esperado", () => {
      expect(PROGRAMAS_META).toEqual([
        "PROGRAMADA",
        "NO PROGRAMADA",
        "RCV",
        "CyD-RIAS-PF-SALUD PÚBLICA",
        "CPR",
      ]);
    });
  });

  describe("esCategoria", () => {
    it("acepta las claves definidas", () => {
      expect(esCategoria("medicamentos")).toBe(true);
      expect(esCategoria("remisiones_ext")).toBe(true);
    });

    it("rechaza claves desconocidas, etiquetas y valores que no son texto", () => {
      expect(esCategoria("Medicamentos")).toBe(false);
      expect(esCategoria("asesorias")).toBe(false);
      expect(esCategoria("")).toBe(false);
      expect(esCategoria(null)).toBe(false);
      expect(esCategoria(3)).toBe(false);
    });
  });

  describe("esProgramaMeta", () => {
    it("acepta los programas definidos", () => {
      expect(esProgramaMeta("RCV")).toBe(true);
      expect(esProgramaMeta("CyD-RIAS-PF-SALUD PÚBLICA")).toBe(true);
    });

    it("rechaza variantes de mayúsculas, valores vacíos y valores que no son texto", () => {
      expect(esProgramaMeta("rcv")).toBe(false);
      expect(esProgramaMeta("")).toBe(false);
      expect(esProgramaMeta(null)).toBe(false);
      expect(esProgramaMeta(undefined)).toBe(false);
      expect(esProgramaMeta(1)).toBe(false);
    });
  });

  describe("escalaDe", () => {
    it("retorna la escala de cada categoría", () => {
      expect(escalaDe("medicamentos")).toBe("ratio");
      expect(escalaDe("laboratorios")).toBe("ratio");
      expect(escalaDe("rx")).toBe("x100");
    });

    it("retorna null para una clave desconocida", () => {
      expect(escalaDe("otra")).toBeNull();
    });
  });

  describe("normalizarProgramaMeta", () => {
    it("convierte null, undefined y texto vacío en null", () => {
      expect(normalizarProgramaMeta(null)).toEqual({ valido: true, valor: null });
      expect(normalizarProgramaMeta(undefined)).toEqual({ valido: true, valor: null });
      expect(normalizarProgramaMeta("")).toEqual({ valido: true, valor: null });
    });

    it("conserva un programa válido", () => {
      expect(normalizarProgramaMeta("CPR")).toEqual({ valido: true, valor: "CPR" });
    });

    it("marca como no válido cualquier otro valor", () => {
      expect(normalizarProgramaMeta("OTRO")).toEqual({ valido: false });
      expect(normalizarProgramaMeta(5)).toEqual({ valido: false });
    });
  });
});
