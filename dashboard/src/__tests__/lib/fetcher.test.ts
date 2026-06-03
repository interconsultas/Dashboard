import { fetcher, postFetcher, FetchError } from "@/lib/fetcher";

describe("fetcher", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("fetcher (GET)", () => {
    it("retorna JSON para respuesta exitosa", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
      });

      const result = await fetcher("/api/test");
      expect(result).toEqual({ data: "test" });
      expect(global.fetch).toHaveBeenCalledWith("/api/test");
    });

    it("lanza FetchError para respuesta no-ok con JSON", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "No encontrado" }),
      });

      await expect(fetcher("/api/missing")).rejects.toThrow(FetchError);
      try {
        await fetcher("/api/missing");
      } catch (e) {
        expect(e).toBeInstanceOf(FetchError);
        expect((e as FetchError).status).toBe(404);
        expect((e as FetchError).message).toBe("No encontrado");
      }
    });

    it("lanza FetchError genérico si respuesta no es JSON", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("not json")),
      });

      await expect(fetcher("/api/broken")).rejects.toThrow(FetchError);
      try {
        await fetcher("/api/broken");
      } catch (e) {
        expect((e as FetchError).status).toBe(500);
        expect((e as FetchError).message).toContain("500");
      }
    });
  });

  describe("postFetcher", () => {
    it("envía POST con JSON body", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const body = JSON.stringify({ filtro: "test" });
      const result = await postFetcher(["/api/filtros", body]);
      expect(result).toEqual({ ok: true });

      expect(global.fetch).toHaveBeenCalledWith("/api/filtros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    });

    it("lanza FetchError para error con mensaje en body", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Filtro inválido" }),
      });

      try {
        await postFetcher(["/api/filtros", "{}"]);
      } catch (e) {
        expect(e).toBeInstanceOf(FetchError);
        expect((e as FetchError).message).toBe("Filtro inválido");
        expect((e as FetchError).info).toEqual({ error: "Filtro inválido" });
      }
    });
  });

  describe("FetchError", () => {
    it("tiene name, status e info", () => {
      const err = new FetchError("test error", 422, { detail: "x" });
      expect(err.name).toBe("FetchError");
      expect(err.status).toBe(422);
      expect(err.info).toEqual({ detail: "x" });
      expect(err.message).toBe("test error");
      expect(err).toBeInstanceOf(Error);
    });
  });
});
