import type { NextRequest } from "next/server";

jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requireAuth: jest.fn() }));
jest.mock("@/lib/cache", () => ({ getCached: jest.fn(() => null), setCache: jest.fn() }));

import { NextResponse } from "next/server";
import { POST } from "@/app/api/cumplimiento/route";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { getCached, setCache } from "@/lib/cache";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockGetCached = getCached as jest.MockedFunction<typeof getCached>;
const mockSetCache = setCache as jest.MockedFunction<typeof setCache>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

function req(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const RANGO = { periodo_desde: 202601, periodo_hasta: 202603 };

/** Filas como las devuelve pg: BIGINT y NUMERIC llegan como texto. */
const FILAS_BD = [
  { documento: "10234567", nombre: "PEREZ JUAN", periodo: 202602, citas: 100, programa: "RCV", categoria: "medicamentos", ordenes: "200" },
  { documento: "10234567", nombre: "PEREZ JUAN", periodo: 202602, citas: 100, programa: "RCV", categoria: "rx", ordenes: "5" },
  { documento: "30345678", nombre: "GOMEZ ANA", periodo: 202602, citas: 50, programa: null, categoria: null, ordenes: null },
];

const METAS_BD = [
  { anio: 2026, programa: "RCV", tipo_prestacion: "medicamentos", valor_meta: "2.000000" },
  { anio: 2026, programa: "RCV", tipo_prestacion: "rx", valor_meta: "10.000000" },
];

function mockBD(opciones: { disponibles?: number[]; filas?: unknown[]; metas?: unknown[] } = {}) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("SELECT DISTINCT periodo FROM citas_atendidas")) {
      return (opciones.disponibles ?? [202601, 202602, 202603]).map((periodo) => ({ periodo })) as never;
    }
    if (sql.includes("FROM metas")) return (opciones.metas ?? METAS_BD) as never;
    return (opciones.filas ?? FILAS_BD) as never;
  });
}

function llamada(fragmento: string) {
  const encontrada = mockQuery.mock.calls.find(([sql]) => sql.includes(fragmento));
  if (!encontrada) throw new Error(`No se ejecutó ninguna consulta con: ${fragmento}`);
  return { sql: encontrada[0].replace(/\s+/g, " "), params: encontrada[1] };
}

const consultaFilas = () => llamada("vm_cumpl_ordenes");
const consultaMetas = () => llamada("FROM metas");

describe("POST /api/cumplimiento", () => {
  const atribucionOriginal = process.env.CUMPLIMIENTO_ATRIBUCION;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CUMPLIMIENTO_ATRIBUCION;
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockGetCached.mockReturnValue(null);
    mockBD();
  });

  afterAll(() => {
    if (atribucionOriginal === undefined) delete process.env.CUMPLIMIENTO_ATRIBUCION;
    else process.env.CUMPLIMIENTO_ATRIBUCION = atribucionOriginal;
  });

  describe("permisos", () => {
    it("permite solo los roles admin y direccion_medica", async () => {
      await POST(req(RANGO));
      expect(mockRequireAuth).toHaveBeenCalledWith(["admin", "direccion_medica"]);
    });

    it("retorna el error de requireAuth sin consultar la base de datos", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequireAuth.mockResolvedValue({ error: authError, user: null });

      const res = await POST(req(RANGO));

      expect(res).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe("validación", () => {
    it("rechaza un cuerpo que no es JSON", async () => {
      const res = await POST({
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      } as unknown as NextRequest);

      expect(res.status).toBe(400);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it.each([
      ["cuerpo que no es un objeto", "texto"],
      ["cuerpo nulo", null],
      ["periodo inicial con formato inválido", { periodo_desde: "2026-01", periodo_hasta: 202603 }],
      ["periodo inicial con mes 13", { periodo_desde: 202613, periodo_hasta: 202703 }],
      ["periodo final con formato inválido", { periodo_desde: 202601, periodo_hasta: "marzo" }],
      ["solo el periodo inicial", { periodo_desde: 202601 }],
      ["solo el periodo final", { periodo_hasta: 202603 }],
      ["periodo inicial posterior al final", { periodo_desde: 202604, periodo_hasta: 202603 }],
      ["rango de 25 meses", { periodo_desde: 202401, periodo_hasta: 202601 }],
      ["programas que no es una lista", { ...RANGO, programas: "RCV" }],
      ["programa desconocido", { ...RANGO, programas: ["RCV", "OTRO"] }],
      ["programa que no es texto", { ...RANGO, programas: [5] }],
      ["documento con letras", { ...RANGO, documento: "12a45" }],
      ["documento con inyección", { ...RANGO, documento: "1 OR 1=1" }],
      ["documento numérico", { ...RANGO, documento: 10234567 }],
      ["documento vacío", { ...RANGO, documento: "" }],
      ["documento demasiado largo", { ...RANGO, documento: "1234567890123456" }],
    ])("rechaza con 400 y no consulta: %s", async (_caso, body) => {
      const res = await POST(req(body));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toEqual(expect.any(String));
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("acepta un rango de exactamente 24 meses", async () => {
      const res = await POST(req({ periodo_desde: 202402, periodo_hasta: 202601 }));
      expect(res.status).toBe(200);
    });

    it("acepta los periodos enviados como texto", async () => {
      const res = await POST(req({ periodo_desde: "202601", periodo_hasta: "202603" }));

      expect(res.status).toBe(200);
      expect(consultaFilas().params).toEqual([202601, 202603]);
    });
  });

  describe("consultas", () => {
    it("consulta las filas con el rango como parámetros y sin interpolar valores", async () => {
      await POST(req(RANGO));

      const { sql, params } = consultaFilas();
      expect(sql).toContain("FROM citas_atendidas c");
      expect(sql).toContain("LEFT JOIN medicos m ON m.identificacion = c.documento");
      expect(sql).toContain("FROM vm_cumpl_ordenes WHERE periodo BETWEEN $1 AND $2 GROUP BY 1, 2, 3");
      expect(sql).toContain("WHERE c.periodo BETWEEN $1 AND $2");
      expect(sql).toContain("COALESCE(c.programa, m.programa_meta)");
      expect(sql).not.toContain("202601");
      expect(sql).not.toContain("202603");
      expect(params).toEqual([202601, 202603]);
    });

    it("por defecto atribuye las órdenes al médico ordenador", async () => {
      await POST(req(RANGO));

      const { sql } = consultaFilas();
      expect(sql).toContain("SELECT categoria, periodo, numero_remite, SUM(ordenes) AS ordenes");
      expect(sql).toContain("ON o.periodo = c.periodo AND o.numero_remite = c.documento");
      expect(sql).not.toContain("o.usuario_txt");
      expect((await (await POST(req(RANGO))).json()).atribucion).toBe("ordenador");
    });

    it("con CUMPLIMIENTO_ATRIBUCION=digitador atribuye las órdenes al usuario que digitó", async () => {
      process.env.CUMPLIMIENTO_ATRIBUCION = "digitador";

      const res = await POST(req(RANGO));

      const { sql, params } = consultaFilas();
      expect(sql).toContain("SELECT categoria, periodo, usuario_txt, SUM(ordenes) AS ordenes");
      expect(sql).toContain("ON o.periodo = c.periodo AND o.usuario_txt = m.usuario_txt");
      expect(sql).not.toContain("numero_remite");
      expect(params).toEqual([202601, 202603]);
      expect((await res.json()).atribucion).toBe("digitador");
    });

    it("filtra por documento con un parámetro, sin convertirlo a número", async () => {
      await POST(req({ ...RANGO, documento: "10234567" }));

      const { sql, params } = consultaFilas();
      expect(sql).toContain("AND c.documento = $3");
      expect(sql).not.toContain("10234567");
      expect(params).toEqual([202601, 202603, "10234567"]);
    });

    it("filtra por programa sobre el programa resuelto, con un parámetro", async () => {
      await POST(req({ ...RANGO, programas: ["RCV", "CPR"] }));

      const { sql, params } = consultaFilas();
      expect(sql).toContain("AND COALESCE(c.programa, m.programa_meta) = ANY($3)");
      expect(sql).not.toContain("RCV");
      expect(params).toEqual([202601, 202603, ["CPR", "RCV"]]);
    });

    it("combina documento y programas con parámetros consecutivos", async () => {
      await POST(req({ ...RANGO, documento: "10234567", programas: ["RCV"] }));

      const { sql, params } = consultaFilas();
      expect(sql).toContain("AND c.documento = $3");
      expect(sql).toContain("= ANY($4)");
      expect(params).toEqual([202601, 202603, "10234567", ["RCV"]]);
    });

    it("una lista de programas vacía equivale a no filtrar", async () => {
      await POST(req({ ...RANGO, programas: [] }));

      const { sql, params } = consultaFilas();
      expect(sql).not.toContain("ANY(");
      expect(params).toEqual([202601, 202603]);
    });

    it("consulta las metas activas de los años que cubre el rango", async () => {
      await POST(req({ periodo_desde: 202511, periodo_hasta: 202602 }));

      const { sql, params } = consultaMetas();
      expect(sql).toContain("activo = TRUE");
      expect(sql).toContain("anio BETWEEN $1 AND $2");
      expect(params).toEqual([2025, 2026]);
    });

    it("consulta los periodos que tienen citas", async () => {
      await POST(req(RANGO));
      expect(llamada("SELECT DISTINCT periodo FROM citas_atendidas").sql).toContain("ORDER BY 1");
    });
  });

  describe("respuesta", () => {
    it("convierte a número los valores que pg entrega como texto y conserva el documento como texto", async () => {
      const res = await POST(req(RANGO));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.periodos_disponibles).toEqual([202601, 202602, 202603]);
      expect(body.periodos).toEqual([202601, 202602, 202603]);
      expect(body.periodo_desde).toBe(202601);
      expect(body.periodo_hasta).toBe(202603);

      expect(body.filas).toHaveLength(2);
      const perez = body.filas.find((f: { documento: string }) => f.documento === "10234567");
      expect(perez.documento).toBe("10234567");
      expect(perez.citas).toBe(100);
      expect(perez.categorias.medicamentos).toEqual({ ordenes: 200, tasa: 2, meta: 2, pct: 1 });
      expect(perez.categorias.rx).toEqual({ ordenes: 5, tasa: 5, meta: 10, pct: 0.5 });
      expect(perez.categorias.laboratorios).toEqual({ ordenes: 0, tasa: 0, meta: null, pct: null });
      expect(perez.global).toBe(0.75);
    });

    it("entrega profesionales, serie mensual y resumen calculados", async () => {
      const body = await (await POST(req(RANGO))).json();

      expect(body.profesionales.map((p: { nombre: string }) => p.nombre)).toEqual(["GOMEZ ANA", "PEREZ JUAN"]);
      expect(body.profesionales[0]).toMatchObject({ documento: "30345678", programa: null, citas: 50, global: null });
      expect(body.profesionales[1]).toMatchObject({ programa: "RCV", citas: 100, periodosConDatos: 1, global: 0.75 });
      expect(body.serieMensual).toEqual([
        expect.objectContaining({ periodo: 202602, profesionalesConDatos: 1, global: 0.75 }),
      ]);
      expect(body.resumen.global).toBe(0.75);
      expect(body.resumen.pct.medicamentos).toBe(1);
    });

    it("limita `periodos` a los disponibles dentro del rango", async () => {
      mockBD({ disponibles: [202511, 202601, 202603, 202605] });

      const body = await (await POST(req(RANGO))).json();

      expect(body.periodos_disponibles).toEqual([202511, 202601, 202603, 202605]);
      expect(body.periodos).toEqual([202601, 202603]);
    });

    it("responde 500 con un mensaje genérico si la consulta falla", async () => {
      mockQuery.mockRejectedValue(new Error("relation does not exist"));
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await POST(req(RANGO));

      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe("Error al consultar los datos");
      errorSpy.mockRestore();
    });

    it("responde 503 reintentable mientras las vistas se actualizan", async () => {
      mockQuery.mockRejectedValue(new Error("canceling statement due to statement timeout"));
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await POST(req(RANGO));

      expect(res.status).toBe(503);
      expect((await res.json()).retryable).toBe(true);
      errorSpy.mockRestore();
    });
  });

  describe("rango por defecto", () => {
    it("sin periodos usa los últimos 6 periodos con citas", async () => {
      mockBD({ disponibles: [202508, 202509, 202510, 202511, 202512, 202601, 202602, 202603] });

      const res = await POST(req({}));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.periodo_desde).toBe(202510);
      expect(body.periodo_hasta).toBe(202603);
      expect(consultaFilas().params).toEqual([202510, 202603]);
    });

    it("con menos de 6 periodos usa todos", async () => {
      mockBD({ disponibles: [202602, 202603] });

      const body = await (await POST(req({}))).json();

      expect(body.periodo_desde).toBe(202602);
      expect(body.periodo_hasta).toBe(202603);
    });

    it("no supera los 24 meses aunque los periodos con citas estén muy separados", async () => {
      mockBD({ disponibles: [202001, 202101, 202201, 202301, 202401, 202603] });

      const body = await (await POST(req({}))).json();

      expect(body.periodo_hasta).toBe(202603);
      expect(body.periodo_desde).toBe(202404);
    });

    it("sin citas cargadas responde vacío sin consultar filas ni metas", async () => {
      mockBD({ disponibles: [] });

      const res = await POST(req({}));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toMatchObject({
        atribucion: "ordenador",
        periodos_disponibles: [],
        periodo_desde: null,
        periodo_hasta: null,
        periodos: [],
        filas: [],
        profesionales: [],
        serieMensual: [],
      });
      expect(body.resumen.global).toBeNull();
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe("caché", () => {
    it("guarda el resultado con un TTL de 60 segundos", async () => {
      await POST(req(RANGO));

      expect(mockSetCache).toHaveBeenCalledTimes(1);
      const [clave, datos, ttl] = mockSetCache.mock.calls[0];
      expect(clave).toContain("cumplimiento");
      expect(datos).toMatchObject({ atribucion: "ordenador" });
      expect(ttl).toBe(60_000);
    });

    it("la clave depende del cuerpo y del criterio de atribución", async () => {
      await POST(req(RANGO));
      await POST(req({ ...RANGO, programas: ["RCV"] }));
      await POST(req({ ...RANGO, documento: "10234567" }));
      process.env.CUMPLIMIENTO_ATRIBUCION = "digitador";
      await POST(req(RANGO));

      const claves = mockSetCache.mock.calls.map(([clave]) => clave);
      expect(new Set(claves).size).toBe(4);
    });

    it("la clave no depende del orden de los programas", async () => {
      await POST(req({ ...RANGO, programas: ["RCV", "CPR"] }));
      await POST(req({ ...RANGO, programas: ["CPR", "RCV"] }));

      const [a, b] = mockSetCache.mock.calls.map(([clave]) => clave);
      expect(a).toBe(b);
    });

    it("responde desde el caché sin consultar la base de datos", async () => {
      const guardado = { atribucion: "ordenador", filas: [] };
      mockGetCached.mockReturnValue(guardado);

      const res = await POST(req(RANGO));

      expect(await res.json()).toEqual(guardado);
      expect(mockQuery).not.toHaveBeenCalled();
      expect(mockSetCache).not.toHaveBeenCalled();
    });

    it("no guarda en caché una respuesta de error", async () => {
      mockQuery.mockRejectedValue(new Error("fallo"));
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await POST(req(RANGO));

      expect(mockSetCache).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
