import {
  CATEGORIAS,
  PROGRAMAS_META,
  PROGRAMAS_EDITABLES,
  PROGRAMA_TOTAL_MGI,
  esCategoria,
  esProgramaEditable,
  esProgramaMeta,
  escalaDe,
  etiquetaPrograma,
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
    it("contiene los 9 programas asignables en el orden de la hoja METAS", () => {
      expect(PROGRAMAS_META).toEqual([
        "PROGRAMADA",
        "NO PROGRAMADA",
        "RCV",
        "CyD-RIAS-PF-SALUD PÚBLICA",
        "CPR",
        "DERMATOLOGÍA",
        "MEDICINA INTERNA",
        "GINECOLOGÍA Y OBSTETRICIA",
        "PEDIATRÍA",
      ]);
    });

    it("no incluye la fila informativa del total de médicos generales integradores", () => {
      expect(PROGRAMAS_META).not.toContain(PROGRAMA_TOTAL_MGI);
    });
  });

  describe("PROGRAMAS_EDITABLES", () => {
    it("pone el total primero y luego los programas asignables, como en el Excel", () => {
      expect(PROGRAMA_TOTAL_MGI).toBe("TOTAL MGI");
      expect(PROGRAMAS_EDITABLES).toEqual([PROGRAMA_TOTAL_MGI, ...PROGRAMAS_META]);
    });
  });

  describe("etiquetaPrograma", () => {
    it.each([
      ["TOTAL MGI", "TOTAL MÉDICOS GENERALES INTEGRADORES"],
      ["PROGRAMADA", "PROGRAMADA"],
      ["NO PROGRAMADA", "NO PROGRAMADA"],
      ["RCV", "RCV"],
      ["CyD-RIAS-PF-SALUD PÚBLICA", "CyD-RIAS-PF-SALUD PÚBLICA"],
      ["CPR", "CPR"],
      ["DERMATOLOGÍA", "DERMATOLOGÍA"],
      ["MEDICINA INTERNA", "MEDICINA INTERNA"],
      ["GINECOLOGÍA Y OBSTETRICIA", "GINECOLOGÍA Y OBSTETRICIA"],
      ["PEDIATRÍA", "PEDIATRÍA"],
    ])("retorna la etiqueta del Excel para %s", (clave, etiqueta) => {
      expect(etiquetaPrograma(clave)).toBe(etiqueta);
    });

    it("retorna la misma clave cuando el programa no está en el catálogo", () => {
      expect(etiquetaPrograma("OTRO")).toBe("OTRO");
    });
  });

  describe("esProgramaEditable", () => {
    it("acepta el total y los programas asignables", () => {
      expect(esProgramaEditable("TOTAL MGI")).toBe(true);
      expect(esProgramaEditable("PEDIATRÍA")).toBe(true);
    });

    it("rechaza valores desconocidos o que no son texto", () => {
      expect(esProgramaEditable("total mgi")).toBe(false);
      expect(esProgramaEditable("")).toBe(false);
      expect(esProgramaEditable(null)).toBe(false);
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
      expect(esProgramaMeta("MEDICINA INTERNA")).toBe(true);
    });

    it("rechaza el total: no se puede asignar a un profesional", () => {
      expect(esProgramaMeta("TOTAL MGI")).toBe(false);
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
      expect(normalizarProgramaMeta("TOTAL MGI")).toEqual({ valido: false });
    });
  });
});
