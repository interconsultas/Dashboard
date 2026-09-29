import type { NextRequest } from "next/server";

jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({
  requireAuth: jest.fn(),
  regionalClause: jest.fn(() => ({ clause: "", params: [] })),
}));
jest.mock("@/lib/cache", () => ({ getCached: jest.fn(() => null), setCache: jest.fn() }));

import { POST } from "@/app/api/dashboard/filtros/route";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

function req(body: Record<string, unknown>): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

/** Filas crudas que devolvería la query de serie diaria: 2 días con datos + 1 fila "sin fecha". */
const FILAS_DIA_MOCK = [
  { dia: "2026-03-01", total: "5", valor_total: "500" },
  { dia: "2026-03-02", total: "3", valor_total: "300" },
  { dia: null, total: "2", valor_total: "0" },
];

function mockQueryConSerieDiaria() {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("date_trunc('day'")) return FILAS_DIA_MOCK as never;
    return [] as never;
  });
}

describe("POST /api/dashboard/filtros - modo día (issue #4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER } as never);
  });

  it("modo día en la vista default con desde===hasta dispara la query diaria sobre autorizaciones", async () => {
    mockQueryConSerieDiaria();

    const res = await POST(req({ modo: "dia", desde: 202603, hasta: 202603 }));
    const body = await res.json();

    const diaCalls = mockQuery.mock.calls.filter(([sql]) => (sql as string).includes("date_trunc('day'"));
    expect(diaCalls).toHaveLength(1);
    expect(diaCalls[0][0]).toMatch(/FROM autorizaciones/);

    expect(body.serie_diaria).toEqual([
      { dia: "2026-03-01", total: 5, valor_total: 500 },
      { dia: "2026-03-02", total: 3, valor_total: 300 },
      { dia: null, total: 2, valor_total: 0 },
    ]);
  });

  it("la suma de la serie diaria (incluyendo 'Sin fecha') cuadra con el total esperado del mes", async () => {
    mockQueryConSerieDiaria();

    const res = await POST(req({ modo: "dia", desde: 202603, hasta: 202603 }));
    const body = await res.json();

    const sumaDiaria = body.serie_diaria.reduce((acc: number, p: { total: number }) => acc + p.total, 0);
    expect(sumaDiaria).toBe(10); // 5 + 3 + 2 (incluye el bucket "Sin fecha")
  });

  it("ignora modo día si la vista no es la default (vm_dash_rx)", async () => {
    mockQueryConSerieDiaria();

    const res = await POST(req({ modo: "dia", desde: 202603, hasta: 202603, view: "vm_dash_rx" }));
    const body = await res.json();

    const diaCalls = mockQuery.mock.calls.filter(([sql]) => (sql as string).includes("date_trunc('day'"));
    expect(diaCalls).toHaveLength(0);
    expect(body.serie_diaria).toBeUndefined();
  });

  it("ignora modo día si desde !== hasta (rango multi-mes)", async () => {
    mockQueryConSerieDiaria();

    const res = await POST(req({ modo: "dia", desde: 202601, hasta: 202603 }));
    const body = await res.json();

    const diaCalls = mockQuery.mock.calls.filter(([sql]) => (sql as string).includes("date_trunc('day'"));
    expect(diaCalls).toHaveLength(0);
    expect(body.serie_diaria).toBeUndefined();
  });

  it("no dispara la query diaria cuando modo no viene o es 'mes'", async () => {
    mockQueryConSerieDiaria();

    const res = await POST(req({ desde: 202603, hasta: 202603 }));
    const body = await res.json();

    const diaCalls = mockQuery.mock.calls.filter(([sql]) => (sql as string).includes("date_trunc('day'"));
    expect(diaCalls).toHaveLength(0);
    expect(body.serie_diaria).toBeUndefined();
  });

  it("incluye 'modo' en la clave de caché (no reutiliza resultado de modo mes)", async () => {
    mockQueryConSerieDiaria();
    const { getCached } = jest.requireMock("@/lib/cache") as { getCached: jest.Mock };

    await POST(req({ modo: "dia", desde: 202603, hasta: 202603 }));

    const cacheKeyUsada = getCached.mock.calls[0][0] as string;
    expect(cacheKeyUsada).toContain(`"modo":"dia"`);
  });

  it("sin rango angostado, bucketiza fechas fuera del mes calendario en 'Sin fecha' (dato real: periodo no siempre coincide con el mes de fecha_emision)", async () => {
    mockQueryConSerieDiaria();

    await POST(req({ modo: "dia", desde: 202603, hasta: 202603 }));

    const diaCalls = mockQuery.mock.calls.filter(([sql]) => (sql as string).includes("date_trunc('day'"));
    expect(diaCalls).toHaveLength(1);
    const [sql, params] = diaCalls[0];
    expect(sql).toMatch(/CASE/);
    expect(sql).toMatch(/THEN NULL/);
    expect(params).toEqual(expect.arrayContaining(["2026-03-01", "2026-03-31"]));
  });

  it("con rango angostado, NO agrega el CASE de bucketing (addRangoFechaDiaria ya excluye lo de fuera por WHERE)", async () => {
    mockQueryConSerieDiaria();

    await POST(req({
      modo: "dia", desde: 202603, hasta: 202603,
      dia_desde: "2026-03-03", dia_hasta: "2026-03-15",
    }));

    const diaCalls = mockQuery.mock.calls.filter(([sql]) => (sql as string).includes("date_trunc('day'"));
    expect(diaCalls).toHaveLength(1);
    expect(diaCalls[0][0]).not.toMatch(/CASE/);
  });

  describe("extensión: rango de días dentro del mes", () => {
    it("en modo día (sin angostar), kpis/opciones/top/serie también golpean autorizaciones, no la vista", async () => {
      mockQueryConSerieDiaria();

      await POST(req({ modo: "dia", desde: 202603, hasta: 202603 }));

      const todasLasQueries = mockQuery.mock.calls.map(([sql]) => sql as string);

      // periodos (lista de meses seleccionables) y la serie del año anterior (comparación
      // a otro periodo, no afectada por el rango de días de HOY) siguen viniendo de la vista.
      const dePeriodos = todasLasQueries.filter((sql) => sql.includes("SELECT DISTINCT periodo"));
      expect(dePeriodos.some((sql) => sql.includes("vm_filtros_dashboard"))).toBe(true);

      // kpis, opciones cascada, serie actual, top-N y serie diaria van contra autorizaciones
      const kpisSql = todasLasQueries.find((sql) => sql.includes("total_profesionales"));
      const serieActualSql = todasLasQueries.find(
        (sql) => sql.includes("GROUP BY periodo") && sql.includes("COUNT(*)")
      );
      const opcionSql = todasLasQueries.find((sql) => sql.includes("estado_medico AS v"));
      const topSql = todasLasQueries.find((sql) => sql.includes("nombre_medico AS nombre"));

      for (const sql of [kpisSql, serieActualSql, opcionSql, topSql]) {
        expect(sql).toBeDefined();
        expect(sql).toMatch(/FROM autorizaciones/);
      }
    });

    it("con dia_desde/dia_hasta angostado, agrega BETWEEN a kpis, opciones, top y serie diaria", async () => {
      mockQueryConSerieDiaria();

      await POST(req({
        modo: "dia", desde: 202603, hasta: 202603,
        dia_desde: "2026-03-03", dia_hasta: "2026-03-15",
      }));

      const conBetween = mockQuery.mock.calls.filter(([sql]) =>
        (sql as string).includes("fecha_digitacion BETWEEN")
      );
      // kpis + 8 opciones (estado, prof, programa, tc, oa, as, diag, prest) + serieActual + 3 top + serieDiaria = 14
      expect(conBetween.length).toBeGreaterThanOrEqual(10);

      for (const [, params] of conBetween) {
        expect(params).toEqual(expect.arrayContaining(["2026-03-03", "2026-03-15"]));
      }
    });

    it("dia_desde/dia_hasta fuera del mes seleccionado se ignoran (usa el mes completo)", async () => {
      mockQueryConSerieDiaria();

      await POST(req({
        modo: "dia", desde: 202603, hasta: 202603,
        dia_desde: "2026-02-20", dia_hasta: "2026-03-15",
      }));

      const conBetween = mockQuery.mock.calls.filter(([sql]) =>
        (sql as string).includes("fecha_digitacion BETWEEN")
      );
      expect(conBetween).toHaveLength(0);
    });

    it("dia_hasta anterior a dia_desde se ignora (usa el mes completo)", async () => {
      mockQueryConSerieDiaria();

      await POST(req({
        modo: "dia", desde: 202603, hasta: 202603,
        dia_desde: "2026-03-15", dia_hasta: "2026-03-03",
      }));

      const conBetween = mockQuery.mock.calls.filter(([sql]) =>
        (sql as string).includes("fecha_digitacion BETWEEN")
      );
      expect(conBetween).toHaveLength(0);
    });

    it("dia_desde/dia_hasta que cubren el mes completo se tratan igual que 'sin angostar' (sin BETWEEN)", async () => {
      mockQueryConSerieDiaria();

      await POST(req({
        modo: "dia", desde: 202603, hasta: 202603,
        dia_desde: "2026-03-01", dia_hasta: "2026-03-31",
      }));

      const conBetween = mockQuery.mock.calls.filter(([sql]) =>
        (sql as string).includes("fecha_digitacion BETWEEN")
      );
      expect(conBetween).toHaveLength(0);
    });

    it("incluye dia_desde/dia_hasta en la clave de caché", async () => {
      mockQueryConSerieDiaria();
      const { getCached } = jest.requireMock("@/lib/cache") as { getCached: jest.Mock };

      await POST(req({
        modo: "dia", desde: 202603, hasta: 202603,
        dia_desde: "2026-03-03", dia_hasta: "2026-03-15",
      }));

      const cacheKeyUsada = getCached.mock.calls[0][0] as string;
      expect(cacheKeyUsada).toContain("2026-03-03");
      expect(cacheKeyUsada).toContain("2026-03-15");
    });
  });
});
