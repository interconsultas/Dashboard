/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/lib/echarts", () => ({ echarts: { marcador: "echarts-modular" }, NOMBRE_TEMA: "interconsultas" }));

const mockReactECharts = jest.fn((_props: Record<string, unknown>) => <canvas />);
jest.mock("echarts-for-react/lib/core", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockReactECharts(props),
}));

import GraficoCliente from "@/components/productividad/GraficoCliente";
import { capturarGrafica } from "@/lib/informes/registroGraficas";

describe("GraficoCliente", () => {
  beforeEach(() => mockReactECharts.mockClear());

  it("aplica el tema único de la app", () => {
    render(<GraficoCliente opcion={{}} etiqueta="Tema" />);
    expect(mockReactECharts.mock.calls[0][0]).toMatchObject({ theme: "interconsultas" });
  });

  it("usa el ECharts modular y pasa opción, eventos y onListo sin fusionar opciones", () => {
    const click = jest.fn();
    const onListo = jest.fn();
    render(<GraficoCliente opcion={{ series: [] }} etiqueta="Prueba" eventos={{ click }} onListo={onListo} />);

    expect(screen.getByRole("img", { name: "Prueba" })).toBeInTheDocument();
    const props = mockReactECharts.mock.calls[0][0];
    expect(props).toMatchObject({
      echarts: { marcador: "echarts-modular" },
      option: { series: [] },
      notMerge: true,
      onEvents: { click },
    });
    const chart = { resize: jest.fn() };
    (props.onChartReady as (c: unknown) => void)(chart);
    expect(onListo).toHaveBeenCalledWith(chart);
  });

  it("redimensiona la gráfica cuando cambia el tamaño de su contenedor", () => {
    let alCambiar: () => void = () => {};
    const observe = jest.fn();
    const disconnect = jest.fn();
    const original = global.ResizeObserver;
    global.ResizeObserver = jest.fn((cb: () => void) => {
      alCambiar = cb;
      return { observe, disconnect, unobserve: jest.fn() };
    }) as unknown as typeof ResizeObserver;

    const { unmount } = render(<GraficoCliente opcion={{}} etiqueta="Tamaño" />);
    const chart = { resize: jest.fn() };
    act(() => (mockReactECharts.mock.calls[0][0].onChartReady as (c: unknown) => void)(chart));
    expect(observe).toHaveBeenCalledWith(screen.getByRole("img", { name: "Tamaño" }));

    act(() => alCambiar());
    expect(chart.resize).toHaveBeenCalledTimes(1);

    unmount();
    expect(disconnect).toHaveBeenCalled();
    global.ResizeObserver = original;
  });

  it("registra la gráfica por su etiqueta para el PDF y la quita al desmontar", () => {
    const { unmount } = render(<GraficoCliente opcion={{}} etiqueta="Embudo de la agenda" />);
    const chart = { resize: jest.fn(), getDataURL: jest.fn(() => "data:image/png;base64,EMB") };
    act(() => (mockReactECharts.mock.calls[0][0].onChartReady as (c: unknown) => void)(chart));
    expect(capturarGrafica("Embudo de la agenda")).toBe("data:image/png;base64,EMB");
    unmount();
    expect(capturarGrafica("Embudo de la agenda")).toBeNull();
  });
});
