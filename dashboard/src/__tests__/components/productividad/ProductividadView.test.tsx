/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { PropsGrafico } from "@/components/productividad/Grafico";

const mockPush = jest.fn();
let mockParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/dashboard/productividad",
  useSearchParams: () => mockParams,
}));

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...args: unknown[]) => mockUseSWR(...args) }));

const mockGraficos: Record<string, PropsGrafico> = {};
jest.mock("@/components/productividad/Grafico", () => ({
  Grafico: (props: PropsGrafico) => {
    mockGraficos[props.etiqueta] = props;
    return <div role="img" aria-label={props.etiqueta} />;
  },
}));

import ProductividadView from "@/components/productividad/ProductividadView";
import { RESPUESTA } from "@/test-utils/productividad-fixtures";

function swr(estado: { data?: unknown; error?: unknown; isLoading?: boolean }) {
  mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false, isValidating: false, mutate: jest.fn(), ...estado });
}

/** Query string de la última navegación. */
function ultimaUrl() {
  const url = mockPush.mock.calls[mockPush.mock.calls.length - 1][0] as string;
  return new URLSearchParams(url.split("?")[1] ?? "");
}

describe("ProductividadView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = new URLSearchParams();
    swr({ data: RESPUESTA });
  });

  it("consulta la API con los filtros de la URL", () => {
    mockParams = new URLSearchParams("area=Salud%20oral&periodo=202609");
    render(<ProductividadView />);
    expect(mockUseSWR.mock.calls[0][0]).toBe("/api/productividad?periodo=202609&area=Salud+oral");
  });

  it("sin filtros consulta la API sin query string", () => {
    render(<ProductividadView />);
    expect(mockUseSWR.mock.calls[0][0]).toBe("/api/productividad");
  });

  it("cambiar un filtro navega a la URL con el filtro (historial del navegador)", () => {
    render(<ProductividadView />);
    fireEvent.change(screen.getByLabelText("Área de servicio"), { target: { value: "Salud oral" } });
    expect(mockPush).toHaveBeenCalledWith("/dashboard/productividad?area=Salud+oral", { scroll: false });
  });

  it("elegir un servicio fija también su área", () => {
    render(<ProductividadView />);
    fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "152" } });
    expect(Object.fromEntries(ultimaUrl())).toEqual({ servicio: "152", area: "Salud oral" });
  });

  it("clic en una celda del mapa de calor filtra área y periodo", () => {
    render(<ProductividadView />);
    (mockGraficos["Mapa de calor de inasistencia"].eventos!.click as (p: unknown) => void)({ value: [0, 1, 20, 1, 5] });
    expect(Object.fromEntries(ultimaUrl())).toEqual({ area: "Salud oral", periodo: "202609" });
  });

  it("clic en un punto de la tendencia selecciona el periodo", () => {
    mockParams = new URLSearchParams("area=Salud%20oral");
    render(<ProductividadView />);
    (mockGraficos["Tendencia del % de inasistencia"].eventos!.click as (p: unknown) => void)({ dataIndex: 0 });
    expect(Object.fromEntries(ultimaUrl())).toEqual({ area: "Salud oral", periodo: "202609" });
  });

  it("clic en un servicio del árbol filtra servicio y su área", () => {
    render(<ProductividadView />);
    (mockGraficos["Citas perdidas por área y servicio"].eventos!.click as (p: unknown) => void)({ data: { codigo: "11", name: "CONSULTA" } });
    expect(Object.fromEntries(ultimaUrl())).toEqual({ servicio: "11", area: "Medicina general" });
  });

  it("cambiar de granularidad descarta el periodo elegido", () => {
    mockParams = new URLSearchParams("periodo=202609&area=Salud%20oral");
    swr({ data: { ...RESPUESTA, periodos: { ...RESPUESTA.periodos, semanal: [{ clave: "2026-10-05", etiqueta: "5–11 oct", etiqueta_larga: "5–11 oct 2026", fecha_inicial: "2026-10-05", fecha_final: "2026-10-11" }] } } });
    render(<ProductividadView />);
    fireEvent.click(screen.getByRole("button", { name: "Semanal" }));
    expect(Object.fromEntries(ultimaUrl())).toEqual({ granularidad: "semanal", area: "Salud oral" });
  });

  it("Limpiar filtros vuelve a la URL base", () => {
    mockParams = new URLSearchParams("area=Salud%20oral&profesional=1053");
    render(<ProductividadView />);
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(mockPush).toHaveBeenLastCalledWith("/dashboard/productividad", { scroll: false });
  });

  it("muestra esqueletos mientras carga por primera vez", () => {
    swr({ isLoading: true });
    render(<ProductividadView />);
    expect(screen.getByTestId("productividad-cargando")).toBeInTheDocument();
  });

  it("muestra el error de la API", () => {
    swr({ error: new Error("Error al consultar los datos") });
    render(<ProductividadView />);
    expect(screen.getByRole("alert")).toHaveTextContent("Error al consultar los datos");
  });

  it("sin cargas muestra el estado vacío", () => {
    swr({ data: { ...RESPUESTA, periodo: null, periodos: { mensual: [], semanal: [] }, kpis: { actual: null, anterior: null, periodo_anterior: null, serie: [] } } });
    render(<ProductividadView />);
    expect(screen.getByText(/Aún no hay informes de citas cargados/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("con datos muestra todos los visuales", () => {
    render(<ProductividadView />);
    expect(screen.getByRole("heading", { name: "Productividad" })).toBeInTheDocument();
    for (const nombre of [
      "Tendencia del % de inasistencia",
      "Embudo de la agenda",
      "Mapa de calor de inasistencia",
      "Citas perdidas por área y servicio",
    ]) {
      expect(screen.getByRole("img", { name: nombre })).toBeInTheDocument();
    }
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
