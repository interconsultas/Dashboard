/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { PropsGrafico } from "@/components/productividad/Grafico";

const mockGraficos: Record<string, PropsGrafico> = {};
jest.mock("@/components/productividad/Grafico", () => ({
  Grafico: (props: PropsGrafico) => {
    mockGraficos[props.etiqueta] = props;
    return <div role="img" aria-label={props.etiqueta} />;
  },
}));

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...args: unknown[]) => mockUseSWR(...args) }));

import { FichaProfesional } from "@/components/productividad/FichaProfesional";
import { FILTROS_VACIOS } from "@/lib/productividad/filtros";
import { indicadores, metricasVacias } from "@/lib/productividad/metricas";
import type { RespuestaFichaProfesional } from "@/lib/productividad/tipos";

const actual = indicadores({
  ...metricasVacias(),
  ofertadas: 120,
  asignadas: 100,
  confirmadas: 80,
  confirmadas_sin_atencion: 2,
  inasistidas: 20,
  disponibles: 20,
  canceladas: 7,
  bloqueadas: 3,
});

const FICHA: RespuestaFichaProfesional = {
  documento: "1053",
  nombre: "PROFESIONAL UNO",
  area_principal: "Medicina general",
  granularidad: "mensual",
  periodo: "202610",
  etiqueta_periodo: "Octubre 2026",
  actual,
  institucion: { pct_inasistencia: 0.171 },
  percentil: 35,
  pares: 120,
  servicios: [{ codigo: "50103", nombre: "GESTION EPS", ...actual }],
  tendencia: [{ clave: "202610", etiqueta: "Oct 2026", ...actual }],
};

function renderizar(respuesta: Partial<{ data: unknown; error: unknown; isLoading: boolean }> = { data: FICHA }) {
  mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false, ...respuesta });
  const onCerrar = jest.fn();
  render(<FichaProfesional documento="1053" filtros={{ ...FILTROS_VACIOS, area: "Medicina general" }} onCerrar={onCerrar} />);
  return { onCerrar };
}

beforeEach(() => {
  mockUseSWR.mockReset();
  for (const k of Object.keys(mockGraficos)) delete mockGraficos[k];
});

describe("FichaProfesional", () => {
  it("consulta la ficha con el documento y los filtros activos", () => {
    renderizar();
    const url = mockUseSWR.mock.calls[0][0] as string;
    expect(url).toMatch(/^\/api\/productividad\/profesional\?/);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("documento")).toBe("1053");
    expect(params.get("area")).toBe("Medicina general");
  });

  it("es un diálogo modal accesible con el nombre del profesional y recibe el foco", () => {
    renderizar();
    const dialogo = screen.getByRole("dialog", { name: "PROFESIONAL UNO" });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toContainElement(document.activeElement as HTMLElement);
  });

  it("muestra los indicadores, el percentil y el área principal", () => {
    renderizar();
    expect(screen.getByText(/CC 1053/)).toBeInTheDocument();
    expect(screen.getByText(/Medicina general/)).toBeInTheDocument();
    expect(screen.getByText("P35")).toBeInTheDocument();
    expect(screen.getByText("20,0 %")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /servicios/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /tendencia/i })).toBeInTheDocument();
  });

  it("percentil — cuando tiene menos de 50 asignadas", () => {
    renderizar({ data: { ...FICHA, percentil: null } });
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/menos de 50/i)).toBeInTheDocument();
  });

  it("se cierra con Escape, con el fondo y con el botón", () => {
    const { onCerrar } = renderizar();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("ficha-fondo"));
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onCerrar).toHaveBeenCalledTimes(3);
  });

  it("estados de carga y de error", () => {
    renderizar({ isLoading: true });
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it("muestra el error de la consulta", () => {
    renderizar({ error: new Error("Falló la consulta") });
    expect(screen.getByRole("alert")).toHaveTextContent("Falló la consulta");
  });
});
