jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requirePermiso: jest.fn() }));

import { NextResponse } from "next/server";
import { GET, PUT } from "@/app/api/admin/citas/areas/route";
import { query } from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequirePermiso = requirePermiso as jest.MockedFunction<typeof requirePermiso>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };
const AREAS = [{ nombre: "Medicina general" }, { nombre: "Salud oral" }, { nombre: "Enfermería" }];

function reqPut(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

const plano = (sql: string) => sql.replace(/\s+/g, " ");

/** Responde la consulta según su SQL: áreas, servicios existentes o el UPDATE. */
function responderPut(existentes: string[]) {
  mockQuery.mockImplementation((async (sql: string) => {
    const s = plano(sql);
    if (s.includes("FROM areas_servicio")) return AREAS;
    if (s.startsWith("SELECT codigo_servicio FROM servicios_citas")) {
      return existentes.map((codigo_servicio) => ({ codigo_servicio }));
    }
    if (s.startsWith("UPDATE servicios_citas")) {
      return existentes.map((codigo_servicio) => ({ codigo_servicio }));
    }
    return [];
  }) as never);
}

describe("/api/admin/citas/areas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePermiso.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockQuery.mockResolvedValue([]);
  });

  describe("GET", () => {
    it("pide ver Citas", async () => {
      await GET();
      expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["citas"], nivel: "ver" });
    });

    it("retorna el error de requirePermiso sin consultar la base de datos", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequirePermiso.mockResolvedValue({ error: authError, user: null });

      const res = await GET();

      expect(res).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("retorna las áreas en orden y cada servicio con su área, la regla y las asignadas del último mes", async () => {
      const servicios = [
        {
          codigo_servicio: "50110", nombre_servicio: "CONSULTA MEDICINA GENERAL",
          area: "Medicina general", area_regla: "Medicina general", area_editada: false,
          ultimo_periodo: 202610, asignadas: 120,
        },
        {
          codigo_servicio: "62574", nombre_servicio: "ELECTROCARDIOGRAMA",
          area: "Medicina general", area_regla: "Enfermería", area_editada: true,
          ultimo_periodo: 202609, asignadas: 0,
        },
      ];
      mockQuery.mockImplementation((async (sql: string) => {
        const s = plano(sql);
        if (s.includes("FROM areas_servicio")) return AREAS;
        if (s.includes("MAX(periodo)")) return [{ periodo: 202610 }];
        return servicios;
      }) as never);

      const res = await GET();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        areas: ["Medicina general", "Salud oral", "Enfermería"],
        periodo: 202610,
        servicios,
      });
    });

    it("cuenta las asignadas solo de la carga mensual del último mes cargado", async () => {
      mockQuery.mockImplementation((async (sql: string) =>
        plano(sql).includes("MAX(periodo)") ? [{ periodo: 202610 }] : []) as never);

      await GET();

      const consultaPeriodo = mockQuery.mock.calls.map((c) => plano(c[0])).find((s) =>
        s.includes("MAX(periodo)"))!;
      expect(consultaPeriodo).toContain("granularidad = 'mensual'");

      const [sql, params] = mockQuery.mock.calls.find((c) =>
        plano(c[0]).includes("FROM servicios_citas"))!;
      expect(plano(sql)).toContain("clasificar_area_servicio(s.nombre_servicio) AS area_regla");
      expect(plano(sql)).toContain("c.granularidad = 'mensual' AND c.periodo = $1");
      expect(params).toEqual([202610]);
    });

    it("sin cargas mensuales retorna periodo null", async () => {
      mockQuery.mockImplementation((async (sql: string) =>
        plano(sql).includes("MAX(periodo)") ? [{ periodo: null }] : []) as never);

      const res = await GET();

      expect((await res.json()).periodo).toBeNull();
    });
  });

  describe("PUT", () => {
    it("pide editar Citas y no escribe sin permiso", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequirePermiso.mockResolvedValue({ error: authError, user: null });

      const res = await PUT(reqPut({ cambios: [{ codigo_servicio: "1", area: "Salud oral" }] }));

      expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["citas"], nivel: "editar" });
      expect(res).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("asigna varias áreas y restablece otras con un único UPDATE parametrizado", async () => {
      responderPut(["62574", "19", "778"]);

      const res = await PUT(
        reqPut({
          cambios: [
            { codigo_servicio: "62574", area: "Enfermería" },
            { codigo_servicio: " 19 ", area: "Salud oral" },
            { codigo_servicio: "778", area: null },
          ],
        })
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ actualizados: 3 });

      const updates = mockQuery.mock.calls.filter((c) => plano(c[0]).startsWith("UPDATE"));
      expect(updates).toHaveLength(1);
      const [sql, params] = updates[0];
      const s = plano(sql);
      expect(s).toContain("UPDATE servicios_citas s SET");
      // null = restablecer: el área vuelve a la regla y deja de estar editada
      expect(s).toContain("area = COALESCE(v.area, clasificar_area_servicio(s.nombre_servicio))");
      expect(s).toContain("area_editada = v.area IS NOT NULL");
      expect(s).toContain("($1::varchar, $2::varchar), ($3::varchar, $4::varchar), ($5::varchar, $6::varchar)");
      expect(s).not.toContain("Enfermería");
      expect(params).toEqual(["62574", "Enfermería", "19", "Salud oral", "778", null]);
    });

    it.each([
      [null, "El cuerpo de la solicitud no es válido"],
      [{}, "Debe enviar al menos un servicio"],
      [{ cambios: [] }, "Debe enviar al menos un servicio"],
      [{ cambios: ["x"] }, "Fila 1: formato no válido"],
      [{ cambios: [{ codigo_servicio: "", area: "Salud oral" }] }, "Fila 1: el código de servicio no es válido"],
      [{ cambios: [{ codigo_servicio: "1".repeat(21), area: "Salud oral" }] }, "Fila 1: el código de servicio no es válido"],
      [
        { cambios: [{ codigo_servicio: "1", area: "Salud oral" }, { codigo_servicio: "1", area: null }] },
        "Fila 2 (1): el servicio está repetido",
      ],
      [{ cambios: [{ codigo_servicio: "1", area: 3 }] }, "Fila 1 (1): área no válida"],
      [{ cambios: [{ codigo_servicio: "1" }] }, "Fila 1 (1): área no válida"],
      [{ cambios: [{ codigo_servicio: "1", area: "Cardiología" }] }, "Fila 1 (1): área no válida"],
    ])("rechaza %j sin escribir", async (body, mensaje) => {
      responderPut(["1"]);

      const res = await PUT(reqPut(body));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: mensaje });
      expect(mockQuery.mock.calls.some((c) => plano(c[0]).startsWith("UPDATE"))).toBe(false);
    });

    it("rechaza un cuerpo que no es JSON", async () => {
      const res = await PUT({
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      } as unknown as Request);

      expect(res.status).toBe(400);
    });

    it("rechaza servicios que no existen sin escribir ninguno", async () => {
      responderPut(["62574"]);

      const res = await PUT(
        reqPut({
          cambios: [
            { codigo_servicio: "62574", area: "Enfermería" },
            { codigo_servicio: "999", area: "Salud oral" },
          ],
        })
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Servicios no encontrados: 999" });
      expect(mockQuery.mock.calls.some((c) => plano(c[0]).startsWith("UPDATE"))).toBe(false);
    });
  });
});
