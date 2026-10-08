jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requireAuth: jest.fn() }));
jest.mock("@/lib/cache", () => ({ clearCache: jest.fn() }));

import { NextResponse } from "next/server";
import { GET, PUT } from "@/app/api/admin/metas/route";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { clearCache } from "@/lib/cache";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

function reqGet(qs = "") {
  return new Request(`http://localhost/api/admin/metas${qs}`);
}

function reqPut(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

/** Llamadas a query cuyo SQL escribe en la tabla metas. */
function escrituras() {
  return mockQuery.mock.calls.filter(([sql]) => /INSERT|UPDATE|DELETE/i.test(sql));
}

const META_VALIDA = { programa: "RCV", tipo_prestacion: "medicamentos", valor_meta: 2.5 };

describe("/api/admin/metas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockQuery.mockResolvedValue([]);
  });

  describe("GET", () => {
    it("permite los roles admin y direccion_medica", async () => {
      await GET(reqGet("?anio=2026"));
      expect(mockRequireAuth).toHaveBeenCalledWith(["admin", "direccion_medica"]);
    });

    it("retorna el error de requireAuth sin consultar la base de datos", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequireAuth.mockResolvedValue({ error: authError, user: null });

      const res = await GET(reqGet("?anio=2026"));

      expect(res).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("retorna las metas activas del año y la lista de años con metas", async () => {
      const metas = [
        { programa: "RCV", tipo_prestacion: "medicamentos", valor_meta: 2.5, escala: "ratio" },
      ];
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("DISTINCT anio")) return [{ anio: 2026 }, { anio: 2025 }] as never;
        return metas as never;
      });

      const res = await GET(reqGet("?anio=2026"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ anio: 2026, anios: [2026, 2025], metas });
    });

    it("filtra por año con un parámetro y solo filas activas", async () => {
      await GET(reqGet("?anio=2025"));

      const [sql, params] = mockQuery.mock.calls.find(([s]) => s.includes("valor_meta"))!;
      expect(sql).toContain("anio = $1");
      expect(sql).toContain("activo = TRUE");
      expect(sql).not.toContain("2025");
      expect(params).toEqual([2025]);
    });

    it("usa el año actual cuando no se envía anio", async () => {
      const res = await GET(reqGet());
      const body = await res.json();

      expect(body.anio).toBe(new Date().getFullYear());
    });

    it("rechaza un año no válido sin consultar la base de datos", async () => {
      for (const qs of ["?anio=abc", "?anio=1999", "?anio=2101", "?anio=2026.5"]) {
        const res = await GET(reqGet(qs));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toEqual(expect.any(String));
      }
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe("PUT", () => {
    it("permite solo el rol admin", async () => {
      await PUT(reqPut({ anio: 2026, metas: [META_VALIDA] }));
      expect(mockRequireAuth).toHaveBeenCalledWith(["admin"]);
    });

    it("retorna el error de requireAuth sin escribir", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequireAuth.mockResolvedValue({ error: authError, user: null });

      const res = await PUT(reqPut({ anio: 2026, metas: [META_VALIDA] }));

      expect(res).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("guarda todas las metas con un único INSERT parametrizado de varias filas", async () => {
      const res = await PUT(
        reqPut({
          anio: 2026,
          metas: [
            { programa: "RCV", tipo_prestacion: "medicamentos", valor_meta: 2.5 },
            { programa: "CPR", tipo_prestacion: "rx", valor_meta: 12 },
          ],
        })
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ guardadas: 2 });
      expect(mockQuery).toHaveBeenCalledTimes(1);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("INSERT INTO metas");
      expect(sql).toContain("($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)");
      expect(sql).toContain("ON CONFLICT (anio, programa, tipo_prestacion) DO UPDATE");
      expect(sql).toContain("valor_meta = EXCLUDED.valor_meta");
      expect(sql).toContain("escala = EXCLUDED.escala");
      expect(sql).toContain("activo = TRUE");
      expect(sql).toContain("actualizado_en = NOW()");
      expect(params).toEqual([
        2026, "RCV", "medicamentos", 2.5, "ratio",
        2026, "CPR", "rx", 12, "x100",
      ]);
    });

    it("no interpola los valores en el SQL", async () => {
      await PUT(
        reqPut({
          anio: 2031,
          metas: [{ programa: "NO PROGRAMADA", tipo_prestacion: "ecografias", valor_meta: 7.123456 }],
        })
      );

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).not.toContain("2031");
      expect(sql).not.toContain("NO PROGRAMADA");
      expect(sql).not.toContain("ecografias");
      expect(sql).not.toContain("7.123456");
      expect(sql).not.toContain("x100");
    });

    it("deriva la escala de las constantes del servidor e ignora la que envía el cliente", async () => {
      await PUT(
        reqPut({
          anio: 2026,
          metas: [
            { programa: "RCV", tipo_prestacion: "medicamentos", valor_meta: 2.5, escala: "x100" },
            { programa: "RCV", tipo_prestacion: "rx", valor_meta: 9, escala: "ratio" },
          ],
        })
      );

      const [, params] = mockQuery.mock.calls[0];
      expect(params).toEqual([
        2026, "RCV", "medicamentos", 2.5, "ratio",
        2026, "RCV", "rx", 9, "x100",
      ]);
    });

    it("rechaza un cuerpo que no es JSON", async () => {
      const res = await PUT({
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      } as unknown as Request);

      expect(res.status).toBe(400);
      expect(escrituras()).toHaveLength(0);
    });

    it.each([
      ["sin anio", { metas: [META_VALIDA] }],
      ["anio decimal", { anio: 2026.5, metas: [META_VALIDA] }],
      ["anio menor que 2000", { anio: 1999, metas: [META_VALIDA] }],
      ["anio mayor que 2100", { anio: 2101, metas: [META_VALIDA] }],
      ["anio como texto", { anio: "2026", metas: [META_VALIDA] }],
      ["sin metas", { anio: 2026 }],
      ["metas vacío", { anio: 2026, metas: [] }],
      ["metas que no es una lista", { anio: 2026, metas: "x" }],
      ["meta que no es un objeto", { anio: 2026, metas: [null] }],
      ["programa desconocido", { anio: 2026, metas: [{ ...META_VALIDA, programa: "OTRO" }] }],
      ["programa ausente", { anio: 2026, metas: [{ tipo_prestacion: "rx", valor_meta: 1 }] }],
      ["categoría desconocida", { anio: 2026, metas: [{ ...META_VALIDA, tipo_prestacion: "asesorias" }] }],
      ["valor cero", { anio: 2026, metas: [{ ...META_VALIDA, valor_meta: 0 }] }],
      ["valor negativo", { anio: 2026, metas: [{ ...META_VALIDA, valor_meta: -1 }] }],
      ["valor como texto", { anio: 2026, metas: [{ ...META_VALIDA, valor_meta: "2.5" }] }],
      ["valor nulo", { anio: 2026, metas: [{ ...META_VALIDA, valor_meta: null }] }],
      ["valor no finito", { anio: 2026, metas: [{ ...META_VALIDA, valor_meta: Infinity }] }],
      ["valor NaN", { anio: 2026, metas: [{ ...META_VALIDA, valor_meta: NaN }] }],
      ["valor que no cabe en la columna", { anio: 2026, metas: [{ ...META_VALIDA, valor_meta: 1000000 }] }],
      ["meta repetida", { anio: 2026, metas: [META_VALIDA, { ...META_VALIDA, valor_meta: 3 }] }],
    ])("rechaza con 400 y no escribe: %s", async (_caso, body) => {
      const res = await PUT(reqPut(body));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toEqual(expect.any(String));
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("no escribe ninguna fila si una sola de las metas es inválida", async () => {
      const res = await PUT(
        reqPut({
          anio: 2026,
          metas: [
            META_VALIDA,
            { programa: "CPR", tipo_prestacion: "rx", valor_meta: 12 },
            { programa: "CPR", tipo_prestacion: "laboratorios", valor_meta: -4 },
          ],
        })
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("CPR");
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("vacía el caché después de guardar para que el cumplimiento refleje las metas", async () => {
      await PUT(reqPut({ anio: 2026, metas: [META_VALIDA] }));

      expect(clearCache).toHaveBeenCalledTimes(1);
    });

    it("no vacía el caché si la solicitud se rechaza o la escritura falla", async () => {
      await PUT(reqPut({ anio: 2026, metas: [{ ...META_VALIDA, valor_meta: -1 }] }));
      expect(clearCache).not.toHaveBeenCalled();

      mockQuery.mockRejectedValue(new Error("fallo de base de datos"));
      await expect(PUT(reqPut({ anio: 2026, metas: [META_VALIDA] }))).rejects.toThrow();
      expect(clearCache).not.toHaveBeenCalled();
    });
  });
});
