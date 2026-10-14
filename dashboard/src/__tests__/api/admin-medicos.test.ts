jest.mock("@/lib/db", () => ({ query: jest.fn(), queryOne: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requireAuth: jest.fn() }));

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

// El programa de metas ya no se guarda por profesional: se resuelve desde
// programa_especialidad con la tabla programa_meta_mapeo (014_metas_v5.sql).
describe("/api/admin/medicos sin programa_meta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockQuery.mockResolvedValue([]);
    mockQueryOne.mockResolvedValue(null);
  });

  it("GET no consulta la columna programa_meta", async () => {
    await GET();

    expect(mockQuery.mock.calls[0][0]).not.toContain("programa_meta");
    expect(mockQuery.mock.calls[0][0]).toContain("programa_especialidad");
  });

  it("POST inserta las 6 columnas del catálogo e ignora programa_meta", async () => {
    const res = await POST(req({ ...NUEVO, programa_meta: "RCV" }));

    expect(res.status).toBe(201);
    const [[sql, params]] = escrituras();
    expect(sql).not.toContain("programa_meta");
    expect(params).toEqual(["JPEREZ", 10234567, "PEREZ JUAN", "ACTIVO", null, null]);
  });

  it("POST ya no rechaza un programa_meta desconocido: el campo no existe", async () => {
    const res = await POST(req({ ...NUEVO, programa_meta: "OTRO" }));

    expect(res.status).toBe(201);
  });

  it("PATCH ignora programa_meta", async () => {
    const res = await PATCH(req({ nombre: "PEREZ JUAN CARLOS", programa_meta: "RCV" }), PARAMS);

    expect(res.status).toBe(200);
    const [sql, params] = mockQueryOne.mock.calls[0];
    expect(sql).not.toContain("programa_meta");
    expect(params).toEqual(["PEREZ JUAN CARLOS", "JPEREZ"]);
  });

  it("PATCH con solo programa_meta no tiene nada que actualizar", async () => {
    const res = await PATCH(req({ programa_meta: "RCV" }), PARAMS);

    expect(res.status).toBe(400);
    expect(mockQueryOne).not.toHaveBeenCalled();
  });
});
