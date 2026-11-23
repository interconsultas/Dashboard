jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { connect: jest.fn() },
  query: jest.fn(),
}));
jest.mock("@/lib/middleware-roles", () => ({ requirePermiso: jest.fn() }));

import { NextResponse } from "next/server";
import { GET } from "@/app/api/admin/citas/detalle/route";
import { query } from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequirePermiso = requirePermiso as jest.MockedFunction<typeof requirePermiso>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

function reqGet(qs = "") {
  return new Request(`http://localhost/api/admin/citas/detalle${qs}`);
}

function metricas(base: number) {
  return {
    creadas: base,
    bloqueadas: base + 1,
    ofertadas: base + 2,
    disponibles: base + 3,
    asignadas: base + 4,
    confirmadas: base + 5,
    confirmadas_sin_atencion: base + 6,
    inasistidas: base + 7,
    canceladas: base + 8,
    pendientes_por_asistir: base + 9,
  };
}

// Filas por profesional × servicio, como las devuelve la consulta agregada
const FILAS_SERVICIO = [
  {
    tipo_documento: "CC", documento: "10234567", nombre: "PEREZ JUAN",
    codigo_servicio: "890201", nombre_servicio: "CONSULTA GENERAL", ...metricas(10),
  },
  {
    tipo_documento: "CC", documento: "10234567", nombre: "PEREZ JUAN",
    codigo_servicio: "890301", nombre_servicio: "CONTROL", ...metricas(100),
  },
  {
    tipo_documento: "CC", documento: "30345678", nombre: "GOMEZ ANA",
    codigo_servicio: "890201", nombre_servicio: "CONSULTA GENERAL", ...metricas(1),
  },
];

function mockConsultas(filas: unknown[] = FILAS_SERVICIO, periodos = [{ periodo: 202610 }, { periodo: 202609 }]) {
  mockQuery.mockImplementation((async (sql: string) =>
    sql.includes("DISTINCT periodo") ? periodos : filas) as never);
}

describe("GET /api/admin/citas/detalle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePermiso.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockConsultas();
  });

  it("pide ver Citas o Cumplimiento", async () => {
    await GET(reqGet("?periodo=202610"));
    expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["citas", "cumplimiento"], nivel: "ver" });
  });

  it("retorna el error de requirePermiso sin consultar la base de datos", async () => {
    const authError = NextResponse.json({ error: "No autenticado" }, { status: 401 });
    mockRequirePermiso.mockResolvedValue({ error: authError, user: null });

    const res = await GET(reqGet("?periodo=202610"));

    expect(res).toBe(authError);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it.each(["", "?periodo=", "?periodo=20261", "?periodo=202613", "?periodo=202600", "?periodo=abcdef", "?periodo=2026101", "?periodo=202610;DROP"])(
    "rechaza con 400 el periodo no válido %p",
    async (qs) => {
      const res = await GET(reqGet(qs));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toEqual(expect.any(String));
      expect(mockQuery).not.toHaveBeenCalled();
    }
  );

  it("consulta solo las cargas mensuales del periodo con parámetros", async () => {
    await GET(reqGet("?periodo=202610"));

    const detalle = mockQuery.mock.calls.find(([sql]) => !sql.includes("DISTINCT periodo"));
    expect(detalle).toBeDefined();
    const [sql, params] = detalle!;
    expect(sql).toContain("FROM citas_profesional_servicio");
    expect(sql).toContain("granularidad = 'mensual'");
    expect(sql).toContain("periodo = $1");
    expect(sql).toContain("LEFT JOIN servicios_citas");
    expect(sql).toContain("GROUP BY");
    expect(sql).not.toContain("202610");
    expect(params).toEqual([202610]);

    const periodos = mockQuery.mock.calls.find(([sql]) => sql.includes("DISTINCT periodo"));
    expect(periodos![0]).toContain("granularidad = 'mensual'");
  });

  it("agrupa por profesional con sumas, número de servicios y desglose por servicio", async () => {
    const res = await GET(reqGet("?periodo=202610"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.periodo).toBe(202610);
    expect(body.profesionales).toHaveLength(2);

    const perez = body.profesionales.find((p: { documento: string }) => p.documento === "10234567");
    expect(perez).toMatchObject({
      tipo_documento: "CC",
      documento: "10234567",
      nombre: "PEREZ JUAN",
      num_servicios: 2,
      creadas: 110,
      bloqueadas: 112,
      ofertadas: 114,
      disponibles: 116,
      asignadas: 118,
      confirmadas: 120,
      confirmadas_sin_atencion: 122,
      inasistidas: 124,
      canceladas: 126,
      pendientes_por_asistir: 128,
    });
    expect(perez.servicios).toEqual([
      { codigo_servicio: "890201", nombre_servicio: "CONSULTA GENERAL", ...metricas(10) },
      { codigo_servicio: "890301", nombre_servicio: "CONTROL", ...metricas(100) },
    ]);
  });

  it("calcula los totales del periodo y lista los periodos con carga mensual", async () => {
    const body = await (await GET(reqGet("?periodo=202610"))).json();

    expect(body.totales).toEqual({
      profesionales: 2,
      creadas: 111,
      bloqueadas: 114,
      ofertadas: 117,
      disponibles: 120,
      asignadas: 123,
      confirmadas: 126,
      confirmadas_sin_atencion: 129,
      inasistidas: 132,
      canceladas: 135,
      pendientes_por_asistir: 138,
    });
    expect(body.periodos).toEqual([202610, 202609]);
  });

  it("convierte a número las sumas que el driver devuelve como texto", async () => {
    mockConsultas([
      {
        tipo_documento: "CC", documento: "10234567", nombre: "PEREZ JUAN",
        codigo_servicio: "890201", nombre_servicio: "CONSULTA GENERAL",
        ...Object.fromEntries(Object.entries(metricas(5)).map(([k, v]) => [k, String(v)])),
      },
    ]);

    const body = await (await GET(reqGet("?periodo=202610"))).json();

    expect(body.profesionales[0].creadas).toBe(5);
    expect(body.totales.pendientes_por_asistir).toBe(14);
  });

  it("retorna listas vacías y totales en cero si el mes no tiene carga mensual", async () => {
    mockConsultas([], []);

    const body = await (await GET(reqGet("?periodo=202601"))).json();

    expect(body.profesionales).toEqual([]);
    expect(body.periodos).toEqual([]);
    expect(body.totales.profesionales).toBe(0);
    expect(body.totales.creadas).toBe(0);
  });
});
