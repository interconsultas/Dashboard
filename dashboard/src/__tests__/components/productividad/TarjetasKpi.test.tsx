/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/components/productividad/Grafico", () => ({
  Grafico: ({ etiqueta }: { etiqueta: string }) => <div role="img" aria-label={etiqueta} />,
}));

import { TarjetasKpi } from "@/components/productividad/TarjetasKpi";
import { indicadores } from "@/lib/productividad/metricas";
import { RESPUESTA, met } from "@/test-utils/productividad-fixtures";

function tile(nombre: string) {
  return screen.getByRole("group", { name: nombre });
}

describe("TarjetasKpi", () => {
  beforeEach(() => {
    render(<TarjetasKpi kpis={RESPUESTA.kpis} profesionales={RESPUESTA.profesionales} etiquetaAnterior="Sep 2026" />);
  });

  it("muestra los seis indicadores", () => {
    expect(screen.getAllByRole("group")).toHaveLength(6);
    expect(within(tile("Citas ofertadas")).getByText("280")).toBeInTheDocument();
    expect(within(tile("Citas asignadas")).getByText("250")).toBeInTheDocument();
    expect(within(tile("% Inasistencia")).getByText("21,2 %")).toBeInTheDocument();
    expect(within(tile("% Disponibilidad")).getByText("10,7 %")).toBeInTheDocument();
    expect(within(tile("Citas perdidas")).getByText("83")).toBeInTheDocument();
    expect(within(tile("Profesionales con agenda")).getByText("12")).toBeInTheDocument();
  });

  it("asignadas muestra la proporción de lo ofertado", () => {
    expect(within(tile("Citas asignadas")).getByText(/89,3 % de lo ofertado/)).toBeInTheDocument();
  });

  it("inasistencia: insignia de meta y variación en puntos frente al anterior", () => {
    const t = tile("% Inasistencia");
    expect(within(t).getByText(/Sobre meta/)).toBeInTheDocument();
    expect(within(t).getByText("▼ 1 pp")).toBeInTheDocument();
    expect(within(t).getByText(/vs Sep 2026/)).toBeInTheDocument();
  });

  it("ofertadas: variación relativa", () => {
    expect(within(tile("Citas ofertadas")).getByText("▲ 154,5 %")).toBeInTheDocument();
  });

  it("profesionales: destacados con meta", () => {
    expect(within(tile("Profesionales con agenda")).getByText(/3 con inasistencia < 10 %/)).toBeInTheDocument();
  });

  it("las cinco métricas llevan sparkline", () => {
    expect(screen.getAllByRole("img")).toHaveLength(5);
  });
});

describe("TarjetasKpi — casos borde", () => {
  it("bajo la meta muestra la insignia de cumplimiento; sin anterior no hay variación", () => {
    const actual = indicadores(met(100, 100, 5, 0));
    render(
      <TarjetasKpi
        kpis={{ actual, anterior: null, periodo_anterior: null, serie: [{ clave: "1", etiqueta: "Oct", ...actual }] }}
        profesionales={{ con_agenda: 0, destacados: 0, lista: [] }}
        etiquetaAnterior={null}
      />
    );
    expect(within(tile("% Inasistencia")).getByText(/Meta/)).toBeInTheDocument();
    expect(screen.queryByText(/vs /)).not.toBeInTheDocument();
  });
});
