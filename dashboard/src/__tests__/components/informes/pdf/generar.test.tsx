/**
 * @jest-environment jsdom
 */
import React from "react";

const mockToBlob = jest.fn(async () => new Blob(["%PDF"]));
const mockPdf = jest.fn((_el: React.ReactElement) => ({ toBlob: mockToBlob }));
jest.mock("@react-pdf/renderer", () => ({ pdf: (el: React.ReactElement) => mockPdf(el) }));
jest.mock("@/components/informes/pdf/Documentos", () => ({ DocumentoInforme: () => null }));
const mockFuentes = jest.fn();
jest.mock("@/components/informes/pdf/fuentes", () => ({
  RUTA_FUENTES: "/fonts/pdf",
  registrarFuentesPdf: (...a: unknown[]) => mockFuentes(...a),
}));
const mockImagenes = jest.fn(async (_g: unknown) => ({ tendencia: "data:image/png;base64,T" }));
jest.mock("@/components/informes/pdf/imagenes", () => ({ imagenesGraficas: (g: unknown) => mockImagenes(g) }));
const mockGuardar = jest.fn();
jest.mock("@/lib/informes/descarga", () => ({
  ...jest.requireActual("@/lib/informes/descarga"),
  guardarBlob: (...a: unknown[]) => mockGuardar(...a),
}));

import { descargarInformePdf } from "@/components/informes/pdf/generar";
import { informeMensual } from "@/lib/informes/construir";
import { datosGraficasMensual } from "@/lib/informes/graficas";
import { PRODUCTIVIDAD } from "@/test-utils/informes";

const MODELO = informeMensual(PRODUCTIVIDAD, null, new Date("2026-11-18T15:32:00Z"));

describe("descargarInformePdf", () => {
  beforeEach(() => jest.clearAllMocks());

  it("pide el modelo, arma las gráficas y el documento y guarda el PDF con el nombre del Excel", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ modelo: MODELO, graficas: datosGraficasMensual(PRODUCTIVIDAD) }),
    });
    await expect(descargarInformePdf("/api/informes/datos?tipo=mensual", fetchMock)).resolves.toBe(
      "Informe_mensual_Octubre_2026.pdf"
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/informes/datos?tipo=mensual");
    expect(mockFuentes).toHaveBeenCalledWith("http://localhost/fonts/pdf");
    expect(mockImagenes.mock.calls[0][0]).toEqual([expect.objectContaining({ id: "tendencia", enPantalla: null })]);
    const props = mockPdf.mock.calls[0][0].props as { contenido: { tipo: string }; imagenes: object; logo: string };
    expect(props.contenido.tipo).toBe("mensual");
    expect(props.imagenes).toEqual({ tendencia: "data:image/png;base64,T" });
    expect(props.logo).toBe("http://localhost/logo.png");
    expect(mockGuardar).toHaveBeenCalledWith(expect.any(Blob), "Informe_mensual_Octubre_2026.pdf");
  });

  it("propaga el error del servidor sin generar nada", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "Sin permisos suficientes" }) });
    await expect(descargarInformePdf("/x", fetchMock)).rejects.toThrow("Sin permisos suficientes");
    expect(mockPdf).not.toHaveBeenCalled();
    expect(mockGuardar).not.toHaveBeenCalled();
  });
});
