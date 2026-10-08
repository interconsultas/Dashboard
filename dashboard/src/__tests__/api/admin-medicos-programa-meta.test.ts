jest.mock("@/lib/db", () => ({ query: jest.fn(), queryOne: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requireAuth: jest.fn() }));

import { NextResponse } from "next/server";
import { GET, POST } from "@/app/api/admin/medicos/route";
import { PATCH } from "@/app/api/admin/medicos/[id]/route";
import { query, queryOne } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

function req(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

const NUEVO = { usuario_txt: "JPEREZ", identificacion: 10234567, nombre: "PEREZ JUAN" };
const PARAMS = { params: { id: "JPEREZ" } };

/** Llamadas a queryOne cuyo SQL escribe en la tabla medicos. */
function escrituras() {
  return mockQueryOne.mock.calls.filter(([sql]) => /INSERT|UPDATE|DELETE/i.test(sql));
}

describe("programa_meta en /api/admin/medicos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockQuery.mockResolvedValue([]);
    mockQueryOne.mockResolvedValue(null);
  });

  describe("GET", () => {
    it("incluye programa_meta en la consulta y en la respuesta", async () => {
      const filas = [{ ...NUEVO, estado: "ACTIVO", programa_especialidad: null, area: null, programa_meta: "RCV" }];
      mockQuery.mockResolvedValue(filas as never);

      const res = await GET();

      expect(mockQuery.mock.calls[0][0]).toContain("programa_meta");
      expect(await res.json()).toEqual(filas);
    });
  });

  describe("POST", () => {
    it("retorna el error de requireAuth sin escribir", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequireAuth.mockResolvedValue({ error: authError, user: null });

      const res = await POST(req({ ...NUEVO, programa_meta: "RCV" }));

      expect(res).toBe(authError);
      expect(mockQueryOne).not.toHaveBeenCalled();
    });

    it("guarda un programa de metas válido como parámetro", async () => {
      const res = await POST(req({ ...NUEVO, programa_meta: "CyD-RIAS-PF-SALUD PÚBLICA" }));

      expect(res.status).toBe(201);
      const [[sql, params]] = escrituras();
      expect(sql).toContain("programa_meta");
      expect(sql).not.toContain("CyD-RIAS");
      expect(params).toEqual([
        "JPEREZ", 10234567, "PEREZ JUAN", "ACTIVO", null, null, "CyD-RIAS-PF-SALUD PÚBLICA",
      ]);
    });

    it.each([
      ["null", null],
      ["texto vacío", ""],
      ["ausente", undefined],
    ])("guarda NULL cuando programa_meta es %s", async (_caso, valor) => {
      const res = await POST(req({ ...NUEVO, programa_meta: valor }));

      expect(res.status).toBe(201);
      const [[, params]] = escrituras();
      expect(params).toHaveLength(7);
      expect(params![6]).toBeNull();
    });

    it("rechaza con 400 un programa de metas desconocido y no consulta ni escribe", async () => {
      const res = await POST(req({ ...NUEVO, programa_meta: "OTRO" }));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("Programa de metas");
      expect(mockQueryOne).not.toHaveBeenCalled();
    });
  });

  describe("PATCH", () => {
    it("retorna el error de requireAuth sin escribir", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequireAuth.mockResolvedValue({ error: authError, user: null });

      const res = await PATCH(req({ programa_meta: "RCV" }), PARAMS);

      expect(res).toBe(authError);
      expect(mockQueryOne).not.toHaveBeenCalled();
    });

    it("actualiza programa_meta como parámetro", async () => {
      const res = await PATCH(req({ programa_meta: "NO PROGRAMADA" }), PARAMS);

      expect(res.status).toBe(200);
      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain("programa_meta=$1");
      expect(sql).toContain("WHERE usuario_txt=$2");
      expect(sql).not.toContain("NO PROGRAMADA");
      expect(params).toEqual(["NO PROGRAMADA", "JPEREZ"]);
    });

    it.each([
      ["null", null],
      ["texto vacío", ""],
    ])("guarda NULL cuando programa_meta es %s", async (_caso, valor) => {
      const res = await PATCH(req({ programa_meta: valor }), PARAMS);

      expect(res.status).toBe(200);
      expect(mockQueryOne.mock.calls[0][1]).toEqual([null, "JPEREZ"]);
    });

    it("no toca programa_meta cuando el cuerpo no lo incluye", async () => {
      await PATCH(req({ nombre: "PEREZ JUAN CARLOS" }), PARAMS);

      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).not.toContain("programa_meta");
      expect(params).toEqual(["PEREZ JUAN CARLOS", "JPEREZ"]);
    });

    it("rechaza con 400 un programa de metas desconocido y no escribe", async () => {
      const res = await PATCH(req({ nombre: "PEREZ JUAN", programa_meta: "OTRO" }), PARAMS);

      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("Programa de metas");
      expect(mockQueryOne).not.toHaveBeenCalled();
    });
  });
});
