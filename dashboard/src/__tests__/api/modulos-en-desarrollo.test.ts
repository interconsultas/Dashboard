/**
 * Productividad e Inteligencia en desarrollo (MODULOS_EN_DESARROLLO por
 * defecto): sus rutas /api responden 403 a todos los roles, admin incluido,
 * aunque la matriz permisos_rol les dé acceso. Usa obtenerPermisos real (BD simulada).
 */
jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ query: jest.fn() }));

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";
import { invalidarPermisos } from "@/lib/permisos";
import { PERMISOS_API, ROLES, type Requisito } from "@/lib/acceso";
import { GET as getProductividad } from "@/app/api/productividad/route";
import { GET as getInformeExcel } from "@/app/api/informes/excel/route";

const mockAuth = auth as unknown as jest.Mock;
const mockQuery = query as jest.MockedFunction<typeof query>;

/** permisos_rol con todo abierto a los roles configurables (peor caso). */
const FILAS = ROLES.filter((r) => r !== "admin").flatMap((rol) =>
  ["productividad", "inteligencia", "dashboard"].map((seccion) => ({ rol, seccion, nivel: "editar" })),
);

function sesion(rol: string) {
  return { user: { id: "7", email: "x@ips.local", rol, regional: null } };
}

/** Rutas cuyo requisito solo se cumple con Productividad o Inteligencia. */
const RUTAS_MODULO = Object.entries(PERMISOS_API).flatMap(([ruta, metodos]) =>
  Object.entries(metodos as Record<string, Requisito>)
    .filter(([, req]) => req.secciones.every((s) => s === "productividad" || s === "inteligencia"))
    .map(([metodo, req]) => [`${metodo} ${ruta}`, req] as const),
);

const MODULOS_ORIGINAL = process.env.MODULOS_EN_DESARROLLO;

beforeEach(() => {
  jest.clearAllMocks();
  invalidarPermisos();
  delete process.env.MODULOS_EN_DESARROLLO;
  mockQuery.mockResolvedValue(FILAS as never);
});

afterAll(() => {
  if (MODULOS_ORIGINAL === undefined) delete process.env.MODULOS_EN_DESARROLLO;
  else process.env.MODULOS_EN_DESARROLLO = MODULOS_ORIGINAL;
});

it("cubre las rutas de Productividad, Inteligencia e Informes", () => {
  const rutas = RUTAS_MODULO.map(([r]) => r);
  expect(rutas).toEqual(
    expect.arrayContaining([
      "GET /api/productividad",
      "GET /api/productividad/profesional",
      "GET /api/informes/excel",
      "GET /api/informes/datos",
      "GET /api/inteligencia/grafo",
      "GET /api/inteligencia/alertas",
      "GET /api/inteligencia/alertas/conteo",
      "GET /api/inteligencia/reglas",
      "PUT /api/inteligencia/reglas",
    ]),
  );
});

describe.each(RUTAS_MODULO)("%s", (_ruta, requisito) => {
  it.each(["direccion_medica", "coordinador"])("responde 403 a %s aunque la matriz le dé acceso", async (rol) => {
    mockAuth.mockResolvedValue(sesion(rol));
    const { error } = await requirePermiso(requisito);
    expect(error?.status).toBe(403);
  });

  it("responde 403 también a admin", async () => {
    mockAuth.mockResolvedValue(sesion("admin"));
    const { error } = await requirePermiso(requisito);
    expect(error?.status).toBe(403);
  });

  it.each(["admin", "direccion_medica"])("con los módulos liberados vuelve el acceso de %s", async (rol) => {
    process.env.MODULOS_EN_DESARROLLO = "";
    mockAuth.mockResolvedValue(sesion(rol));
    const { error } = await requirePermiso(requisito);
    expect(error).toBeNull();
  });
});

describe("handlers reales", () => {
  it.each([
    ["GET /api/productividad", () => getProductividad(new NextRequest("http://x/api/productividad"))],
    ["GET /api/informes/excel", () => getInformeExcel(new NextRequest("http://x/api/informes/excel?tipo=vista"))],
  ])("%s responde 403 a dirección médica y a admin sin consultar datos", async (_n, llamar) => {
    mockAuth.mockResolvedValue(sesion("direccion_medica"));
    expect((await llamar()).status).toBe(403);
    mockAuth.mockResolvedValue(sesion("admin"));
    const res = await llamar();
    expect(res.status).toBe(403);
    // Solo se leyó permisos_rol
    expect(mockQuery.mock.calls.every(([sql]) => String(sql).includes("permisos_rol"))).toBe(true);
  });
});
