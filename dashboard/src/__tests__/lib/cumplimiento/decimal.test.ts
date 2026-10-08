import { parseDecimal, fmtDecimal } from "@/lib/cumplimiento/decimal";

describe("cumplimiento/decimal", () => {
  describe("parseDecimal", () => {
    it("acepta punto o coma como separador decimal", () => {
      expect(parseDecimal("2.551437")).toBe(2.551437);
      expect(parseDecimal("2,551437")).toBe(2.551437);
      expect(parseDecimal(" 12 ")).toBe(12);
    });

    it("retorna null para un texto vacío", () => {
      expect(parseDecimal("")).toBeNull();
      expect(parseDecimal("   ")).toBeNull();
    });

    it("retorna NaN para un texto que no es un número decimal simple", () => {
      expect(parseDecimal("abc")).toBeNaN();
      expect(parseDecimal("1.234,5")).toBeNaN();
      expect(parseDecimal("-3")).toBeNaN();
      expect(parseDecimal("1e3")).toBeNaN();
      expect(parseDecimal(",5")).toBeNaN();
    });
  });

  describe("fmtDecimal", () => {
    it("muestra el número con coma decimal", () => {
      expect(fmtDecimal(2.551437)).toBe("2,551437");
      expect(fmtDecimal(12)).toBe("12");
    });

    it("el resultado se puede volver a leer con parseDecimal", () => {
      expect(parseDecimal(fmtDecimal(0.75))).toBe(0.75);
    });
  });
});
