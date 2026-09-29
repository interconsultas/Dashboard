/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TendenciaDiaria from "@/components/dashboard/TendenciaDiaria";

describe("TendenciaDiaria", () => {
  it("muestra skeleton cuando loading=true", () => {
    const { container } = render(<TendenciaDiaria serieDiaria={[]} loading />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("muestra estado vacío cuando no hay datos", () => {
    render(<TendenciaDiaria serieDiaria={[]} />);
    expect(screen.getByText(/sin datos/i)).toBeInTheDocument();
  });

  it("muestra el badge 'Sin fecha' con el total correspondiente cuando hay filas sin fecha_atencion", () => {
    render(
      <TendenciaDiaria
        serieDiaria={[
          { dia: "2026-03-01", total: 5, valor_total: 500 },
          { dia: "2026-03-02", total: 3, valor_total: 300 },
          { dia: null, total: 2, valor_total: 0 },
        ]}
      />
    );
    expect(screen.getByText(/Sin fecha/)).toBeInTheDocument();
    expect(screen.getByText(/Sin fecha/).textContent).toContain("2");
  });

  it("no muestra el badge 'Sin fecha' cuando todas las filas tienen fecha", () => {
    render(
      <TendenciaDiaria
        serieDiaria={[
          { dia: "2026-03-01", total: 5, valor_total: 500 },
          { dia: "2026-03-02", total: 3, valor_total: 300 },
        ]}
      />
    );
    expect(screen.queryByText(/Sin fecha/)).not.toBeInTheDocument();
  });

  it("el total del mes mostrado incluye el bucket 'Sin fecha' (cuadra con el KPI mensual)", () => {
    render(
      <TendenciaDiaria
        serieDiaria={[
          { dia: "2026-03-01", total: 5, valor_total: 500 },
          { dia: "2026-03-02", total: 3, valor_total: 300 },
          { dia: null, total: 2, valor_total: 0 },
        ]}
      />
    );
    // 5 + 3 + 2 = 10
    expect(screen.getByText(/Total del mes: 10/)).toBeInTheDocument();
  });
});
