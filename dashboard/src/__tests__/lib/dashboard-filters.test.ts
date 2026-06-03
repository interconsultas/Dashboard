import {
  wb,
  addPeriodo,
  addIn,
  addNotIn,
  addEstado,
  toW,
  parseBody,
  shiftPeriodo,
  buildAll,
  buildExcept,
  type WB,
  type Parsed,
} from "@/lib/dashboard-filters";

describe("dashboard-filters", () => {
  describe("wb", () => {
    it("crea un builder con cláusula base 1=1", () => {
      const b = wb();
      expect(b.clauses).toEqual(["1=1"]);
      expect(b.params).toEqual([]);
    });
  });

  describe("addPeriodo", () => {
    it("agrega desde y hasta", () => {
      const b = wb();
      addPeriodo(b, 202601, 202612);
      expect(b.clauses).toContain("periodo >= $1");
      expect(b.clauses).toContain("periodo <= $2");
      expect(b.params).toEqual([202601, 202612]);
    });

    it("solo desde", () => {
      const b = wb();
      addPeriodo(b, 202601, null);
      expect(b.params).toEqual([202601]);
      expect(b.clauses.length).toBe(2);
    });

    it("solo hasta", () => {
      const b = wb();
      addPeriodo(b, null, 202612);
      expect(b.params).toEqual([202612]);
    });

    it("nada si ambos son null", () => {
      const b = wb();
      addPeriodo(b, null, null);
      expect(b.params).toEqual([]);
      expect(b.clauses.length).toBe(1);
    });
  });

  describe("addIn", () => {
    it("agrega cláusula IN con parámetros indexados", () => {
      const b = wb();
      addIn(b, "r.estado_medico", ["ACTIVO", "INACTIVO"]);
      expect(b.clauses).toContain("r.estado_medico IN ($1,$2)");
      expect(b.params).toEqual(["ACTIVO", "INACTIVO"]);
    });

    it("no agrega nada con array vacío", () => {
      const b = wb();
      addIn(b, "r.col", []);
      expect(b.clauses.length).toBe(1);
    });

    it("indexa correctamente después de params existentes", () => {
      const b = wb();
      b.params.push("prev");
      addIn(b, "r.col", ["val"]);
      expect(b.clauses).toContain("r.col IN ($2)");
    });
  });

  describe("addNotIn", () => {
    it("agrega cláusula NOT IN", () => {
      const b = wb();
      addNotIn(b, "r.orden_agrup_prest_desc", ["EXCLUIDO"]);
      expect(b.clauses).toContain("r.orden_agrup_prest_desc NOT IN ($1)");
    });
  });

  describe("addEstado", () => {
    it("usa alias por defecto 'r'", () => {
      const b = wb();
      addEstado(b, ["ACTIVO"]);
      expect(b.clauses).toContain("r.estado_medico IN ($1)");
    });

    it("usa alias personalizado", () => {
      const b = wb();
      addEstado(b, ["ACTIVO"], "a");
      expect(b.clauses).toContain("a.estado_medico IN ($1)");
    });

    it("no agrega nada con lista vacía", () => {
      const b = wb();
      addEstado(b, []);
      expect(b.clauses.length).toBe(1);
    });
  });

  describe("toW", () => {
    it("genera WHERE con AND", () => {
      const b = wb();
      addPeriodo(b, 202601, 202612);
      const sql = toW(b);
      expect(sql).toBe("WHERE 1=1 AND periodo >= $1 AND periodo <= $2");
    });

    it("solo 1=1 cuando no hay filtros", () => {
      const b = wb();
      expect(toW(b)).toBe("WHERE 1=1");
    });
  });

  describe("parseBody", () => {
    it("retorna defaults para body vacío", () => {
      const p = parseBody({});
      expect(p.desde).toBeNull();
      expect(p.hasta).toBeNull();
      expect(p.estado).toEqual([]);
      expect(p.profesional).toEqual([]);
      expect(p.programa).toEqual([]);
      expect(p.tipo_convenio).toEqual([]);
      expect(p.orden_agrup).toEqual([]);
      expect(p.agrup_salud).toEqual([]);
      expect(p.diagnostico).toEqual([]);
      expect(p.prestacion).toEqual([]);
      expect(p.exclude_orden_agrup).toEqual([]);
    });

    it("pasa valores proporcionados", () => {
      const p = parseBody({
        desde: 202601,
        hasta: 202612,
        estado: ["ACTIVO"],
        profesional: ["DR GARCIA"],
      });
      expect(p.desde).toBe(202601);
      expect(p.hasta).toBe(202612);
      expect(p.estado).toEqual(["ACTIVO"]);
      expect(p.profesional).toEqual(["DR GARCIA"]);
    });

    it("convierte null/undefined a defaults", () => {
      const p = parseBody({ desde: null, estado: undefined });
      expect(p.desde).toBeNull();
      expect(p.estado).toEqual([]);
    });
  });

  describe("shiftPeriodo", () => {
    it("resta meses correctamente dentro del mismo año", () => {
      expect(shiftPeriodo(202606, 3)).toBe(202603);
    });

    it("cruza años hacia atrás", () => {
      expect(shiftPeriodo(202602, 3)).toBe(202511);
    });

    it("resta 12 meses = un año atrás", () => {
      expect(shiftPeriodo(202606, 12)).toBe(202506);
    });

    it("mes enero menos 1 = diciembre anterior", () => {
      expect(shiftPeriodo(202601, 1)).toBe(202512);
    });

    it("0 meses retorna mismo periodo", () => {
      expect(shiftPeriodo(202603, 0)).toBe(202603);
    });

    it("resta más de un año", () => {
      expect(shiftPeriodo(202603, 15)).toBe(202412);
    });
  });

  describe("buildAll", () => {
    it("aplica todos los filtros", () => {
      const b = wb();
      const p: Parsed = {
        desde: 202601,
        hasta: 202612,
        estado: ["ACTIVO"],
        profesional: [],
        programa: ["MEDICINA GENERAL"],
        tipo_convenio: [],
        orden_agrup: [],
        agrup_salud: [],
        diagnostico: [],
        prestacion: [],
        exclude_orden_agrup: ["EXCLUIDO"],
      };
      buildAll(b, p, { clause: "", params: [] });
      const sql = toW(b);
      expect(sql).toContain("periodo >= ");
      expect(sql).toContain("estado_medico IN");
      expect(sql).toContain("programa_especialidad IN");
      expect(sql).toContain("NOT IN");
    });
  });

  describe("buildExcept", () => {
    it("omite la dimensión especificada", () => {
      const b = wb();
      const p: Parsed = {
        desde: 202601,
        hasta: 202612,
        estado: ["ACTIVO"],
        profesional: [],
        programa: ["MED GEN"],
        tipo_convenio: [],
        orden_agrup: [],
        agrup_salud: [],
        diagnostico: [],
        prestacion: [],
        exclude_orden_agrup: [],
      };
      buildExcept(b, p, { clause: "", params: [] }, "estado");
      const sql = toW(b);
      expect(sql).not.toContain("estado_medico");
      expect(sql).toContain("programa_especialidad");
    });

    it("omite periodo si skip='periodo'", () => {
      const b = wb();
      const p: Parsed = {
        desde: 202601,
        hasta: 202612,
        estado: [],
        profesional: [],
        programa: [],
        tipo_convenio: [],
        orden_agrup: [],
        agrup_salud: [],
        diagnostico: [],
        prestacion: [],
        exclude_orden_agrup: [],
      };
      buildExcept(b, p, { clause: "", params: [] }, "periodo");
      const sql = toW(b);
      expect(sql).not.toContain("periodo");
    });
  });
});
