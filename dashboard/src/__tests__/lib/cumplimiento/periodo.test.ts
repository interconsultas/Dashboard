import { parsePeriodo, periodoAnterior, parseAnio } from "@/lib/cumplimiento/periodo";

describe("cumplimiento/periodo", () => {
  describe("parsePeriodo", () => {
    it("acepta un periodo YYYYMM como texto o como número", () => {
      expect(parsePeriodo("202602")).toBe(202602);
      expect(parsePeriodo(202612)).toBe(202612);
    });

    it("rechaza meses fuera de 01–12", () => {
      expect(parsePeriodo("202600")).toBeNull();
      expect(parsePeriodo("202613")).toBeNull();
    });

    it("rechaza valores que no tienen exactamente 6 dígitos", () => {
      expect(parsePeriodo("20262")).toBeNull();
      expect(parsePeriodo("2026021")).toBeNull();
      expect(parsePeriodo("2026-2")).toBeNull();
      expect(parsePeriodo("")).toBeNull();
      expect(parsePeriodo(null)).toBeNull();
      expect(parsePeriodo(undefined)).toBeNull();
      expect(parsePeriodo(2026.5)).toBeNull();
    });
  });

  describe("periodoAnterior", () => {
    it("retorna el mes calendario anterior a la fecha dada", () => {
      expect(periodoAnterior(new Date(2026, 9, 8))).toBe(202609);
    });

    it("cruza el cambio de año en enero", () => {
      expect(periodoAnterior(new Date(2026, 0, 15))).toBe(202512);
    });
  });

  describe("parseAnio", () => {
    it("acepta un año entero entre 2000 y 2100, como texto o como número", () => {
      expect(parseAnio("2026")).toBe(2026);
      expect(parseAnio(2000)).toBe(2000);
      expect(parseAnio(2100)).toBe(2100);
    });

    it("rechaza años fuera de rango, decimales y valores que no son numéricos", () => {
      expect(parseAnio(1999)).toBeNull();
      expect(parseAnio(2101)).toBeNull();
      expect(parseAnio(2026.5)).toBeNull();
      expect(parseAnio("20x6")).toBeNull();
      expect(parseAnio("")).toBeNull();
      expect(parseAnio(null)).toBeNull();
    });
  });
});
