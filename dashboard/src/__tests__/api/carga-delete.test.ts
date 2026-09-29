import { NextResponse } from "next/server";

jest.mock("@/lib/db", () => ({ query: jest.fn(), queryOne: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requireAuth: jest.fn() }));
jest.mock("@/lib/etl-spawn", () => ({ spawnEtl: jest.fn() }));

import { DELETE } from "@/app/api/carga/[jobId]/route";
import { query, queryOne } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { spawnEtl } from "@/lib/etl-spawn";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockSpawnEtl = spawnEtl as jest.MockedFunction<typeof spawnEtl>;

const JOB_ID = "550e8400-e29b-41d4-a716-446655440000";
const ADMIN_USER = {
  id: "1",
  email: "admin@ips.local",
  rol: "admin" as const,
  regional: null,
};

function call(jobId: string) {
  return DELETE({} as never, { params: { jobId } });
}

describe("DELETE /api/carga/[jobId]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna el error de requireAuth si no está autorizado", async () => {
    const authError = NextResponse.json({ error: "No autenticado" }, { status: 401 });
    mockRequireAuth.mockResolvedValue({ error: authError, user: null });

    const res = await call(JOB_ID);

    expect(res.status).toBe(401);
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it("retorna 400 si jobId no tiene formato UUID", async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });

    const res = await call("no-es-un-uuid");

    expect(res.status).toBe(400);
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it("retorna 404 si el job no existe", async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockQueryOne.mockResolvedValue(null);

    const res = await call(JOB_ID);

    expect(res.status).toBe(404);
  });

  it("retorna 409 si el estado no es eliminable", async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockQueryOne.mockResolvedValue({ estado: "procesando", periodo_detectado: 202603 });

    const res = await call(JOB_ID);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/procesando/);
    expect(mockSpawnEtl).not.toHaveBeenCalled();
  });

  it("retorna 409 si no tiene periodo_detectado", async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockQueryOne.mockResolvedValue({ estado: "exitoso", periodo_detectado: null });

    const res = await call(JOB_ID);

    expect(res.status).toBe(409);
    expect(mockSpawnEtl).not.toHaveBeenCalled();
  });

  it("retorna 409 si pierde la carrera al marcar 'eliminando' (doble click)", async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockQueryOne.mockResolvedValue({ estado: "exitoso", periodo_detectado: 202603 });
    mockQuery.mockResolvedValue([]);

    const res = await call(JOB_ID);

    expect(res.status).toBe(409);
    expect(mockSpawnEtl).not.toHaveBeenCalled();
  });

  it.each(["exitoso", "exitoso_con_advertencias"])(
    "retorna 202 y spawnea --delete cuando el estado es '%s'",
    async (estado) => {
      mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
      mockQueryOne.mockResolvedValue({ estado, periodo_detectado: 202603 });
      mockQuery.mockResolvedValue([{ job_id: JOB_ID }]);

      const res = await call(JOB_ID);
      const body = await res.json();

      expect(res.status).toBe(202);
      expect(body).toEqual({ mensaje: "Eliminación en proceso" });
      expect(mockSpawnEtl).toHaveBeenCalledWith(["--delete", JOB_ID], JOB_ID);
    }
  );

  it("marca 'eliminando' solo si el estado sigue siendo eliminable (query atómica)", async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockQueryOne.mockResolvedValue({ estado: "exitoso", periodo_detectado: 202603 });
    mockQuery.mockResolvedValue([{ job_id: JOB_ID }]);

    await call(JOB_ID);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/UPDATE log_cargas/);
    expect(sql).toMatch(/eliminando/);
    expect(sql).toMatch(/RETURNING/i);
    expect(params).toEqual([JOB_ID]);
  });
});
