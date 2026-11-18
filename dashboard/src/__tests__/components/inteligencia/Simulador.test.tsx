/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { PropsGrafico } from "@/components/productividad/Grafico";

const mockGraficos: Record<string, PropsGrafico> = {};
jest.mock("@/components/productividad/Grafico", () => ({
  Grafico: (props: PropsGrafico) => {
    mockGraficos[props.etiqueta] = props;
    return <div role="img" aria-label={props.etiqueta} />;
  },
}));

import { SimuladorPalancas } from "@/components/inteligencia/SimuladorPalancas";
import { SimuladorResultados } from "@/components/inteligencia/SimuladorResultados";
import { limitesPalancas, palancasBase, resultadoBase, simular, type Palancas } from "@/lib/inteligencia/simulador";

const BASE = { ofertadas: 1000, disponibles: 100, asignadas: 900, inasistidas: 180, profesionales: 10 };
const REAL = palancasBase(BASE);

function renderPalancas(palancas: Palancas = REAL) {
  const props = { onCambiar: jest.fn(), onRestablecer: jest.fn(), onLlevarMeta: jest.fn() };
  render(
    <SimuladorPalancas palancas={palancas} real={REAL} limites={limitesPalancas(BASE)} profesionalesBase={10} {...props} />
  );
  return props;
}

describe("SimuladorPalancas", () => {
  it("cada palanca tiene un deslizador y un campo numérico con nombre accesible", () => {
    renderPalancas();
    for (const nombre of ["Δ profesionales", "Δ oferta por profesional", "% disponibilidad objetivo", "% inasistencia objetivo"]) {
      expect(screen.getByRole("slider", { name: nombre })).toBeInTheDocument();
      expect(screen.getByRole("spinbutton", { name: `${nombre} (valor)` })).toBeInTheDocument();
    }
    const prof = screen.getByRole("slider", { name: "Δ profesionales" });
    expect(prof).toHaveAttribute("min", "-9");
    expect(prof).toHaveAttribute("max", "5");
  });

  it("muestra el valor real de cada palanca", () => {
    renderPalancas();
    expect(screen.getByText("Real: 10 profesionales")).toBeInTheDocument();
    expect(screen.getByText("Real: 20,0 %")).toBeInTheDocument();
    expect(screen.getByText("Real: 10,0 %")).toBeInTheDocument();
  });

  it("no repite debajo el valor que ya muestra el campo; con profesionales movidos dice el total", () => {
    renderPalancas({ ...REAL, deltaProfesionales: 3, deltaOferta: 0.11 });
    expect(screen.queryByText(/\+3 \(13 en total\)/)).not.toBeInTheDocument();
    expect(screen.queryByText("+11 %")).not.toBeInTheDocument();
    expect(screen.getByText("Real: 10 profesionales · escenario: 13")).toBeInTheDocument();
  });

  it("el deslizador y el campo cambian la palanca (porcentajes en fracción)", () => {
    const { onCambiar } = renderPalancas();
    fireEvent.change(screen.getByRole("slider", { name: "Δ profesionales" }), { target: { value: "3" } });
    expect(onCambiar).toHaveBeenLastCalledWith("deltaProfesionales", 3);
    fireEvent.change(screen.getByRole("spinbutton", { name: "% inasistencia objetivo (valor)" }), { target: { value: "12.5" } });
    expect(onCambiar).toHaveBeenLastCalledWith("pctInasistencia", 0.125);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Δ oferta por profesional (valor)" }), { target: { value: "" } });
    expect(onCambiar).toHaveBeenCalledTimes(2);
  });

  it("Restablecer por palanca solo se activa si se movió; Restablecer todo y Llevar a la meta", () => {
    const { onRestablecer, onLlevarMeta } = renderPalancas({ ...REAL, deltaProfesionales: 2 });
    expect(screen.getByRole("button", { name: "Restablecer % inasistencia objetivo" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Restablecer Δ profesionales" }));
    expect(onRestablecer).toHaveBeenLastCalledWith("deltaProfesionales");
    fireEvent.click(screen.getByRole("button", { name: "Restablecer todo" }));
    expect(onRestablecer).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: /Llevar a la meta/ }));
    expect(onLlevarMeta).toHaveBeenCalled();
  });

  it("sin cambios, Restablecer todo está inactivo", () => {
    renderPalancas();
    expect(screen.getByRole("button", { name: "Restablecer todo" })).toBeDisabled();
  });
});

describe("SimuladorResultados", () => {
  const base = resultadoBase(BASE);
  const escenario = simular(BASE, { ...REAL, deltaProfesionales: 5, pctInasistencia: 0.1 });

  beforeEach(() => {
    for (const k of Object.keys(mockGraficos)) delete mockGraficos[k];
  });

  function renderResultados() {
    return render(<SimuladorResultados base={base} escenario={escenario} resumen="Resumen del escenario." />);
  }

  it("cada tarjeta muestra base → escenario y la diferencia con su sentido", () => {
    renderResultados();
    const atendidas = screen.getByRole("group", { name: "Atendidas" });
    expect(within(atendidas).getByText("720")).toBeInTheDocument();
    expect(within(atendidas).getByText("1.215")).toBeInTheDocument();
    expect(within(atendidas).getByText(/▲ 495/)).toHaveAttribute("data-sentido", "bueno");
    expect(within(atendidas).getByText("(mejora)")).toBeInTheDocument();

    const inasistidas = screen.getByRole("group", { name: "Inasistidas" });
    expect(within(inasistidas).getByText(/▼ 45/)).toHaveAttribute("data-sentido", "bueno");

    const disponibles = screen.getByRole("group", { name: "Disponibles" });
    expect(within(disponibles).getByText(/▲ 50/)).toHaveAttribute("data-sentido", "malo");
    expect(within(disponibles).getByText("(empeora)")).toBeInTheDocument();
  });

  it("muestra el estado frente a la meta con ícono y texto", () => {
    const enMeta = simular(BASE, { ...REAL, deltaProfesionales: 5, pctInasistencia: 0.099 });
    render(<SimuladorResultados base={base} escenario={enMeta} resumen="Resumen del escenario." />);
    const meta = screen.getByRole("group", { name: "Meta de inasistencia" });
    expect(within(meta).getByText("✕ Fuera de la meta")).toBeInTheDocument();
    expect(within(meta).getByText("✓ En la meta")).toBeInTheDocument();
    expect(within(meta).getByText(/91 inasistencias por evitar/)).toBeInTheDocument();
  });

  it("muestra los profesionales equivalentes perdidos", () => {
    renderResultados();
    const perdidas = screen.getByRole("group", { name: "Citas perdidas" });
    expect(within(perdidas).getByText(/2,8 → 2,\d profesionales equivalentes/)).toBeInTheDocument();
  });

  it("grafica Actual vs Escenario y muestra el resumen", () => {
    renderResultados();
    const g = mockGraficos["Actual vs escenario en el periodo"];
    expect(g).toBeDefined();
    expect((g.opcion as any).series).toHaveLength(2);
    expect(screen.getByText("Resumen del escenario.")).toBeInTheDocument();
  });
});
