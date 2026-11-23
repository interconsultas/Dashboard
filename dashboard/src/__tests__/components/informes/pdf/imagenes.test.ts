/**
 * @jest-environment jsdom
 */
const mockInstancia = {
  setOption: jest.fn(),
  getDataURL: jest.fn(() => "data:image/png;base64,FUERA"),
  dispose: jest.fn(),
};
const mockInit = jest.fn((_nodo: HTMLElement, _tema: string, _opts: object) => mockInstancia);
jest.mock("@/lib/echarts", () => ({ echarts: { init: (...a: [HTMLElement, string, object]) => mockInit(...a) }, NOMBRE_TEMA: "interconsultas" }));

import { imagenesGraficas } from "@/components/informes/pdf/imagenes";
import { registrarGrafica } from "@/lib/informes/registroGraficas";
import type { GraficaPdf } from "@/lib/informes/graficas";

const grafica = (id: GraficaPdf["id"], enPantalla: string | null): GraficaPdf => ({
  id,
  titulo: id,
  enPantalla,
  opcion: { series: [] },
  ancho: 900,
  alto: 300,
});

describe("imagenesGraficas", () => {
  beforeEach(() => jest.clearAllMocks());

  it("captura la gráfica que está en pantalla sin dibujar otra", async () => {
    const quitar = registrarGrafica("Embudo de la agenda", { getDataURL: () => "data:image/png;base64,PANTALLA" });
    await expect(imagenesGraficas([grafica("embudo", "Embudo de la agenda")])).resolves.toEqual({
      embudo: "data:image/png;base64,PANTALLA",
    });
    expect(mockInit).not.toHaveBeenCalled();
    quitar();
  });

  it("dibuja fuera de pantalla con el tema de la app la que no está montada, y la libera", async () => {
    const imagenes = await imagenesGraficas([grafica("tendencia", null)]);
    expect(imagenes).toEqual({ tendencia: "data:image/png;base64,FUERA" });
    const [nodo, tema, opts] = mockInit.mock.calls[0];
    expect(tema).toBe("interconsultas");
    expect(opts).toEqual({ renderer: "canvas", width: 900, height: 300 });
    expect(mockInstancia.setOption).toHaveBeenCalledWith({ series: [] });
    expect(mockInstancia.getDataURL).toHaveBeenCalledWith({ type: "png", pixelRatio: 2, backgroundColor: "#fff" });
    expect(mockInstancia.dispose).toHaveBeenCalled();
    expect(document.body.contains(nodo)).toBe(false);
  });

  it("si una gráfica falla, el PDF sale sin ella", async () => {
    mockInstancia.setOption.mockImplementationOnce(() => {
      throw new Error("canvas");
    });
    await expect(imagenesGraficas([grafica("tendencia", null)])).resolves.toEqual({});
    expect(mockInstancia.dispose).toHaveBeenCalled();
  });
});
