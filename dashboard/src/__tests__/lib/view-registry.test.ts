import { isAllowedView, resolveView, getViewFilters } from "@/lib/view-registry";

describe("view-registry", () => {
  describe("isAllowedView", () => {
    it("retorna true para vista registrada", () => {
      expect(isAllowedView("vm_filtros_dashboard")).toBe(true);
      expect(isAllowedView("vm_dash_laboratorios")).toBe(true);
      expect(isAllowedView("vm_dash_rx")).toBe(true);
    });

    it("retorna false para vista no registrada", () => {
      expect(isAllowedView("vista_inventada")).toBe(false);
      expect(isAllowedView("")).toBe(false);
    });
  });

  describe("resolveView", () => {
    it("retorna la vista si es válida", () => {
      expect(resolveView("vm_dash_laboratorios")).toBe("vm_dash_laboratorios");
    });

    it("retorna default para vista inválida", () => {
      expect(resolveView("no_existe")).toBe("vm_filtros_dashboard");
    });

    it("retorna default para null", () => {
      expect(resolveView(null)).toBe("vm_filtros_dashboard");
    });

    it("retorna default para undefined", () => {
      expect(resolveView(undefined)).toBe("vm_filtros_dashboard");
    });

    it("retorna default para string vacío", () => {
      expect(resolveView("")).toBe("vm_filtros_dashboard");
    });
  });

  describe("getViewFilters", () => {
    it("retorna filtros para vista registrada", () => {
      const filtros = getViewFilters("vm_dash_laboratorios");
      expect(filtros.tipo_convenio).toEqual(["CAPITADO"]);
      expect(filtros.agrup_salud).toEqual(["PROCEDIMIENTOS DIAGNOSTICOS"]);
    });

    it("retorna objeto vacío para vista default", () => {
      const filtros = getViewFilters("vm_filtros_dashboard");
      expect(filtros).toEqual({});
    });

    it("retorna objeto vacío para vista no registrada", () => {
      const filtros = getViewFilters("no_existe");
      expect(filtros).toEqual({});
    });

    it("vista medicamentos tiene exclude_orden_agrup", () => {
      const filtros = getViewFilters("vm_dash_medicamentos");
      expect(filtros.exclude_orden_agrup).toEqual(["PROGRAMAS ESPECIALES"]);
    });

    it("vista ecografias tiene filtros capitado + ecografia", () => {
      const filtros = getViewFilters("vm_dash_ecografias");
      expect(filtros.tipo_convenio).toEqual(["CAPITADO"]);
      expect(filtros.orden_agrup).toEqual(["ECOGRAFIA"]);
    });

    it("remisiones capitadas filtran por las 18 prestaciones exactas (con dobles espacios)", () => {
      const filtros = getViewFilters("vm_dash_remisiones_cap");
      expect(filtros.tipo_convenio).toEqual(["CAPITADO"]);
      expect(filtros.prestacion).toHaveLength(18);
      expect(filtros.prestacion).toContain("CONTROL  EN PEDIATRIA");
      expect(filtros.prestacion).toContain("CONSULTA  EN DERMATOLOGIA");
      expect(filtros.prestacion).toContain("CONTROL MEDICINA INTERNA (NO VIGENTE, USAR CODIGO 890366)");
      expect(filtros.prestacion).toContain("CONTROL GINECOLOGO (A) (NO VIGENTE, USAR CODIGO 890350)");
      expect(filtros.prestacion).not.toContain("CONTROL EN PEDIATRIA");
      expect(filtros.prestacion?.filter((p) => p.includes("  EN "))).toHaveLength(6);
    });

    it("remisiones red externa filtran por convenio ACTIVIDAD", () => {
      const filtros = getViewFilters("vm_dash_remisiones_ext");
      expect(filtros.tipo_convenio).toEqual(["ACTIVIDAD"]);
      expect(filtros.prestacion).toBeUndefined();
    });
  });
});
