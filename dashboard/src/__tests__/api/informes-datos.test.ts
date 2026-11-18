jest.mock("@/lib/middleware-roles", () => ({ requirePermiso: jest.fn() }));
jest.mock("@/lib/permisos", () => ({ obtenerPermisos: jest.fn() }));
jest.mock("@/lib/productividad/consultas", () => ({
  leerAreas: jest.fn(),
  consultarProductividad: jest.fn(),
  consultarFicha: jest.fn(),
}));
jest.mock("@/lib/inteligencia/datosAlertas", () => ({ obtenerAlertas: jest.fn() }));

import { NextResponse } from "next/server";
import { GET } from "@/app/api/informes/datos/route";
import { requirePermiso } from "@/lib/middleware-roles";
import { obtenerPermisos } from "@/lib/permisos";
import { consultarFicha, consultarProductividad, leerAreas } from "@/lib/productividad/consultas";
import { obtenerAlertas } from "@/lib/inteligencia/datosAlertas";
import { PERMISOS_POR_DEFECTO } from "@/lib/acceso";
import { ALERTAS, FICHA, PRODUCTIVIDAD } from "@/test-utils/informes";

const mockRequirePermiso = requirePermiso as jest.MockedFunction<typeof requirePermiso>;
const mockPermisos = obtenerPermisos as jest.MockedFunction<typeof obtenerPermisos>;
const mockAreas = leerAreas as jest.MockedFunction<typeof leerAreas>;
const mockProductividad = consultarProductividad as jest.MockedFunction<typeof consultarProductividad>;
const mockFicha = consultarFicha as jest.MockedFunction<typeof consultarFicha>;
const mockAlertas = obtenerAlertas as jest.MockedFunction<typeof obtenerAlertas>;

const USUARIO = { id: "2", email: "dm@ips.local", rol: "direccion_medica" as const, regional: null };
const req = (qs: string) => ({ url: `http://localhost/api/informes/datos?${qs}` }) as Request;

describe("GET /api/informes/datos (modelo del PDF)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePermiso.mockResolvedValue({ error: null, user: USUARIO });
    mockPermisos.mockResolvedValue(PERMISOS_POR_DEFECTO.direccion_medica);
    mockAreas.mockResolvedValue(["Medicina general", "Salud oral"]);
    mockProductividad.mockResolvedValue(PRODUCTIVIDAD);
    mockFicha.mockResolvedValue(FICHA);
    mockAlertas.mockResolvedValue(ALERTAS);
  });

  it("pide ver Productividad y devuelve el error de requirePermiso", async () => {
    const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
    mockRequirePermiso.mockResolvedValue({ error: authError, user: null });
    const res = await GET(req("tipo=vista"));
    expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["productividad"], nivel: "ver" });
    expect(res).toBe(authError);
  });

  it("valida los parámetros como el Excel", async () => {
    const res = await GET(req("tipo=otro"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "El tipo de informe debe ser vista, mensual o ficha" });
  });

  it("vista: el modelo y los datos de sus gráficas, sin caché", async () => {
    const res = await GET(req("tipo=vista&periodo=202610"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const cuerpo = await res.json();
    expect(cuerpo.modelo).toMatchObject({ tipo: "vista", archivo: "Productividad_Octubre_2026" });
    expect(cuerpo.graficas).toMatchObject({ tipo: "vista", seleccionado: "202610" });
  });

  it("mensual: prioridades solo si ve Inteligencia", async () => {
    let cuerpo = await (await GET(req("tipo=mensual"))).json();
    expect(cuerpo.modelo.tablas.map((t: { id: string }) => t.id)).toContain("prioridades");
    expect(cuerpo.graficas.tipo).toBe("mensual");

    mockPermisos.mockResolvedValue({ ...PERMISOS_POR_DEFECTO.direccion_medica, inteligencia: "ninguno" });
    cuerpo = await (await GET(req("tipo=mensual"))).json();
    expect(cuerpo.modelo.tablas.map((t: { id: string }) => t.id)).not.toContain("prioridades");
  });

  it("ficha: 404 sin agenda y el modelo con sus gráficas si la hay", async () => {
    const cuerpo = await (await GET(req("tipo=ficha&documento=1053"))).json();
    expect(cuerpo.modelo.archivo).toBe("Ficha_1053_Octubre_2026");
    expect(cuerpo.graficas.servicios).toHaveLength(1);
    mockFicha.mockResolvedValue(null);
    expect((await GET(req("tipo=ficha&documento=999"))).status).toBe(404);
  });

  it("responde 500 si la consulta falla", async () => {
    mockProductividad.mockRejectedValue(new Error("boom"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req("tipo=vista"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error al generar el informe" });
  });
});
