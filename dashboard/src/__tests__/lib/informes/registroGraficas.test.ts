import { capturarGrafica, registrarGrafica } from "@/lib/informes/registroGraficas";

const grafica = (url = "data:image/png;base64,AAA", eliminada = false) => ({
  getDataURL: jest.fn(() => url),
  isDisposed: () => eliminada,
});

describe("registro de gráficas en pantalla", () => {
  it("captura la gráfica registrada en PNG a doble resolución y fondo blanco", () => {
    const g = grafica();
    const quitar = registrarGrafica("Embudo", g);
    expect(capturarGrafica("Embudo")).toBe("data:image/png;base64,AAA");
    expect(g.getDataURL).toHaveBeenCalledWith({ type: "png", pixelRatio: 2, backgroundColor: "#fff" });
    quitar();
    expect(capturarGrafica("Embudo")).toBeNull();
  });

  it("null si no está montada o ya se eliminó", () => {
    expect(capturarGrafica("Otra")).toBeNull();
    const quitar = registrarGrafica("Eliminada", grafica("x", true));
    expect(capturarGrafica("Eliminada")).toBeNull();
    quitar();
  });

  it("al desmontar una instancia vieja no borra la que la reemplazó", () => {
    const quitarVieja = registrarGrafica("Tendencia", grafica("vieja"));
    const quitarNueva = registrarGrafica("Tendencia", grafica("nueva"));
    quitarVieja();
    expect(capturarGrafica("Tendencia")).toBe("nueva");
    quitarNueva();
  });

  it("null si la captura falla", () => {
    const quitar = registrarGrafica("Rota", { getDataURL: () => { throw new Error("canvas"); } });
    expect(capturarGrafica("Rota")).toBeNull();
    quitar();
  });
});
