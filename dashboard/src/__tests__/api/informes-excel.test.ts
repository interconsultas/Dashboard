jest.mock("@/lib/middleware-roles", () => ({ requirePermiso: jest.fn() }));
jest.mock("@/lib/permisos", () => ({ obtenerPermisos: jest.fn() }));
jest.mock("@/lib/productividad/consultas", () => ({
  leerAreas: jest.fn(),
  consultarProductividad: jest.fn(),
  consultarFicha: jest.fn(),
}));
jest.mock("@/lib/inteligencia/datosAlertas", () => ({ obtenerAlertas: jest.fn() }));

import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { GET } from "@/app/api/informes/excel/route";
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

function req(qs: string): Request {
  return { url: `http://localhost/api/informes/excel?${qs}` } as Request;
}

async function hojas(res: Response) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  return wb.worksheets.map((w) => w.name);
}

describe("GET /api/informes/excel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePermiso.mockResolvedValue({ error: null, user: USUARIO });
    mockPermisos.mockResolvedValue(PERMISOS_POR_DEFECTO.direccion_medica);
    mockAreas.mockResolvedValue(["Medicina general", "Salud oral"]);
    mockProductividad.mockResolvedValue(PRODUCTIVIDAD);
    mockFicha.mockResolvedValue(FICHA);
    mockAlertas.mockResolvedValue(ALERTAS);
  });

  it("pide ver Productividad y devuelve el error de requirePermiso sin consultar", async () => {
    const authError = NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
    mockRequirePermiso.mockResolvedValue({ error: authError, user: null });
    const res = await GET(req("tipo=vista"));
    expect(mockRequirePermiso).toHaveBeenCalledWith({ secciones: ["productividad"], nivel: "ver" });
    expect(res).toBe(authError);
    expect(mockProductividad).not.toHaveBeenCalled();
  });

  it.each([
    ["", "El tipo de informe debe ser vista, mensual o ficha"],
    ["tipo=otro", "El tipo de informe debe ser vista, mensual o ficha"],
    ["tipo=vista&tipo=ficha", "El parámetro tipo está repetido"],
    ["tipo=vista&periodo=2026", "El periodo debe tener el formato AAAAMM"],
    ["tipo=vista&area=Otra", "El área no es válida"],
    ["tipo=ficha", "El documento del profesional debe contener solo dígitos"],
  ])("valida los parámetros (%s) con un 400", async (qs, mensaje) => {
    const res = await GET(req(qs));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: mensaje });
  });

  it("vista: descarga el xlsx con los filtros de la URL y nombre por periodo", async () => {
    const res = await GET(req("tipo=vista&periodo=202610&area=Salud+oral&servicio=22"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="Productividad_Octubre_2026.xlsx"');
    expect(mockProductividad).toHaveBeenCalledWith(
      { granularidad: "mensual", periodo: "202610", area: "Salud oral", servicio: "22", profesional: null },
      ["Medicina general", "Salud oral"]
    );
    expect(await hojas(res)).toEqual(["Resumen", "Por área", "Por servicio", "Por profesional", "Tendencia"]);
  });

  it("mensual: ignora área, servicio y profesional e incluye prioridades si ve Inteligencia", async () => {
    const res = await GET(req("tipo=mensual&periodo=202610&area=Salud+oral&profesional=1053"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("Informe_mensual_Octubre_2026.xlsx");
    expect(mockProductividad).toHaveBeenCalledWith(
      { granularidad: "mensual", periodo: "202610", area: null, servicio: null, profesional: null },
      expect.any(Array)
    );
    expect(mockAlertas).toHaveBeenCalledWith("mensual");
    expect(await hojas(res)).toContain("Prioridades");
  });

  it("mensual: en granularidad semanal toma el último mes", async () => {
    await GET(req("tipo=mensual&granularidad=semanal&periodo=2026-10-05"));
    expect(mockProductividad).toHaveBeenCalledWith(
      expect.objectContaining({ granularidad: "mensual", periodo: null }),
      expect.any(Array)
    );
  });

  it("mensual: sin acceso a Inteligencia omite prioridades y proyección sin fallar", async () => {
    mockPermisos.mockResolvedValue({ ...PERMISOS_POR_DEFECTO.direccion_medica, inteligencia: "ninguno" });
    const res = await GET(req("tipo=mensual"));
    expect(res.status).toBe(200);
    expect(mockAlertas).not.toHaveBeenCalled();
    const nombres = await hojas(res);
    expect(nombres).not.toContain("Prioridades");
    expect(nombres).not.toContain("Proyección");
  });

  it("ficha: descarga la ficha del documento", async () => {
    const res = await GET(req("tipo=ficha&documento=1053&periodo=202610"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("Ficha_1053_Octubre_2026.xlsx");
    expect(mockFicha).toHaveBeenCalledWith("1053", expect.objectContaining({ periodo: "202610" }));
    expect(await hojas(res)).toEqual(["Ficha", "Servicios", "Tendencia"]);
  });

  it("ficha: 404 si el profesional no tiene agenda", async () => {
    mockFicha.mockResolvedValue(null);
    const res = await GET(req("tipo=ficha&documento=999"));
    expect(res.status).toBe(404);
  });

  it("responde 500 si la consulta falla", async () => {
    mockProductividad.mockRejectedValue(new Error("boom"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req("tipo=vista"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error al generar el informe" });
  });
});
