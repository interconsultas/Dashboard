/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";

const mockBar = jest.fn();
const mockLine = jest.fn();

jest.mock("recharts", () => {
  const Paso = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Nulo = () => null;
  return {
    ResponsiveContainer: Paso,
    BarChart: Paso,
    LineChart: Paso,
    Bar: (props: unknown) => {
      mockBar(props);
      return null;
    },
    Line: (props: unknown) => {
      mockLine(props);
      return null;
    },
    XAxis: Nulo,
    YAxis: Nulo,
    CartesianGrid: Nulo,
    Tooltip: Nulo,
    ReferenceLine: Nulo,
    LabelList: Nulo,
  };
});

import { GraficaGlobalMensual } from "@/components/cumplimiento/GraficaGlobalMensual";
import { TendenciaIndicador } from "@/components/cumplimiento/TendenciaIndicador";
import { ContextoImpresion } from "@/hooks/useImpresion";

// Durante una animación Recharts oculta las etiquetas de las barras y los puntos
// de las líneas: al exportar a PDF las gráficas deben dibujarse sin animación.

const SERIE = [
  { periodo: 202601, valor: 1.3 },
  { periodo: 202602, valor: 0.6 },
];

function ultimaProp(mock: jest.Mock) {
  return (mock.mock.calls[mock.mock.calls.length - 1][0] as { isAnimationActive: boolean }).isAnimationActive;
}

describe("gráficas de cumplimiento al imprimir", () => {
  beforeEach(() => {
    mockBar.mockClear();
    mockLine.mockClear();
  });

  it("en pantalla las gráficas conservan la animación", () => {
    render(
      <>
        <GraficaGlobalMensual serie={SERIE} />
        <TendenciaIndicador etiqueta="Medicamentos" serie={SERIE} />
      </>
    );

    expect(ultimaProp(mockBar)).toBe(true);
    expect(ultimaProp(mockLine)).toBe(true);
  });

  it("en modo de impresión las gráficas se dibujan sin animación", () => {
    render(
      <ContextoImpresion.Provider value={true}>
        <GraficaGlobalMensual serie={SERIE} />
        <TendenciaIndicador etiqueta="Medicamentos" serie={SERIE} />
      </ContextoImpresion.Provider>
    );

    expect(ultimaProp(mockBar)).toBe(false);
    expect(ultimaProp(mockLine)).toBe(false);
  });
});
