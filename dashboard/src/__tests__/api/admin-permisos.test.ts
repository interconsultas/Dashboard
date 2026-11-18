jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requirePermiso: jest.fn() }));
jest.mock("@/lib/permisos", () => ({ invalidarPermisos: jest.fn() }));

import { NextResponse } from "next/server";
import { GET, PUT } from "@/app/api/admin/permisos/route";
import { query } from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";
import { invalidarPermisos } from "@/lib/permisos";
import { PERMISOS_POR_DEFECTO, ROLES, SECCIONES } from "@/lib/acceso";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequirePermiso = requirePermiso as jest.MockedFunction<typeof requirePermiso>;
const mockInvalidar = invalidarPermisos as jest.MockedFunction<typeof invalidarPermisos>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

const FILAS_DEFECTO = ROLES.flatMap((rol) =>
  SECCIONES.map((s) => ({ rol, seccion: s.clave, nivel: PERMISOS_POR_DEFECTO[rol][s.clave] })),
);

function reqPut(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

const escrituras = () => mockQuery.mock.calls.filter(([sql]) => /INSERT|UPDATE|DELETE/i.test(sql));

describe("/api/admin/permisos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePermiso.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockQuery.mockImplementation((async (sql: string) =>
      /^\s*SELECT/i.test(sql) ? FILAS_DEFECTO : []) as never);
  });

  describe("GET", () => {
    it("pide ver Usuarios (solo admin)", async () => {
      await GET();
      expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["usuarios"], nivel: "ver" });
    });

    it("retorna el error de permisos sin consultar la base de datos", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequirePermiso.mockResolvedValue({ error: authError, user: null });
      expect(await GET()).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("retorna los permisos efectivos de cada rol", async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ permisos: PERMISOS_POR_DEFECTO });
    });

    it("admin aparece con acceso total aunque la base diga otra cosa", async () => {
      mockQuery.mockResolvedValue([{ rol: "admin", seccion: "metas", nivel: "ninguno" }] as never);
      const body = await (await GET()).json();
      expect(body.permisos.admin.metas).toBe("editar");
    });
  });

  describe("PUT", () => {
    const CAMBIO = { rol: "coordinador", seccion: "productividad", nivel: "ver" };

    it("pide editar Usuarios (solo admin)", async () => {
      await PUT(reqPut({ cambios: [CAMBIO] }));
      expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["usuarios"], nivel: "editar" });
    });

    it("retorna el error de permisos sin escribir", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequirePermiso.mockResolvedValue({ error: authError, user: null });
      expect(await PUT(reqPut({ cambios: [CAMBIO] }))).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
      expect(mockInvalidar).not.toHaveBeenCalled();
    });

    it("guarda todos los cambios en un único INSERT parametrizado (una transacción)", async () => {
      const res = await PUT(
        reqPut({
          cambios: [CAMBIO, { rol: "direccion_medica", seccion: "metas", nivel: "editar" }],
        }),
      );

      expect(res.status).toBe(200);
      expect(escrituras()).toHaveLength(1);
      const [sql, params] = escrituras()[0];
      expect(sql).toContain("INSERT INTO permisos_rol");
      expect(sql).toContain("($1, $2, $3), ($4, $5, $6)");
      expect(sql).toContain("ON CONFLICT (rol, seccion) DO UPDATE");
      expect(sql).toContain("nivel = EXCLUDED.nivel");
      expect(sql).not.toContain("coordinador");
      expect(params).toEqual(["coordinador", "productividad", "ver", "direccion_medica", "metas", "editar"]);
    });

    it("invalida el caché y devuelve los permisos actualizados", async () => {
      const res = await PUT(reqPut({ cambios: [CAMBIO] }));
      const body = await res.json();

      expect(mockInvalidar).toHaveBeenCalledTimes(1);
      expect(body.actualizados).toBe(1);
      expect(body.permisos).toEqual(PERMISOS_POR_DEFECTO);
    });

    it.each([
      ["cuerpo vacío", {}],
      ["rol admin", { cambios: [{ rol: "admin", seccion: "metas", nivel: "ninguno" }] }],
      ["sección usuarios", { cambios: [{ rol: "coordinador", seccion: "usuarios", nivel: "editar" }] }],
      ["editar en solo consulta", { cambios: [{ rol: "coordinador", seccion: "productividad", nivel: "editar" }] }],
      ["sección desconocida", { cambios: [{ rol: "coordinador", seccion: "otra", nivel: "ver" }] }],
    ])("rechaza con 400 sin escribir ni invalidar: %s", async (_caso, body) => {
      const res = await PUT(reqPut(body));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toEqual(expect.any(String));
      expect(mockQuery).not.toHaveBeenCalled();
      expect(mockInvalidar).not.toHaveBeenCalled();
    });

    it("rechaza un cuerpo que no es JSON", async () => {
      const res = await PUT({ json: async () => { throw new SyntaxError("x"); } } as unknown as Request);
      expect(res.status).toBe(400);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("si la escritura falla no invalida el caché", async () => {
      mockQuery.mockRejectedValue(new Error("fallo de base de datos"));
      await expect(PUT(reqPut({ cambios: [CAMBIO] }))).rejects.toThrow();
      expect(mockInvalidar).not.toHaveBeenCalled();
    });
  });
});
