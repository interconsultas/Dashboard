const mockRegisterTheme = jest.fn();
jest.mock("echarts/core", () => ({ use: jest.fn(), registerTheme: (...a: unknown[]) => mockRegisterTheme(...a) }));
jest.mock("echarts/charts", () => ({}));
jest.mock("echarts/components", () => ({}));
jest.mock("echarts/renderers", () => ({}));

import { NOMBRE_TEMA, TEMA_GRAFICAS } from "@/lib/tema/graficas";
import { COLORES, PALETA_CATEGORICA } from "@/lib/tema/tokens";

describe("tema de ECharts", () => {
  it("se registra una vez al cargar lib/echarts", () => {
    jest.isolateModules(() => {
      require("@/lib/echarts");
    });
    expect(mockRegisterTheme).toHaveBeenCalledTimes(1);
    expect(mockRegisterTheme).toHaveBeenCalledWith(NOMBRE_TEMA, TEMA_GRAFICAS);
  });

  it("la paleta empieza por el azul y el verde del logo", () => {
    expect(TEMA_GRAFICAS.color.slice(0, 2)).toEqual([COLORES.primario, COLORES.acento]);
    expect(TEMA_GRAFICAS.color).toEqual([...PALETA_CATEGORICA]);
  });

  it("usa la tipografía y las tintas de la app", () => {
    expect(TEMA_GRAFICAS.textStyle.fontFamily).toContain("DM Sans");
    expect(TEMA_GRAFICAS.textStyle.color).toBe(COLORES["tinta-2"]);
    expect(TEMA_GRAFICAS.categoryAxis.axisLabel.color).toBe(COLORES["tinta-3"]);
    expect(TEMA_GRAFICAS.valueAxis.splitLine.lineStyle.color).toBe(COLORES.borde);
    expect(TEMA_GRAFICAS.tooltip.backgroundColor).toBe(COLORES.tinta);
  });
});
