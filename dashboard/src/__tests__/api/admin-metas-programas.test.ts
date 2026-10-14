jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requireAuth: jest.fn() }));
jest.mock("@/lib/cache", () => ({ clearCache: jest.fn() }));

import { NextResponse } from "next/server";
import { GET, PUT } from "@/app/api/admin/metas/programas/route";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { clearCache } from "@/lib/cache";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

function reqPut(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

const FILA_VALIDA = { programa_especialidad: "RCV", programa: "RCV" };

describe("/api/admin/metas/programas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockQuery.mockResolvedValue([]);
  });

  describe("GET", () => {
    it("permite los roles admin y direccion_medica", async () => {
      await GET();
      expect(mockRequireAuth).toHaveBeenCalledWith(["admin", "direccion_medica"]);
    });

    it("retorna el error de requireAuth sin consultar la base de datos", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequireAuth.mockResolvedValue({ error: authError, user: null });

      const res = await GET();

      expect(res).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("retorna cada especialidad con su programa y el número de profesionales", async () => {
      const filas = [
        { programa_especialidad: "MÉDICO GENERAL INTEGRADOR", programa: "PROGRAMADA", profesionales: 12 },
        { programa_especialidad: "ODONTÓLOGO", programa: null, profesionales: 4 },
        { programa_especialidad: "PEDIATRÍA", programa: "PEDIATRÍA", profesionales: 0 },
      ];
      mockQuery.mockResolvedValue(filas as never);

      const res = await GET();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ mapeo: filas });
    });

    it("une las especialidades de medicos con las del mapeo, sin distinguir mayúsculas ni espacios", async () => {
      await GET();

      const sql = mockQuery.mock.calls[0][0].replace(/\s+/g, " ");
      expect(sql).toContain("UPPER(TRIM(programa_especialidad))");
      expect(sql).toContain("FROM medicos");
      expect(sql).toContain("FULL JOIN programa_meta_mapeo");
      expect(sql).toContain("ORDER BY");
    });
  });

  describe("PUT", () => {
    it("permite solo el rol admin", async () => {
      await PUT(reqPut({ mapeo: [FILA_VALIDA] }));
      expect(mockRequireAuth).toHaveBeenCalledWith(["admin"]);
    });

    it("retorna el error de requireAuth sin escribir", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequireAuth.mockResolvedValue({ error: authError, user: null });

      const res = await PUT(reqPut({ mapeo: [FILA_VALIDA] }));

      expect(res).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("guarda todo con un único INSERT parametrizado y normaliza la especialidad", async () => {
      const res = await PUT(
        reqPut({
          mapeo: [
            { programa_especialidad: "  médico general integrador ", programa: "PROGRAMADA" },
            { programa_especialidad: "ODONTÓLOGO", programa: null },
            { programa_especialidad: "SSR", programa: "" },
          ],
        })
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ guardadas: 3 });
      expect(mockQuery).toHaveBeenCalledTimes(1);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("INSERT INTO programa_meta_mapeo (programa_especialidad, programa)");
      expect(sql).toContain("($1, $2), ($3, $4), ($5, $6)");
      expect(sql).toContain("ON CONFLICT (programa_especialidad) DO UPDATE");
      expect(sql).toContain("programa = EXCLUDED.programa");
      expect(sql).toContain("actualizado_en = NOW()");
      expect(sql).not.toContain("PROGRAMADA");
      expect(sql).not.toContain("ODONTÓLOGO");
      expect(params).toEqual([
        "MÉDICO GENERAL INTEGRADOR", "PROGRAMADA",
        "ODONTÓLOGO", null,
        "SSR", null,
      ]);
    });

    it("vacía el caché después de guardar para que el cumplimiento use el nuevo mapeo", async () => {
      await PUT(reqPut({ mapeo: [FILA_VALIDA] }));
      expect(clearCache).toHaveBeenCalledTimes(1);
    });

    it("rechaza un cuerpo que no es JSON", async () => {
      const res = await PUT({
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      } as unknown as Request);

      expect(res.status).toBe(400);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it.each([
      ["sin mapeo", {}],
      ["mapeo vacío", { mapeo: [] }],
      ["mapeo que no es una lista", { mapeo: "x" }],
      ["fila que no es un objeto", { mapeo: [null] }],
      ["especialidad ausente", { mapeo: [{ programa: "RCV" }] }],
      ["especialidad vacía", { mapeo: [{ programa_especialidad: "   ", programa: "RCV" }] }],
      ["especialidad que no es texto", { mapeo: [{ programa_especialidad: 5, programa: "RCV" }] }],
      ["especialidad demasiado larga", { mapeo: [{ programa_especialidad: "X".repeat(101), programa: "RCV" }] }],
      ["programa desconocido", { mapeo: [{ ...FILA_VALIDA, programa: "OTRO" }] }],
      ["programa TOTAL MGI (no asignable)", { mapeo: [{ ...FILA_VALIDA, programa: "TOTAL MGI" }] }],
      [
        "especialidad repetida sin importar mayúsculas",
        { mapeo: [FILA_VALIDA, { programa_especialidad: " rcv", programa: null }] },
      ],
    ])("rechaza con 400 y no escribe: %s", async (_caso, body) => {
      const res = await PUT(reqPut(body));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toEqual(expect.any(String));
      expect(mockQuery).not.toHaveBeenCalled();
      expect(clearCache).not.toHaveBeenCalled();
    });
  });
});
