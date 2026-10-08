/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { GraficaGlobalMensual, techoEje } from "@/components/cumplimiento/GraficaGlobalMensual";
import { TendenciaIndicador } from "@/components/cumplimiento/TendenciaIndicador";

// Las gráficas se prueban por los datos que reciben (tabla equivalente), no por el SVG de Recharts.

const SERIE = [
  { periodo: 202603, valor: 0.6 },
  { periodo: 202601, valor: 1.3683164589470311 },
  { periodo: 202602, valor: null },
];

function filasTabla() {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1).map((f) => f.textContent);
}

describe("techoEje", () => {
  it("deja siempre visible la línea del 100%", () => {
    expect(techoEje(0)).toBe(120);
    expect(techoEje(60)).toBe(120);
    expect(techoEje(100)).toBe(120);
  });

  it("crece en pasos de 20 puntos cuando los datos superan el 120%", () => {
    expect(techoEje(137)).toBe(140);
    expect(techoEje(186)).toBe(200);
  });
});

describe("GraficaGlobalMensual", () => {
  it("muestra el título y la referencia de la meta", () => {
    render(<GraficaGlobalMensual serie={SERIE} />);

    expect(screen.getByText("Cumplimiento global por mes")).toBeInTheDocument();
    expect(screen.getByText(/Meta 100%/)).toBeInTheDocument();
  });

  it("expone los mismos datos de la gráfica en una tabla, en orden cronológico", () => {
    render(<GraficaGlobalMensual serie={SERIE} />);

    expect(filasTabla()).toEqual(["Ene 2026137%", "Feb 2026—", "Mar 202660%"]);
  });

  it("muestra el estado vacío cuando ningún mes tiene dato", () => {
    render(<GraficaGlobalMensual serie={[{ periodo: 202601, valor: null }]} />);

    expect(screen.getByText("Sin datos para mostrar la gráfica")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay meses", () => {
    render(<GraficaGlobalMensual serie={[]} />);

    expect(screen.getByText("Sin datos para mostrar la gráfica")).toBeInTheDocument();
  });

  it("muestra un esqueleto mientras carga", () => {
    const { container } = render(<GraficaGlobalMensual serie={[]} loading />);

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });
});

describe("TendenciaIndicador", () => {
  it("muestra la etiqueta del indicador y el valor del último mes con dato", () => {
    render(<TendenciaIndicador etiqueta="Medicamentos" serie={SERIE} />);

    expect(screen.getByText("Medicamentos")).toBeInTheDocument();
    expect(screen.getByTestId("ultimo-valor")).toHaveTextContent("60%");
    expect(screen.getByTestId("ultimo-valor")).toHaveTextContent("Mar 2026");
  });

  it("expone los datos de la línea en una tabla, en orden cronológico", () => {
    render(<TendenciaIndicador etiqueta="Medicamentos" serie={SERIE} />);

    expect(filasTabla()).toEqual(["Ene 2026137%", "Feb 2026—", "Mar 202660%"]);
  });

  it("sin ningún dato muestra 'Sin datos' en lugar de la gráfica", () => {
    render(<TendenciaIndicador etiqueta="Ecografías capitadas" serie={[{ periodo: 202601, valor: null }]} />);

    expect(screen.getByText("Ecografías capitadas")).toBeInTheDocument();
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
