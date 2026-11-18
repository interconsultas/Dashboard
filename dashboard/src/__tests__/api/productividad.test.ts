jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requirePermiso: jest.fn() }));
jest.mock("@/lib/cache", () => ({ getCached: jest.fn(() => null), setCache: jest.fn() }));

import { NextResponse } from "next/server";
import { GET } from "@/app/api/productividad/route";
import { query } from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";
import { getCached, setCache } from "@/lib/cache";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequirePermiso = requirePermiso as jest.MockedFunction<typeof requirePermiso>;
const mockGetCached = getCached as jest.MockedFunction<typeof getCached>;
const mockSetCache = setCache as jest.MockedFunction<typeof setCache>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

function req(qs = ""): Request {
  return { url: `http://localhost/api/productividad${qs ? `?${qs}` : ""}` } as Request;
}

const plano = (sql: string) => sql.replace(/\s+/g, " ");

const CARGAS = [
  { granularidad: "mensual", periodo: 202609, fecha_inicial: "2026-09-01", fecha_final: "2026-09-30" },
  { granularidad: "mensual", periodo: 202610, fecha_inicial: "2026-10-01", fecha_final: "2026-10-31" },
];

/** pg entrega SUM()::int como número, pero se prueba también el texto (BIGINT). */
const METRICAS = {
  creadas: 0, bloqueadas: 0, confirmadas: 0, confirmadas_sin_atencion: 0, canceladas: 0, pendientes_por_asistir: 0,
};
const FILAS = [
  { fecha_inicial: "2026-09-01", codigo_servicio: "11", nombre_servicio: "CONSULTA", area: "Medicina general", ...METRICAS, ofertadas: 100, asignadas: 80, inasistidas: 8, disponibles: 20 },
  { fecha_inicial: "2026-10-01", codigo_servicio: "11", nombre_servicio: "CONSULTA", area: "Medicina general", ...METRICAS, ofertadas: "120", asignadas: "100", inasistidas: "17", disponibles: "20" },
];
const PROFESIONALES = [
  { documento: "1053", nombre: "PROFESIONAL A", codigo_servicio: "11", area: "Medicina general", area_principal: "Medicina general", ...METRICAS, ofertadas: 120, asignadas: 100, inasistidas: 17, disponibles: 20 },
];

function mockBD(opciones: { cargas?: unknown[] } = {}) {
  mockQuery.mockImplementation((async (sql: string) => {
    const s = plano(sql);
    if (s.includes("FROM areas_servicio ORDER BY")) return [{ nombre: "Medicina general" }, { nombre: "Salud oral" }];
    if (s.includes("SELECT DISTINCT granularidad")) return opciones.cargas ?? CARGAS;
    if (s.includes("FROM servicios_citas")) return [{ codigo: "11", nombre: "CONSULTA", area: "Medicina general" }];
    if (s.includes("v_citas_area_principal")) return PROFESIONALES;
    if (s.includes("FROM v_citas_area")) return FILAS;
    return [];
  }) as never);
}

function llamada(fragmento: string) {
  const c = mockQuery.mock.calls.find(([sql]) => plano(sql).includes(fragmento));
  if (!c) throw new Error(`No se ejecutó ninguna consulta con: ${fragmento}`);
  return { sql: plano(c[0]), params: c[1] as unknown[] };
}

describe("GET /api/productividad", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePermiso.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockGetCached.mockReturnValue(null);
    mockBD();
  });

  describe("permisos", () => {
    it("pide ver Productividad", async () => {
      await GET(req());
      expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["productividad"], nivel: "ver" });
    });

    it("retorna el error de requirePermiso sin consultar la base de datos", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequirePermiso.mockResolvedValue({ error: authError, user: null });

      const res = await GET(req());

      expect(res).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe("validación", () => {
    it.each([
      ["granularidad desconocida", "granularidad=diaria"],
      ["periodo con formato inválido", "periodo=octubre"],
      ["semana con formato de mes", "granularidad=semanal&periodo=202610"],
      ["área fuera del catálogo", "area=Otra"],
      ["servicio con inyección", "servicio=11'%20OR%20'1'%3D'1"],
      ["profesional con letras", "profesional=CC1053"],
    ])("rechaza %s con 400 y sin consultar los datos", async (_caso, qs) => {
      const res = await GET(req(qs));

      expect(res.status).toBe(400);
      expect(typeof (await res.json()).error).toBe("string");
      expect(mockQuery.mock.calls.some(([sql]) => sql.includes("v_citas_area"))).toBe(false);
    });
  });

  describe("consultas", () => {
    it("filtra las filas por granularidad y, si se pide, por profesional con parámetros", async () => {
      await GET(req("profesional=1053"));
      const filas = llamada("FROM v_citas_area v WHERE");
      expect(filas.sql).toContain("granularidad = $1");
      expect(filas.sql).toContain("documento = $2");
      expect(filas.params).toEqual(["mensual", "1053"]);
    });

    it("sin profesional no filtra por documento", async () => {
      await GET(req());
      const filas = llamada("FROM v_citas_area v WHERE");
      expect(filas.sql).not.toContain("documento = $");
      expect(filas.params).toEqual(["mensual"]);
    });

    it("los profesionales se consultan para la carga seleccionada", async () => {
      await GET(req("periodo=202609"));
      expect(llamada("v_citas_area_principal").params).toEqual(["mensual", "2026-09-01", "2026-09-30"]);
    });

    it("nunca interpola los valores de los filtros en el SQL", async () => {
      await GET(req("area=Salud%20oral&servicio=152&profesional=1053"));
      for (const [sql] of mockQuery.mock.calls) {
        expect(sql).not.toContain("Salud oral");
        expect(sql).not.toContain("152");
        expect(sql).not.toContain("1053");
      }
    });
  });

  describe("respuesta", () => {
    it("por defecto selecciona la carga mensual más reciente y arma todos los visuales", async () => {
      const res = await GET(req());
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.granularidad).toBe("mensual");
      expect(body.periodo).toBe("202610");
      expect(body.periodos.mensual.map((p: { clave: string }) => p.clave)).toEqual(["202609", "202610"]);
      expect(body.periodos.semanal).toEqual([]);
      expect(body.opciones.areas).toEqual(["Medicina general", "Salud oral"]);
      expect(body.opciones.profesionales).toEqual([{ documento: "1053", nombre: "PROFESIONAL A" }]);
      expect(body.kpis.actual).toMatchObject({ ofertadas: 120, asignadas: 100, inasistidas: 17, perdidas: 37, pct_inasistencia: 0.17 });
      expect(body.kpis.anterior).toMatchObject({ asignadas: 80 });
      expect(body.kpis.serie).toHaveLength(2);
      expect(body.tendencia).toHaveLength(2);
      expect(body.embudo).toEqual({ ofertadas: 120, asignadas: 100, atendidas: 83, disponibles: 20, inasistidas: 17 });
      expect(body.mapa_calor.celdas).toHaveLength(2);
      expect(body.arbol[0]).toMatchObject({ area: "Medicina general", perdidas: 37 });
      expect(body.matriz.total).toMatchObject({ asignadas: 100 });
      expect(body.profesionales).toMatchObject({ con_agenda: 1, destacados: 0 });
    });

    it("sin cargas responde vacío (200) sin consultar profesionales", async () => {
      mockBD({ cargas: [] });
      const res = await GET(req());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.periodo).toBeNull();
      expect(body.embudo).toBeNull();
      expect(mockQuery.mock.calls.some(([sql]) => sql.includes("v_citas_area_principal"))).toBe(false);
    });

    it("usa el caché con una clave por filtros y guarda el resultado", async () => {
      await GET(req("area=Salud%20oral"));
      expect(mockSetCache).toHaveBeenCalledWith(
        expect.stringContaining("productividad:"),
        expect.objectContaining({ periodo: "202610" }),
        expect.any(Number)
      );

      const cacheado = { periodo: "202610", cacheado: true };
      mockGetCached.mockReturnValue(cacheado);
      const res = await GET(req("area=Salud%20oral"));
      expect(await res.json()).toEqual(cacheado);
    });

    it("un error de BD responde 500 sin filtrar el detalle", async () => {
      mockQuery.mockRejectedValue(new Error("relation does not exist"));
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});
      const res = await GET(req());
      spy.mockRestore();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Error al consultar los datos" });
    });
  });
});
