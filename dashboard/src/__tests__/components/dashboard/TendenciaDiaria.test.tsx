/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TendenciaDiaria, { diaLabel } from "@/components/dashboard/TendenciaDiaria";

describe("diaLabel", () => {
  it("extrae el numero de dia de un string YYYY-MM-DD", () => {
    expect(diaLabel("2026-09-05")).toBe("5");
    expect(diaLabel("2026-09-15")).toBe("15");
  });

  it("no rompe si pg devuelve la fecha como Date serializado (YYYY-MM-DDTHH:mm:ss.sssZ)", () => {
    // Regresion: node-postgres puede parsear `date` como Date de JS, que
    // JSON.stringify serializa con hora/timezone. Sin el slice defensivo,
    // esto rompia el eje X del grafico mostrando "NaN".
    expect(diaLabel("2026-09-05T00:00:00.000Z")).toBe("5");
    expect(diaLabel("2026-09-15T00:00:00.000Z")).toBe("15");
  });
});

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

  it("muestra el badge de variación cuando hay al menos 2 días con datos", () => {
    render(
      <TendenciaDiaria
        serieDiaria={[
          { dia: "2026-03-01", total: 5, valor_total: 500 },
          { dia: "2026-03-02", total: 10, valor_total: 1000 },
        ]}
      />
    );
    expect(screen.getByText(/variación/)).toBeInTheDocument();
  });

  it("no muestra el badge de variación con un solo día de datos", () => {
    render(
      <TendenciaDiaria
        serieDiaria={[{ dia: "2026-03-01", total: 5, valor_total: 500 }]}
      />
    );
    expect(screen.queryByText(/variación/)).not.toBeInTheDocument();
  });

  it("no muestra el badge de variación cuando todos los datos están en el bucket 'Sin fecha'", () => {
    render(
      <TendenciaDiaria serieDiaria={[{ dia: null, total: 5, valor_total: 500 }]} />
    );
    expect(screen.queryByText(/variación/)).not.toBeInTheDocument();
  });
});
