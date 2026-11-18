/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { PropsGrafico } from "@/components/productividad/Grafico";

// ECharts no corre en jsdom: se reemplaza el gráfico por un stub que guarda sus props
const mockGraficos: Record<string, PropsGrafico> = {};
jest.mock("@/components/productividad/Grafico", () => ({
  Grafico: (props: PropsGrafico) => {
    mockGraficos[props.etiqueta] = props;
    return <div role="img" aria-label={props.etiqueta} />;
  },
}));

import { DispersionProfesionales } from "@/components/productividad/DispersionProfesionales";
import { ParetoPerdidas } from "@/components/productividad/ParetoPerdidas";
import { indicadores, metricasVacias } from "@/lib/productividad/metricas";
import type { ResumenProfesional } from "@/lib/productividad/tipos";

/* eslint-disable @typescript-eslint/no-explicit-any */
function clic(etiqueta: string, params: unknown) {
  const g = mockGraficos[etiqueta];
  if (!g?.eventos?.click) throw new Error(`El gráfico ${etiqueta} no tiene manejador de clic`);
  (g.eventos.click as (p: unknown) => void)(params);
}

function prof(documento: string, asignadas: number, inasistidas: number, disponibles = 0): ResumenProfesional {
  return {
    documento,
    nombre: `PROFESIONAL ${documento}`,
    area_principal: "Medicina general",
    ...indicadores({ ...metricasVacias(), ofertadas: asignadas + disponibles, asignadas, inasistidas, disponibles }),
  };
}

beforeEach(() => {
  for (const k of Object.keys(mockGraficos)) delete mockGraficos[k];
});

describe("DispersionProfesionales", () => {
  const lista = [prof("1", 100, 10, 5), prof("2", 19, 5, 30), prof("3", 300, 60, 40)];

  it("dibuja solo a quienes tienen 20 o más asignadas y explica el umbral", () => {
    render(<DispersionProfesionales lista={lista} onFicha={jest.fn()} />);
    expect(screen.getByText(/20 o más citas asignadas/)).toBeInTheDocument();
    const op = mockGraficos["Dispersión de profesionales"].opcion as any;
    expect(op.series[0].data.map((d: any) => d.documento)).toEqual(["1", "3"]);
  });

  it("clic en un punto abre la ficha de ese profesional", () => {
    const onFicha = jest.fn();
    render(<DispersionProfesionales lista={lista} onFicha={onFicha} />);
    clic("Dispersión de profesionales", { data: { documento: "3" } });
    expect(onFicha).toHaveBeenCalledWith("3");
  });

  it("sin profesionales elegibles muestra el estado vacío", () => {
    render(<DispersionProfesionales lista={[prof("2", 19, 5)]} onFicha={jest.fn()} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/Ningún profesional/)).toBeInTheDocument();
  });
});

describe("ParetoPerdidas", () => {
  // Perdidas: A 50, B 30, C 15, D 5 → 2 de 4 concentran el 80 % de 100
  const lista = [prof("C", 10, 5, 10), prof("A", 100, 20, 30), prof("D", 10, 5, 0), prof("B", 50, 10, 20)];

  it("resume cuántos profesionales concentran el 80 % de las citas perdidas", () => {
    render(<ParetoPerdidas lista={lista} onFicha={jest.fn()} />);
    expect(screen.getByText(/de 4 profesionales concentran el 80 % de las 100 citas perdidas/)).toHaveTextContent(/^2 de 4/);
  });

  it("clic en una barra abre la ficha del profesional de esa fila", () => {
    const onFicha = jest.fn();
    render(<ParetoPerdidas lista={lista} onFicha={onFicha} />);
    clic("Pareto de citas perdidas", { dataIndex: 1 });
    expect(onFicha).toHaveBeenCalledWith("B");
  });

  it("sin citas perdidas muestra el estado vacío", () => {
    render(<ParetoPerdidas lista={[prof("1", 10, 0)]} onFicha={jest.fn()} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/No hay citas perdidas/)).toBeInTheDocument();
  });
});
