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

import { GraficaTendencia } from "@/components/productividad/GraficaTendencia";
import { GraficaEmbudo } from "@/components/productividad/GraficaEmbudo";
import { MapaCalor } from "@/components/productividad/MapaCalor";
import { ArbolPerdidas } from "@/components/productividad/ArbolPerdidas";
import { AREAS, RESPUESTA } from "@/test-utils/productividad-fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
function clic(etiqueta: string, params: unknown) {
  const g = mockGraficos[etiqueta];
  if (!g?.eventos?.click) throw new Error(`El gráfico ${etiqueta} no tiene manejador de clic`);
  (g.eventos.click as (p: unknown) => void)(params);
}

beforeEach(() => {
  for (const k of Object.keys(mockGraficos)) delete mockGraficos[k];
});

describe("GraficaTendencia", () => {
  it("clic en un punto selecciona ese periodo", () => {
    const onPeriodo = jest.fn();
    render(<GraficaTendencia serie={RESPUESTA.tendencia} seleccionado="202610" onPeriodo={onPeriodo} />);
    expect(screen.getByText("Inasistencia por periodo")).toBeInTheDocument();
    clic("Tendencia del % de inasistencia", { dataIndex: 0 });
    expect(onPeriodo).toHaveBeenCalledWith("202609");
  });

  it("sin periodos muestra el estado vacío", () => {
    render(<GraficaTendencia serie={[]} seleccionado={null} onPeriodo={jest.fn()} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/No hay datos/)).toBeInTheDocument();
  });
});

describe("GraficaEmbudo", () => {
  it("grafica ofertadas → asignadas → atendidas", () => {
    render(<GraficaEmbudo embudo={RESPUESTA.embudo} />);
    const op = mockGraficos["Embudo de la agenda"].opcion as any;
    expect(op.series[0].data.map((d: any) => d.value)).toEqual([280, 250, 197]);
  });

  it("sin citas ofertadas muestra el estado vacío", () => {
    render(<GraficaEmbudo embudo={{ ofertadas: 0, asignadas: 0, atendidas: 0, disponibles: 0, inasistidas: 0 }} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("MapaCalor", () => {
  it("clic en una celda filtra área y periodo", () => {
    const onCelda = jest.fn();
    render(<MapaCalor mapa={RESPUESTA.mapa_calor} area={null} onCelda={onCelda} />);
    clic("Mapa de calor de inasistencia", { value: [1, 0, 19, 38, 200] });
    expect(onCelda).toHaveBeenCalledWith("Medicina general", "202610");
  });

  it("sin celdas muestra el estado vacío", () => {
    render(<MapaCalor mapa={{ ...RESPUESTA.mapa_calor, celdas: [] }} area={null} onCelda={jest.fn()} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("ArbolPerdidas", () => {
  function renderizar(area: string | null = null) {
    const onArea = jest.fn();
    const onServicio = jest.fn();
    render(<ArbolPerdidas arbol={RESPUESTA.arbol} areas={AREAS} area={area} onArea={onArea} onServicio={onServicio} />);
    return { onArea, onServicio };
  }

  it("clic en un área filtra el área", () => {
    const h = renderizar();
    clic("Citas perdidas por área y servicio", { data: { name: "Salud oral", area: "Salud oral" } });
    expect(h.onArea).toHaveBeenCalledWith("Salud oral");
    expect(h.onServicio).not.toHaveBeenCalled();
  });

  it("clic en un servicio filtra el servicio", () => {
    const h = renderizar();
    clic("Citas perdidas por área y servicio", { data: { name: "ODONTOLOGIA", codigo: "152" } });
    expect(h.onServicio).toHaveBeenCalledWith("152");
  });

  it("con un área seleccionada ofrece volver a todas las áreas", () => {
    const h = renderizar("Salud oral");
    fireEvent.click(screen.getByRole("button", { name: /todas las áreas/i }));
    expect(h.onArea).toHaveBeenCalledWith(null);
  });

  it("sin área seleccionada no muestra el botón de volver", () => {
    renderizar();
    expect(screen.queryByRole("button", { name: /todas las áreas/i })).not.toBeInTheDocument();
  });

  it("sin citas perdidas muestra el estado vacío", () => {
    render(<ArbolPerdidas arbol={[]} areas={AREAS} area={null} onArea={jest.fn()} onServicio={jest.fn()} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
