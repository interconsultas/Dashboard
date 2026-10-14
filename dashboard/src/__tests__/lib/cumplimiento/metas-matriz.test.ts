import { celdaValida } from "@/lib/cumplimiento/metas-matriz";

describe("cumplimiento/metas-matriz", () => {
  describe("celdaValida", () => {
    it("acepta un número mayor que cero con punto o coma", () => {
      expect(celdaValida("2,5", "")).toBe(true);
      expect(celdaValida("2.5", "1")).toBe(true);
    });

    it("acepta una celda vacía que no tenía meta guardada (programa sin meta)", () => {
      expect(celdaValida("", "")).toBe(true);
      expect(celdaValida(undefined, undefined)).toBe(true);
      expect(celdaValida("  ", undefined)).toBe(true);
    });

    it("rechaza vaciar una celda que ya tenía meta guardada", () => {
      expect(celdaValida("", "2,5")).toBe(false);
      expect(celdaValida(undefined, "2,5")).toBe(false);
    });

    it("rechaza cero, negativos y texto no numérico", () => {
      expect(celdaValida("0", "")).toBe(false);
      expect(celdaValida("-1", "")).toBe(false);
      expect(celdaValida("abc", "")).toBe(false);
    });
  });
});
