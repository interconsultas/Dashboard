jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requireAuth: jest.fn() }));
jest.mock("@/lib/cache", () => ({ getCached: jest.fn(() => null), setCache: jest.fn() }));

import { NextResponse } from "next/server";
import { GET } from "@/app/api/productividad/profesional/route";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { getCached, setCache } from "@/lib/cache";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockGetCached = getCached as jest.MockedFunction<typeof getCached>;
const mockSetCache = setCache as jest.MockedFunction<typeof setCache>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

function req(qs = ""): Request {
  return { url: `http://localhost/api/productividad/profesional${qs ? `?${qs}` : ""}` } as Request;
}

const plano = (sql: string) => sql.replace(/\s+/g, " ");

const CARGAS = [
  { granularidad: "mensual", periodo: 202609, fecha_inicial: "2026-09-01", fecha_final: "2026-09-30" },
  { granularidad: "mensual", periodo: 202610, fecha_inicial: "2026-10-01", fecha_final: "2026-10-31" },
];

const METRICAS = {
  creadas: 0, bloqueadas: 0, confirmadas: 0, confirmadas_sin_atencion: 0, canceladas: 0, pendientes_por_asistir: 0,
};
/** Filas del profesional por carga × servicio (con BIGINT como texto). */
const FILAS = [
  { fecha_inicial: "2026-09-01", codigo_servicio: "11", nombre_servicio: "CONSULTA", area: "Medicina general", nombre: "PROFESIONAL A", ...METRICAS, ofertadas: 100, asignadas: 80, inasistidas: 8, disponibles: 20 },
  { fecha_inicial: "2026-10-01", codigo_servicio: "11", nombre_servicio: "CONSULTA", area: "Medicina general", nombre: "PROFESIONAL A", ...METRICAS, ofertadas: "120", asignadas: "100", inasistidas: "10", disponibles: "20" },
];
const PARES = [
  { documento: "1053", nombre: "PROFESIONAL A", codigo_servicio: "11", area: "Medicina general", area_principal: "Medicina general", ...METRICAS, ofertadas: 120, asignadas: 100, inasistidas: 10, disponibles: 20 },
  { documento: "2077", nombre: "PROFESIONAL B", codigo_servicio: "11", area: "Medicina general", area_principal: "Medicina general", ...METRICAS, ofertadas: 100, asignadas: "100", inasistidas: "30", disponibles: 0 },
];

function mockBD(opciones: { filas?: unknown[] } = {}) {
  mockQuery.mockImplementation((async (sql: string) => {
    const s = plano(sql);
    if (s.includes("FROM areas_servicio ORDER BY")) return [{ nombre: "Medicina general" }, { nombre: "Salud oral" }];
    if (s.includes("SELECT DISTINCT granularidad")) return CARGAS;
    if (s.includes("v_citas_area_principal")) return PARES;
    if (s.includes("FROM v_citas_area")) return opciones.filas ?? FILAS;
    return [];
  }) as never);
}

function llamada(fragmento: string) {
  const c = mockQuery.mock.calls.find(([sql]) => plano(sql).includes(fragmento));
  if (!c) throw new Error(`No se ejecutó ninguna consulta con: ${fragmento}`);
  return { sql: plano(c[0]), params: c[1] as unknown[] };
}

describe("GET /api/productividad/profesional", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockGetCached.mockReturnValue(null);
    mockBD();
  });

  describe("permisos", () => {
    it("permite los roles admin y direccion_medica", async () => {
      await GET(req("documento=1053"));
      expect(mockRequireAuth).toHaveBeenCalledWith(["admin", "direccion_medica"]);
    });

    it("retorna el error de requireAuth sin consultar la base de datos", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequireAuth.mockResolvedValue({ error: authError, user: null });
      const res = await GET(req("documento=1053"));
      expect(res).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe("validación", () => {
    it.each([
      ["sin documento", ""],
      ["documento con letras", "documento=CC1053"],
      ["documento repetido", "documento=1053&documento=2077"],
      ["periodo con formato inválido", "documento=1053&periodo=octubre"],
      ["área fuera del catálogo", "documento=1053&area=Otra"],
      ["servicio con inyección", "documento=1053&servicio=11'%20OR%20'1'%3D'1"],
    ])("rechaza %s con 400 y sin consultar los datos", async (_caso, qs) => {
      const res = await GET(req(qs));
      expect(res.status).toBe(400);
      expect(typeof (await res.json()).error).toBe("string");
      expect(mockQuery.mock.calls.some(([sql]) => sql.includes("v_citas_area"))).toBe(false);
    });
  });

  describe("consultas", () => {
    it("filas del profesional por granularidad y documento, con parámetros", async () => {
      await GET(req("documento=1053&granularidad=mensual"));
      const filas = llamada("FROM v_citas_area v WHERE");
      expect(filas.sql).toContain("v.granularidad = $1");
      expect(filas.sql).toContain("v.documento = $2");
      expect(filas.params).toEqual(["mensual", "1053"]);
    });

    it("los pares se consultan para la carga seleccionada", async () => {
      await GET(req("documento=1053&periodo=202609"));
      expect(llamada("v_citas_area_principal").params).toEqual(["mensual", "2026-09-01", "2026-09-30"]);
    });

    it("nunca interpola los valores en el SQL", async () => {
      await GET(req("documento=1053&area=Salud%20oral&servicio=152"));
      for (const [sql] of mockQuery.mock.calls) {
        expect(sql).not.toContain("1053");
        expect(sql).not.toContain("Salud oral");
        expect(sql).not.toContain("152");
      }
    });
  });

  describe("respuesta", () => {
    it("arma la ficha del periodo más reciente con números normalizados", async () => {
      const res = await GET(req("documento=1053"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        documento: "1053",
        nombre: "PROFESIONAL A",
        area_principal: "Medicina general",
        periodo: "202610",
        etiqueta_periodo: "Octubre 2026",
        percentil: 50,
        pares: 2,
      });
      expect(body.actual).toMatchObject({ asignadas: 100, inasistidas: 10, pct_inasistencia: 0.1 });
      expect(body.institucion.pct_inasistencia).toBeCloseTo(0.2);
      expect(body.servicios).toHaveLength(1);
      expect(body.tendencia.map((p: { clave: string }) => p.clave)).toEqual(["202609", "202610"]);
    });

    it("404 si el profesional no tiene agenda en la granularidad", async () => {
      mockBD({ filas: [] });
      const res = await GET(req("documento=999"));
      expect(res.status).toBe(404);
      expect(typeof (await res.json()).error).toBe("string");
    });

    it("usa el caché con una clave por documento y filtros", async () => {
      await GET(req("documento=1053&area=Salud%20oral"));
      expect(mockSetCache).toHaveBeenCalledWith(
        expect.stringContaining("productividad-ficha:1053:"),
        expect.objectContaining({ documento: "1053" }),
        expect.any(Number)
      );
      const cacheado = { documento: "1053", cacheado: true };
      mockGetCached.mockReturnValue(cacheado);
      const res = await GET(req("documento=1053&area=Salud%20oral"));
      expect(await res.json()).toEqual(cacheado);
    });

    it("un error de BD responde 500 sin filtrar el detalle", async () => {
      mockQuery.mockRejectedValue(new Error("relation does not exist"));
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});
      const res = await GET(req("documento=1053"));
      spy.mockRestore();
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Error al consultar los datos" });
    });
  });
});
