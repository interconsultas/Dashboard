jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { connect: jest.fn() },
  query: jest.fn(),
}));
jest.mock("@/lib/middleware-roles", () => ({ requirePermiso: jest.fn() }));
jest.mock("@/lib/cache", () => ({ clearCachePrefix: jest.fn(), getCached: jest.fn(), setCache: jest.fn() }));

import { NextResponse } from "next/server";
import { GET, PUT } from "@/app/api/inteligencia/reglas/route";
import pool, { query } from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";
import { clearCachePrefix } from "@/lib/cache";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockConnect = pool.connect as unknown as jest.Mock;
const mockRequirePermiso = requirePermiso as jest.MockedFunction<typeof requirePermiso>;
const mockClearPrefix = clearCachePrefix as jest.MockedFunction<typeof clearCachePrefix>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };
const client = { query: jest.fn(), release: jest.fn() };

const FILAS = [
  { clave: "proyeccion_sobre_meta", nombre: "D", descripcion: "d", activa: true, umbral: null, periodos: null, minimo: null, gravedad: "alta", actualizado_en: "2026-11-18", actualizado_por: null },
  { clave: "inasistencia_servicio", nombre: "A", descripcion: "a", activa: true, umbral: "0.2000", periodos: 2, minimo: 30, gravedad: "alta", actualizado_en: "2026-11-18", actualizado_por: "admin@ips.local" },
  { clave: "obsoleta", nombre: "X", descripcion: "x", activa: true, umbral: "0.5", periodos: null, minimo: null, gravedad: "media", actualizado_en: "2026-11-18", actualizado_por: null },
];

const reqPut = (body: unknown) => ({ json: async () => body }) as unknown as Request;
const CAMBIO = { clave: "inasistencia_servicio", activa: false, umbral: 0.25, periodos: 3, minimo: 40 };

const sentencias = () => client.query.mock.calls.map(([sql]) => String(sql).trim().split(/\s+/)[0]);

beforeEach(() => {
  jest.clearAllMocks();
  mockRequirePermiso.mockResolvedValue({ error: null, user: ADMIN_USER });
  mockQuery.mockResolvedValue(FILAS as never);
  mockConnect.mockResolvedValue(client);
  client.query.mockResolvedValue({ rowCount: 1 });
});

describe("GET /api/inteligencia/reglas", () => {
  it("pide ver Inteligencia y devuelve las reglas conocidas en el orden del catálogo", async () => {
    const res = await GET();
    expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["inteligencia"], nivel: "ver" });
    const body = await res.json();
    expect(body.reglas.map((r: { clave: string }) => r.clave)).toEqual(["inasistencia_servicio", "proyeccion_sobre_meta"]);
    expect(body.reglas[0].umbral).toBe(0.2);
  });

  it("sin permiso → error", async () => {
    mockRequirePermiso.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }), user: null });
    expect((await GET()).status).toBe(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("PUT /api/inteligencia/reglas", () => {
  it("pide editar Inteligencia", async () => {
    mockRequirePermiso.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }), user: null });
    const res = await PUT(reqPut({ reglas: [CAMBIO] }));
    expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["inteligencia"], nivel: "editar" });
    expect(res.status).toBe(403);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("valida antes de escribir → 400", async () => {
    const res = await PUT(reqPut({ reglas: [{ ...CAMBIO, umbral: 2 }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Fila 1: el umbral debe estar entre 0 % y 100 %");
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("cuerpo no JSON → 400", async () => {
    const res = await PUT({ json: async () => { throw new Error("x"); } } as unknown as Request);
    expect(res.status).toBe(400);
  });

  it("actualiza en una transacción, registra quién y limpia el caché de alertas", async () => {
    const res = await PUT(reqPut({ reglas: [CAMBIO, { clave: "proyeccion_sobre_meta", activa: true, umbral: null }] }));
    expect(res.status).toBe(200);
    expect(sentencias()).toEqual(["BEGIN", "UPDATE", "UPDATE", "COMMIT"]);
    const [sql, params] = client.query.mock.calls[1];
    expect(String(sql)).toContain("actualizado_en = NOW()");
    expect(params).toEqual(["inasistencia_servicio", false, 0.25, 3, 40, "admin@ips.local"]);
    expect(client.query.mock.calls[2][1]).toEqual(["proyeccion_sobre_meta", true, null, null, null, "admin@ips.local"]);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(mockClearPrefix).toHaveBeenCalledWith("inteligencia:alertas:");
    const body = await res.json();
    expect(body.actualizadas).toBe(2);
    expect(body.reglas).toHaveLength(2);
  });

  it("una regla que no existe en la tabla revierte todo → 409", async () => {
    client.query.mockImplementation(async (sql: string, params?: unknown[]) =>
      String(sql).startsWith("UPDATE") && params?.[0] === "proyeccion_sobre_meta" ? { rowCount: 0 } : { rowCount: 1 }
    );
    const res = await PUT(reqPut({ reglas: [CAMBIO, { clave: "proyeccion_sobre_meta", activa: true, umbral: null }] }));
    expect(res.status).toBe(409);
    expect(sentencias()).toEqual(["BEGIN", "UPDATE", "UPDATE", "ROLLBACK"]);
    expect(mockClearPrefix).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("error de BD → ROLLBACK, libera la conexión y 500", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (String(sql).startsWith("UPDATE")) throw new Error("fallo");
      return { rowCount: 1 };
    });
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await PUT(reqPut({ reglas: [CAMBIO] }));
    expect(res.status).toBe(500);
    expect(sentencias()).toEqual(["BEGIN", "UPDATE", "ROLLBACK"]);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(mockClearPrefix).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
