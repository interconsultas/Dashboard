jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requirePermiso: jest.fn() }));
jest.mock("@/lib/cache", () => ({ getCached: jest.fn(() => null), setCache: jest.fn() }));

import { NextResponse } from "next/server";
import { GET } from "@/app/api/inteligencia/alertas/route";
import { GET as GET_CONTEO } from "@/app/api/inteligencia/alertas/conteo/route";
import { query } from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";
import { getCached, setCache } from "@/lib/cache";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequirePermiso = requirePermiso as jest.MockedFunction<typeof requirePermiso>;
const mockGetCached = getCached as jest.MockedFunction<typeof getCached>;
const mockSetCache = setCache as jest.MockedFunction<typeof setCache>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

const plano = (sql: string) => sql.replace(/\s+/g, " ");

function req(qs = "", ruta = "/api/inteligencia/alertas"): Request {
  return { url: `http://localhost${ruta}${qs ? `?${qs}` : ""}` } as Request;
}

const CARGAS = [
  { granularidad: "mensual", periodo: 202608, fecha_inicial: "2026-08-01", fecha_final: "2026-08-31" },
  { granularidad: "mensual", periodo: "202609", fecha_inicial: "2026-09-01", fecha_final: "2026-09-30" },
  { granularidad: "mensual", periodo: 202610, fecha_inicial: "2026-10-01", fecha_final: "2026-10-31" },
  { granularidad: "semanal", periodo: 202611, fecha_inicial: "2026-11-09", fecha_final: "2026-11-15" },
];

const REGLAS = [
  { clave: "inasistencia_servicio", nombre: "A", descripcion: "a", activa: true, umbral: "0.2000", periodos: 2, minimo: 30, gravedad: "alta", actualizado_en: "2026-11-18", actualizado_por: null },
  { clave: "disponibilidad_servicio", nombre: "B", descripcion: "b", activa: true, umbral: "0.1500", periodos: null, minimo: 30, gravedad: "media", actualizado_en: "2026-11-18", actualizado_por: null },
  { clave: "inasistencia_profesional", nombre: "C", descripcion: "c", activa: true, umbral: "0.3000", periodos: null, minimo: 50, gravedad: "media", actualizado_en: "2026-11-18", actualizado_por: null },
  { clave: "proyeccion_sobre_meta", nombre: "D", descripcion: "d", activa: true, umbral: null, periodos: null, minimo: null, gravedad: "alta", actualizado_en: "2026-11-18", actualizado_por: null },
];

/** pg entrega SUM::int como número, pero se normaliza igual (texto en BIGINT). */
const SERVICIOS = [
  { fecha_inicial: "2026-08-01", area: "Psicosocial", codigo_servicio: "890", nombre_servicio: "PSICOLOGIA", asignadas: "100", inasistidas: "10", ofertadas: "100", disponibles: "0" },
  { fecha_inicial: "2026-09-01", area: "Psicosocial", codigo_servicio: "890", nombre_servicio: "PSICOLOGIA", asignadas: 100, inasistidas: 30, ofertadas: 100, disponibles: 0 },
  { fecha_inicial: "2026-10-01", area: "Psicosocial", codigo_servicio: "890", nombre_servicio: "PSICOLOGIA", asignadas: 100, inasistidas: 35, ofertadas: 120, disponibles: 20 },
];

const PROFESIONALES = [{ documento: "1053", nombre: "PROFESIONAL A", area_principal: "Psicosocial", asignadas: "60", inasistidas: "30" }];

function mockBD(opciones: { cargas?: unknown[] } = {}) {
  mockQuery.mockImplementation((async (sql: string) => {
    const s = plano(sql);
    if (s.includes("SELECT DISTINCT granularidad")) return opciones.cargas ?? CARGAS;
    if (s.includes("FROM areas_servicio")) return [{ nombre: "Psicosocial" }, { nombre: "Salud oral" }];
    if (s.includes("FROM reglas_alerta")) return REGLAS;
    if (s.includes("v_citas_area_principal")) return PROFESIONALES;
    if (s.includes("FROM v_citas_area")) return SERVICIOS;
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

describe("GET /api/inteligencia/alertas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePermiso.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockGetCached.mockReturnValue(null);
    mockBD();
  });

  it("pide ver Inteligencia", async () => {
    await GET(req());
    expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["inteligencia"], nivel: "ver" });
  });

  it("sin permiso devuelve el error y no consulta", async () => {
    mockRequirePermiso.mockResolvedValue({ error: NextResponse.json({ error: "Prohibido" }, { status: 403 }), user: null });
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it.each([["granularidad=diaria"], ["granularidad=mensual&granularidad=semanal"]])("parámetro no válido %s → 400", async (qs) => {
    const { status } = await json(await GET(req(qs)));
    expect(status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("evalúa las reglas sobre la serie de la granularidad y el último periodo", async () => {
    const { status, body } = await json(await GET(req()));
    expect(status).toBe(200);
    expect(body.granularidad).toBe("mensual");
    expect(body.periodo.clave).toBe("202610");
    expect(body.siguiente.etiqueta_larga).toBe("Noviembre 2026");
    expect(body.periodos_cargados).toBe(3);
    expect(body.meta).toBe(0.1);
    expect(body.reglas.map((r: { clave: string }) => r.clave)).toEqual([
      "inasistencia_servicio",
      "disponibilidad_servicio",
      "inasistencia_profesional",
      "proyeccion_sobre_meta",
    ]);
    expect(body.reglas[0].umbral).toBe(0.2);
    expect(body.conteo).toEqual({ inasistencia_servicio: 1, disponibilidad_servicio: 1, inasistencia_profesional: 1, proyeccion_sobre_meta: 1 });
    expect(body.alertas[0].gravedad).toBe("alta");
    expect(body.alertas.map((a: { mensaje: string }) => a.mensaje)).toContain(
      "Psicosocial — PSICOLOGIA: inasistencia 30,0 % y 35,0 % en los dos últimos meses (umbral 20 %)"
    );
    const psico = body.proyeccion.areas.find((a: { id: string }) => a.id === "Psicosocial");
    expect(psico.inasistencia.direccion).toBe("sube");
    expect(body.proyeccion.servicios.map((s: { id: string }) => s.id)).toEqual(["890"]);
  });

  it("consulta con parámetros: la serie por granularidad y los profesionales del último periodo", async () => {
    await GET(req("granularidad=mensual"));
    expect(llamada("FROM v_citas_area v WHERE v.granularidad = $1 GROUP BY").params).toEqual(["mensual"]);
    expect(llamada("v_citas_area_principal").params).toEqual(["mensual", "2026-10-01", "2026-10-31"]);
  });

  it("semanal con una sola semana: sin proyección ni racha", async () => {
    mockBD();
    const { body } = await json(await GET(req("granularidad=semanal")));
    expect(body.periodo.clave).toBe("2026-11-09");
    expect(body.periodos_cargados).toBe(1);
    expect(body.proyeccion.areas.every((a: { inasistencia: unknown }) => a.inasistencia === null)).toBe(true);
  });

  it("sin cargas responde vacío sin consultar la serie", async () => {
    mockBD({ cargas: [] });
    const { status, body } = await json(await GET(req()));
    expect(status).toBe(200);
    expect(body.periodo).toBeNull();
    expect(body.alertas).toEqual([]);
    expect(mockQuery.mock.calls.some(([sql]) => plano(sql).includes("FROM v_citas_area"))).toBe(false);
  });

  it("guarda el resultado 5 minutos por granularidad y lo reutiliza", async () => {
    await GET(req("granularidad=semanal"));
    expect(mockSetCache).toHaveBeenCalledWith("inteligencia:alertas:semanal", expect.objectContaining({ alertas: expect.any(Array) }), 300_000);
    const guardado = mockSetCache.mock.calls[0][1];
    jest.clearAllMocks();
    mockRequirePermiso.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockGetCached.mockReturnValue(guardado);
    const { body } = await json(await GET(req("granularidad=semanal")));
    expect(body.periodo.clave).toBe("2026-11-09");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("error de BD → 500 sin detalles", async () => {
    mockQuery.mockRejectedValue(new Error("connection refused"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await json(await GET(req()));
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Error al consultar los datos" });
    spy.mockRestore();
  });
});

describe("GET /api/inteligencia/alertas/conteo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePermiso.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockGetCached.mockReturnValue(null);
    mockBD();
  });

  it("pide ver Inteligencia y devuelve solo el total mensual", async () => {
    const { status, body } = await json(await GET_CONTEO());
    expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["inteligencia"], nivel: "ver" });
    expect(status).toBe(200);
    expect(body).toEqual({ total: 4, granularidad: "mensual", periodo: "202610" });
  });

  it("sin permiso → error de requirePermiso", async () => {
    mockRequirePermiso.mockResolvedValue({ error: NextResponse.json({ error: "No autenticado" }, { status: 401 }), user: null });
    expect((await GET_CONTEO()).status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
