jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requirePermiso: jest.fn() }));
jest.mock("@/lib/cache", () => ({ getCached: jest.fn(() => null), setCache: jest.fn() }));

import { NextResponse } from "next/server";
import { GET } from "@/app/api/inteligencia/grafo/route";
import { query } from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";
import { getCached, setCache } from "@/lib/cache";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequirePermiso = requirePermiso as jest.MockedFunction<typeof requirePermiso>;
const mockGetCached = getCached as jest.MockedFunction<typeof getCached>;
const mockSetCache = setCache as jest.MockedFunction<typeof setCache>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

function req(qs = ""): Request {
  return { url: `http://localhost/api/inteligencia/grafo${qs ? `?${qs}` : ""}` } as Request;
}

const plano = (sql: string) => sql.replace(/\s+/g, " ");

const CARGAS = [
  { granularidad: "mensual", periodo: 202609, fecha_inicial: "2026-09-01", fecha_final: "2026-09-30" },
  { granularidad: "mensual", periodo: "202610", fecha_inicial: "2026-10-01", fecha_final: "2026-10-31" },
  { granularidad: "semanal", periodo: 202611, fecha_inicial: "2026-11-09", fecha_final: "2026-11-15" },
];

/** pg entrega BIGINT y NUMERIC como texto: la ruta los convierte. */
const ATIENDE = [
  { documento: "1053", nombre: "PROFESIONAL A", codigo_servicio: "11", nombre_servicio: "CONSULTA", area: "Medicina general", asignadas: 100, inasistidas: 17, disponibles: 20 },
  { documento: "2000", nombre: "PROFESIONAL B", codigo_servicio: "11", nombre_servicio: "CONSULTA", area: "Medicina general", asignadas: 30, inasistidas: 3, disponibles: 0 },
];

function mockBD(opciones: { cargas?: unknown[] } = {}) {
  mockQuery.mockImplementation((async (sql: string) => {
    const s = plano(sql);
    if (s.includes("SELECT DISTINCT granularidad")) return opciones.cargas ?? CARGAS;
    if (s.includes("FROM areas_servicio")) return [{ nombre: "Medicina general" }, { nombre: "Salud oral" }];
    if (s.includes("FROM vm_cumpl_ordenes")) return [{ documento: "1053", categoria: "rx", ordenes: "7", cantidad: "9" }];
    if (s.includes("FROM v_citas_area")) return ATIENDE;
    if (s.includes("FROM medicos")) return [{ documento: "1053", especialidad: "MÉDICO GENERAL INTEGRADOR" }];
    if (s.includes("FROM programa_meta_mapeo")) return [{ especialidad: "MÉDICO GENERAL INTEGRADOR", programa: "PROGRAMADA" }];
    if (s.includes("FROM metas")) return [{ programa: "PROGRAMADA", categoria: "rx", valor_meta: "4.302063", escala: "x100" }];
    if (s.includes("FROM vm_dash_rx")) return [{ categoria: "rx", regional: "CENTRO", ordenes: "40", cantidad: "41" }];
    return [];
  }) as never);
}

function llamada(fragmento: string) {
  const c = mockQuery.mock.calls.find(([sql]) => plano(sql).includes(fragmento));
  if (!c) throw new Error(`No se ejecutó ninguna consulta con: ${fragmento}`);
  return { sql: plano(c[0]), params: c[1] as unknown[] };
}

async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

describe("GET /api/inteligencia/grafo", () => {
  const ENV = process.env.CUMPLIMIENTO_ATRIBUCION;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CUMPLIMIENTO_ATRIBUCION;
    mockRequirePermiso.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockGetCached.mockReturnValue(null);
    mockBD();
  });

  afterAll(() => {
    if (ENV === undefined) delete process.env.CUMPLIMIENTO_ATRIBUCION;
    else process.env.CUMPLIMIENTO_ATRIBUCION = ENV;
  });

  describe("permisos y validación", () => {
    it("pide ver Inteligencia", async () => {
      await GET(req());
      expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["inteligencia"], nivel: "ver" });
    });

    it("sin permiso devuelve el error de requirePermiso y no consulta", async () => {
      mockRequirePermiso.mockResolvedValue({ error: NextResponse.json({ error: "Prohibido" }, { status: 403 }), user: null });
      const res = await GET(req());
      expect(res.status).toBe(403);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("parámetros no válidos → 400 sin consultar", async () => {
      const { status, body } = await json(await GET(req("modo=vecindario&tipo=profesional&id=abc")));
      expect(status).toBe(400);
      expect(body.error).toBe("El identificador no es válido para el tipo");
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe("esquema", () => {
    it("devuelve la ontología con conteos y el contexto del periodo más reciente", async () => {
      const { status, body } = await json(await GET(req()));
      expect(status).toBe(200);
      expect(body.modo).toBe("esquema");
      expect(body.periodo.clave).toBe("202610");
      expect(body.periodos.mensual.map((p: { clave: string }) => p.clave)).toEqual(["202609", "202610"]);
      expect(body.periodos.semanal.map((p: { clave: string }) => p.clave)).toEqual(["2026-11-09"]);
      expect(body.periodo_autorizaciones).toBe(202610);
      expect(body.atribucion).toBe("nombre");
      const cantidades = Object.fromEntries(body.esquema.tipos.map((t: { clave: string; cantidad: number }) => [t.clave, t.cantidad]));
      expect(cantidades).toEqual({ area: 2, servicio: 1, profesional: 2, especialidad: 1, programa: 1, categoria: 7, regional: 1 });
      expect(body.esquema.relaciones).toHaveLength(7);
    });

    it("consulta la carga, el mes de autorizaciones y el año de las metas con parámetros", async () => {
      await GET(req("periodo=202609"));
      expect(llamada("FROM v_citas_area v").params).toEqual(["mensual", "2026-09-01", "2026-09-30"]);
      expect(llamada("FROM vm_cumpl_ordenes").params).toEqual([202609, "mensual", "2026-09-01", "2026-09-30"]);
      expect(llamada("FROM metas").params).toEqual([2026, "TOTAL MGI"]);
      expect(llamada("FROM vm_dash_rx").params).toEqual([202609]);
    });

    it("una semana usa las autorizaciones de su mes", async () => {
      const { body } = await json(await GET(req("granularidad=semanal")));
      expect(body.periodo.clave).toBe("2026-11-09");
      expect(body.periodo_autorizaciones).toBe(202611);
      expect(llamada("FROM vm_cumpl_ordenes").params[0]).toBe(202611);
    });

    it("atribuye las órdenes con el criterio de Cumplimiento", async () => {
      await GET(req());
      expect(llamada("FROM vm_cumpl_ordenes").sql).toContain("UPPER(TRIM(o.nombre_medico)) = UPPER(TRIM(COALESCE(m.nombre, c.nombre_medico)))");

      jest.clearAllMocks();
      mockBD();
      process.env.CUMPLIMIENTO_ATRIBUCION = "ordenador";
      await GET(req());
      const { sql } = llamada("FROM vm_cumpl_ordenes");
      expect(sql).toContain("SELECT categoria, numero_remite, SUM(ordenes)");
      expect(sql).toContain("o.numero_remite = c.documento");
    });

    it("sin cargas de citas responde con periodo nulo y sin consultar el grafo", async () => {
      mockBD({ cargas: [] });
      const { status, body } = await json(await GET(req()));
      expect(status).toBe(200);
      expect(body.periodo).toBeNull();
      expect(body.periodo_autorizaciones).toBeNull();
      expect(mockQuery.mock.calls.some(([sql]) => plano(sql).includes("FROM v_citas_area"))).toBe(false);
    });
  });

  describe("vecindario", () => {
    it("devuelve el nodo, sus vecinos y aristas con métricas numéricas", async () => {
      const { status, body } = await json(await GET(req("modo=vecindario&tipo=profesional&id=1053")));
      expect(status).toBe(200);
      expect(body.vecindario.centro.id).toBe("profesional:1053");
      expect(body.vecindario.nodos.map((n: { id: string }) => n.id)).toEqual(
        expect.arrayContaining(["servicio:11", "especialidad:MÉDICO GENERAL INTEGRADOR", "categoria:rx"]),
      );
      const ordena = body.vecindario.aristas.find((a: { relacion: string }) => a.relacion === "ordena");
      expect(ordena.metricas).toEqual({ ordenes: 7, cantidad: 9 });
    });

    it("respeta el límite y cuenta los vecinos ocultos", async () => {
      const { body } = await json(await GET(req("modo=vecindario&tipo=servicio&id=11&limite=1")));
      expect(body.vecindario.mas).toEqual([{ relacion: "atiende", tipo: "profesional", mostrados: 1, total: 2 }]);
    });

    it("un nodo que no existe en el periodo → 404", async () => {
      const { status, body } = await json(await GET(req("modo=vecindario&tipo=profesional&id=999")));
      expect(status).toBe(404);
      expect(body.error).toBe("El elemento no existe en el periodo");
    });
  });

  describe("buscar", () => {
    it("busca en todos los tipos", async () => {
      const { body } = await json(await GET(req("modo=buscar&q=consulta")));
      expect(body.modo).toBe("buscar");
      expect(body.resultados.map((r: { id: string }) => r.id)).toEqual(["servicio:11"]);
    });

    it("lista las instancias de un tipo", async () => {
      const { body } = await json(await GET(req("modo=buscar&tipo=profesional")));
      expect(body.resultados.map((r: { id: string }) => r.id)).toEqual(["profesional:1053", "profesional:2000"]);
    });
  });

  describe("caché", () => {
    it("guarda el grafo del periodo por 5 minutos con clave por atribución y carga", async () => {
      await GET(req());
      expect(mockSetCache).toHaveBeenCalledWith(
        "inteligencia:grafo:nombre:mensual:2026-10-01:2026-10-31",
        expect.objectContaining({ nodos: expect.any(Map) }),
        300_000,
      );
    });

    it("con el grafo en caché solo consulta las cargas", async () => {
      await GET(req());
      const grafo = mockSetCache.mock.calls[0][1];
      jest.clearAllMocks();
      mockBD();
      mockGetCached.mockReturnValue(grafo);
      const { status, body } = await json(await GET(req("modo=buscar&q=consulta")));
      expect(status).toBe(200);
      expect(body.resultados).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  it("error de BD → 500 sin detalles", async () => {
    mockQuery.mockRejectedValue(new Error("connection refused"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await json(await GET(req()));
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Error al consultar los datos" });
    spy.mockRestore();
  });

  it("vista materializada en actualización → 503 reintentable", async () => {
    mockQuery.mockRejectedValue(new Error("could not obtain lock on materialized view"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("5");
    spy.mockRestore();
  });
});
