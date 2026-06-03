import { getCached, setCache, cacheKey } from "@/lib/cache";

describe("cache", () => {
  beforeEach(() => {
    // Limpiar el store entre tests seteando un TTL de 0 no es posible,
    // pero usar claves únicas por test sí lo es.
  });

  describe("getCached / setCache", () => {
    it("retorna null para clave inexistente", () => {
      expect(getCached("no-existe-abc")).toBeNull();
    });

    it("retorna el dato guardado", () => {
      setCache("test-get-1", { valor: 42 });
      expect(getCached<{ valor: number }>("test-get-1")).toEqual({ valor: 42 });
    });

    it("retorna null después de expirar el TTL", () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now);

      setCache("test-ttl-1", "dato", 100);

      // Avanzar en el tiempo más allá del TTL
      jest.spyOn(Date, "now").mockReturnValue(now + 200);

      expect(getCached("test-ttl-1")).toBeNull();

      jest.restoreAllMocks();
    });

    it("retorna dato dentro del TTL", () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now);

      setCache("test-ttl-ok", "dato", 1000);

      jest.spyOn(Date, "now").mockReturnValue(now + 500);

      expect(getCached("test-ttl-ok")).toBe("dato");

      jest.restoreAllMocks();
    });

    it("sobreescribe entrada existente", () => {
      setCache("test-overwrite", "v1");
      setCache("test-overwrite", "v2");
      expect(getCached("test-overwrite")).toBe("v2");
    });

    it("soporta distintos tipos de datos", () => {
      setCache("test-array", [1, 2, 3]);
      setCache("test-string", "hola");
      setCache("test-number", 99);
      setCache("test-null-val", null);

      expect(getCached("test-array")).toEqual([1, 2, 3]);
      expect(getCached("test-string")).toBe("hola");
      expect(getCached("test-number")).toBe(99);
      expect(getCached("test-null-val")).toBeNull();
    });
  });

  describe("cacheKey", () => {
    it("genera clave con prefijo y params ordenados", () => {
      const params = new URLSearchParams([
        ["z", "1"],
        ["a", "2"],
      ]);
      const key = cacheKey("dash", params);
      expect(key).toBe("dash:a=2&z=1");
    });

    it("genera clave vacía con params vacíos", () => {
      const params = new URLSearchParams();
      const key = cacheKey("prefix", params);
      expect(key).toBe("prefix:");
    });

    it("es determinística para mismos params en distinto orden", () => {
      const p1 = new URLSearchParams([["b", "2"], ["a", "1"]]);
      const p2 = new URLSearchParams([["a", "1"], ["b", "2"]]);
      expect(cacheKey("x", p1)).toBe(cacheKey("x", p2));
    });
  });
});
