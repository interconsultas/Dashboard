jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { connect: jest.fn() },
  query: jest.fn(),
}));
jest.mock("@/lib/middleware-roles", () => ({ requireAuth: jest.fn() }));
jest.mock("@/lib/cache", () => ({ clearCache: jest.fn() }));

import { NextResponse } from "next/server";
import { GET, PUT } from "@/app/api/admin/citas-atendidas/route";
import pool, { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { clearCache } from "@/lib/cache";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockConnect = pool.connect as unknown as jest.Mock;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

const client = { query: jest.fn(), release: jest.fn() };

function reqGet(qs = "") {
  return new Request(`http://localhost/api/admin/citas-atendidas${qs}`);
}

function reqPut(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

/** Sentencias ejecutadas dentro de la transacción, en orden. */
function sentencias(): string[] {
  return client.query.mock.calls.map(([sql]) => sql as string);
}

function llamadaCon(fragmento: string): [string, unknown[]] {
  return client.query.mock.calls.find(([sql]) => (sql as string).includes(fragmento)) as [string, unknown[]];
}

const MEDICOS = [
  { documento: "10234567", nombre: "PEREZ JUAN" },
  { documento: "30345678", nombre: "GOMEZ ANA" },
];

describe("/api/admin/citas-atendidas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockQuery.mockResolvedValue(MEDICOS as never);
    mockConnect.mockResolvedValue(client);
    client.query.mockReset();
    client.query.mockImplementation(async (sql: string) =>
      sql.includes("DELETE") ? { rowCount: 1 } : { rowCount: 0 }
    );
  });

  describe("GET", () => {
    it("permite los roles admin y direccion_medica", async () => {
      await GET(reqGet("?periodo=202602"));
      expect(mockRequireAuth).toHaveBeenCalledWith(["admin", "direccion_medica"]);
    });

    it("retorna el error de requireAuth sin consultar la base de datos", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequireAuth.mockResolvedValue({ error: authError, user: null });

      const res = await GET(reqGet("?periodo=202602"));

      expect(res).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("retorna una fila por profesional con las citas del periodo", async () => {
      const filas = [
        {
          documento: "10234567", nombre: "PEREZ JUAN", estado: "ACTIVO",
          programa_meta: "RCV", cantidad_citas: 120, programa: "RCV",
        },
        {
          documento: "30345678", nombre: "GOMEZ ANA", estado: "ACTIVO",
          programa_meta: null, cantidad_citas: null, programa: null,
        },
      ];
      mockQuery.mockResolvedValue(filas as never);

      const res = await GET(reqGet("?periodo=202602"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(filas);
    });

    it("consulta los profesionales activos y las citas del periodo con un parámetro", async () => {
      await GET(reqGet("?periodo=202602"));

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("LEFT JOIN citas_atendidas");
      expect(sql).toContain("c.documento = m.identificacion AND c.periodo = $1");
      expect(sql).toContain("m.estado = 'ACTIVO'");
      expect(sql).toContain("ORDER BY nombre");
      expect(sql).not.toContain("202602");
      expect(params).toEqual([202602]);
    });

    it.each(["", "?periodo=", "?periodo=20262", "?periodo=202613", "?periodo=202600", "?periodo=abcdef", "?periodo=2026021"])(
      "rechaza con 400 el periodo no válido %p",
      async (qs) => {
        const res = await GET(reqGet(qs));

        expect(res.status).toBe(400);
        expect((await res.json()).error).toEqual(expect.any(String));
        expect(mockQuery).not.toHaveBeenCalled();
      }
    );
  });

  describe("PUT", () => {
    const FILA = { documento: "10234567", cantidad_citas: 120, programa: "RCV" };

    it("permite solo el rol admin", async () => {
      await PUT(reqPut({ periodo: 202602, filas: [FILA] }));
      expect(mockRequireAuth).toHaveBeenCalledWith(["admin"]);
    });

    it("retorna el error de requireAuth sin consultar ni escribir", async () => {
      const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
      mockRequireAuth.mockResolvedValue({ error: authError, user: null });

      const res = await PUT(reqPut({ periodo: 202602, filas: [FILA] }));

      expect(res).toBe(authError);
      expect(mockQuery).not.toHaveBeenCalled();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("guarda las filas con un único INSERT parametrizado y el nombre tomado de medicos", async () => {
      const res = await PUT(
        reqPut({
          periodo: 202602,
          filas: [
            { documento: "10234567", cantidad_citas: 120, programa: "RCV" },
            { documento: 30345678, cantidad_citas: 0, programa: null },
          ],
        })
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ guardadas: 2, eliminadas: 0 });

      const inserts = sentencias().filter((s) => s.includes("INSERT INTO citas_atendidas"));
      expect(inserts).toHaveLength(1);
      const [sql, params] = llamadaCon("INSERT INTO citas_atendidas");
      expect(sql).toContain("(documento, periodo, cantidad_citas, programa, nombre_medico)");
      expect(sql).toContain("($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)");
      expect(sql).toContain("ON CONFLICT (documento, periodo) DO UPDATE");
      expect(sql).toContain("cantidad_citas = EXCLUDED.cantidad_citas");
      expect(sql).toContain("programa = EXCLUDED.programa");
      expect(sql).toContain("nombre_medico = EXCLUDED.nombre_medico");
      expect(params).toEqual([
        "10234567", 202602, 120, "RCV", "PEREZ JUAN",
        "30345678", 202602, 0, null, "GOMEZ ANA",
      ]);
    });

    it("no interpola los valores en el SQL", async () => {
      await PUT(
        reqPut({
          periodo: 202602,
          filas: [FILA, { documento: "30345678", cantidad_citas: null, programa: null }],
        })
      );

      for (const sql of [...sentencias(), ...mockQuery.mock.calls.map(([s]) => s)]) {
        expect(sql).not.toContain("202602");
        expect(sql).not.toContain("10234567");
        expect(sql).not.toContain("30345678");
        expect(sql).not.toContain("RCV");
        expect(sql).not.toContain("PEREZ");
      }
    });

    it("verifica en una sola consulta que las cédulas existan en medicos", async () => {
      await PUT(
        reqPut({
          periodo: 202602,
          filas: [FILA, { documento: "30345678", cantidad_citas: 5, programa: null }],
        })
      );

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("FROM medicos");
      expect(sql).toContain("identificacion = ANY($1::bigint[])");
      expect(params).toEqual([["10234567", "30345678"]]);
    });

    it("rechaza con 400 las cédulas que no existen en medicos, las lista y no escribe", async () => {
      mockQuery.mockResolvedValue([MEDICOS[0]] as never);

      const res = await PUT(
        reqPut({
          periodo: 202602,
          filas: [
            FILA,
            { documento: "999", cantidad_citas: 5, programa: null },
            { documento: "888", cantidad_citas: 1, programa: null },
          ],
        })
      );

      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error).toContain("999");
      expect(error).toContain("888");
      expect(error).not.toContain("10234567");
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("elimina con un único DELETE las filas con cantidad_citas null", async () => {
      const res = await PUT(
        reqPut({
          periodo: 202602,
          filas: [
            { documento: "10234567", cantidad_citas: null, programa: null },
            { documento: "30345678", cantidad_citas: null, programa: "RCV" },
          ],
        })
      );

      expect(await res.json()).toEqual({ guardadas: 0, eliminadas: 1 });
      const [sql, params] = llamadaCon("DELETE");
      expect(sql).toContain("DELETE FROM citas_atendidas");
      expect(sql).toContain("periodo = $1 AND documento = ANY($2::bigint[])");
      expect(params).toEqual([202602, ["10234567", "30345678"]]);
      expect(sentencias().some((s) => s.includes("INSERT"))).toBe(false);
    });

    it("permite eliminar el registro de una cédula que ya no está en medicos", async () => {
      const res = await PUT(
        reqPut({ periodo: 202602, filas: [{ documento: "999", cantidad_citas: null, programa: null }] })
      );

      expect(res.status).toBe(200);
      expect(mockQuery).not.toHaveBeenCalled();
      expect(llamadaCon("DELETE")[1]).toEqual([202602, ["999"]]);
    });

    it("ejecuta la eliminación y el guardado dentro de una misma transacción", async () => {
      await PUT(
        reqPut({
          periodo: 202602,
          filas: [FILA, { documento: "30345678", cantidad_citas: null, programa: null }],
        })
      );

      const orden = sentencias().map((s) => s.trim().split(/\s+/)[0]);
      expect(orden).toEqual(["BEGIN", "DELETE", "INSERT", "COMMIT"]);
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("revierte la transacción y libera la conexión si una sentencia falla", async () => {
      client.query.mockImplementation(async (sql: string) => {
        if (sql.includes("INSERT")) throw new Error("fallo de base de datos");
        return { rowCount: 1 };
      });

      await expect(
        PUT(
          reqPut({
            periodo: 202602,
            filas: [FILA, { documento: "30345678", cantidad_citas: null, programa: null }],
          })
        )
      ).rejects.toThrow("fallo de base de datos");

      const orden = sentencias().map((s) => s.trim().split(/\s+/)[0]);
      expect(orden).toEqual(["BEGIN", "DELETE", "INSERT", "ROLLBACK"]);
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("rechaza un cuerpo que no es JSON", async () => {
      const res = await PUT({
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      } as unknown as Request);

      expect(res.status).toBe(400);
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it.each([
      ["sin periodo", { filas: [FILA] }],
      ["periodo con mes 13", { periodo: 202613, filas: [FILA] }],
      ["periodo de 5 dígitos", { periodo: 20262, filas: [FILA] }],
      ["sin filas", { periodo: 202602 }],
      ["filas vacío", { periodo: 202602, filas: [] }],
      ["filas que no es una lista", { periodo: 202602, filas: {} }],
      ["fila que no es un objeto", { periodo: 202602, filas: [7] }],
      ["documento ausente", { periodo: 202602, filas: [{ cantidad_citas: 1, programa: null }] }],
      ["documento no numérico", { periodo: 202602, filas: [{ ...FILA, documento: "12a" }] }],
      ["documento decimal", { periodo: 202602, filas: [{ ...FILA, documento: 12.5 }] }],
      ["documento cero", { periodo: 202602, filas: [{ ...FILA, documento: 0 }] }],
      ["documento con intento de inyección", { periodo: 202602, filas: [{ ...FILA, documento: "1); DROP TABLE medicos;--" }] }],
      ["citas ausentes", { periodo: 202602, filas: [{ documento: "10234567", programa: null }] }],
      ["citas negativas", { periodo: 202602, filas: [{ ...FILA, cantidad_citas: -1 }] }],
      ["citas decimales", { periodo: 202602, filas: [{ ...FILA, cantidad_citas: 1.5 }] }],
      ["citas como texto", { periodo: 202602, filas: [{ ...FILA, cantidad_citas: "12" }] }],
      ["citas fuera del rango de la columna", { periodo: 202602, filas: [{ ...FILA, cantidad_citas: 2147483648 }] }],
      ["programa desconocido", { periodo: 202602, filas: [{ ...FILA, programa: "OTRO" }] }],
      ["programa que no es texto", { periodo: 202602, filas: [{ ...FILA, programa: 3 }] }],
      ["documento repetido", { periodo: 202602, filas: [FILA, { ...FILA, cantidad_citas: 3 }] }],
    ])("rechaza con 400 y no consulta ni escribe: %s", async (_caso, body) => {
      const res = await PUT(reqPut(body));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toEqual(expect.any(String));
      expect(mockQuery).not.toHaveBeenCalled();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("no escribe ninguna fila si una sola es inválida", async () => {
      const res = await PUT(
        reqPut({
          periodo: 202602,
          filas: [FILA, { documento: "30345678", cantidad_citas: -3, programa: null }],
        })
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("30345678");
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("vacía el caché después de guardar para que el cumplimiento refleje las citas", async () => {
      await PUT(reqPut({ periodo: 202602, filas: [FILA] }));

      expect(clearCache).toHaveBeenCalledTimes(1);
    });

    it("no vacía el caché si la solicitud se rechaza o la transacción falla", async () => {
      await PUT(reqPut({ periodo: 202602, filas: [{ ...FILA, cantidad_citas: -1 }] }));
      expect(clearCache).not.toHaveBeenCalled();

      client.query.mockImplementation(async (sql: string) => {
        if (sql.includes("INSERT")) throw new Error("fallo de base de datos");
        return { rowCount: 0 };
      });
      await expect(PUT(reqPut({ periodo: 202602, filas: [FILA] }))).rejects.toThrow();
      expect(clearCache).not.toHaveBeenCalled();
    });
  });
});
