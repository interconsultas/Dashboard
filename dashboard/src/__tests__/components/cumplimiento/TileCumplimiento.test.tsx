/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PorcentajeMeta } from "@/components/cumplimiento/PorcentajeMeta";
import { TileCumplimiento } from "@/components/cumplimiento/TileCumplimiento";
import { TarjetasCumplimiento } from "@/components/cumplimiento/TarjetasCumplimiento";

describe("PorcentajeMeta", () => {
  it("sin dato muestra una raya con el título 'Sin datos'", () => {
    render(<PorcentajeMeta valor={null} />);

    const raya = screen.getByText("—");
    expect(raya).toHaveAttribute("title", "Sin datos");
  });

  it("por encima del 100% indica 'sobre la meta' con texto e ícono, no solo con color", () => {
    const { container } = render(<PorcentajeMeta valor={1.3683164589470311} />);

    expect(screen.getByText("137%")).toBeInTheDocument();
    expect(screen.getByText(/sobre la meta/i)).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.firstChild).toHaveAttribute("title", "Sobre la meta");
  });

  it("en el 100% o por debajo indica 'dentro de la meta' y no muestra el ícono de alerta", () => {
    const { container } = render(<PorcentajeMeta valor={0.5952659544331487} />);

    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText(/dentro de la meta/i)).toBeInTheDocument();
    expect(screen.queryByText(/sobre la meta/i)).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("un 0% es un valor válido, no 'sin datos'", () => {
    render(<PorcentajeMeta valor={0} />);

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.queryByTitle("Sin datos")).not.toBeInTheDocument();
  });
});

describe("TileCumplimiento", () => {
  it("muestra la etiqueta, el porcentaje y el estado frente a la meta", () => {
    render(<TileCumplimiento etiqueta="Medicamentos" valor={1.825850715882227} />);

    expect(screen.getByText("Medicamentos")).toBeInTheDocument();
    expect(screen.getByText("183%")).toBeInTheDocument();
    expect(screen.getByText("Sobre la meta")).toBeInTheDocument();
  });

  it("muestra 'Dentro de la meta' cuando el valor no supera el 100%", () => {
    render(<TileCumplimiento etiqueta="Remisiones capitadas" valor={0.6314279443120532} />);

    expect(screen.getByText("63%")).toBeInTheDocument();
    expect(screen.getByText("Dentro de la meta")).toBeInTheDocument();
  });

  it("sin dato muestra una raya y 'Sin datos'", () => {
    render(<TileCumplimiento etiqueta="Ecografías capitadas" valor={null} />);

    expect(screen.getByText("—")).toHaveAttribute("title", "Sin datos");
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(screen.queryByText(/la meta$/i)).not.toBeInTheDocument();
  });

  it("muestra la nota cuando se indica", () => {
    render(<TileCumplimiento etiqueta="Cumplimiento global" valor={1} nota="Meta <100%" destacado />);

    expect(screen.getByText("Meta <100%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Dentro de la meta")).toBeInTheDocument();
  });
});

describe("TarjetasCumplimiento", () => {
  const RESUMEN = {
    global: 1.3683164589470311,
    pct: {
      medicamentos: 1.825850715882227,
      laboratorios: 1.8144266008611212,
      proc_dx: 1.0663706407958125,
      rx: 1.8558275141273706,
      ecografias: null,
      remisiones_cap: 0.6314279443120532,
      remisiones_ext: 0.5952659544331487,
    },
  };

  it("muestra el tile global con la nota 'Meta <100%' y un tile por cada una de las 7 categorías", () => {
    render(<TarjetasCumplimiento resumen={RESUMEN} />);

    const global = screen.getByTestId("tile-global");
    expect(within(global).getByText("Cumplimiento global")).toBeInTheDocument();
    expect(within(global).getByText("137%")).toBeInTheDocument();
    expect(within(global).getByText("Meta <100%")).toBeInTheDocument();

    for (const etiqueta of [
      "Medicamentos",
      "Laboratorios",
      "Proc. dx no capitados",
      "Radiografías",
      "Ecografías capitadas",
      "Remisiones capitadas",
      "Remisiones red externa",
    ]) {
      expect(screen.getByText(etiqueta)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId("tile-categoria")).toHaveLength(7);
    // La nota de la meta solo acompaña al tile global
    expect(screen.getAllByText("Meta <100%")).toHaveLength(1);
  });

  it("muestra cada categoría con su valor", () => {
    render(<TarjetasCumplimiento resumen={RESUMEN} />);

    const tiles = screen.getAllByTestId("tile-categoria");
    expect(within(tiles[0]).getByText("183%")).toBeInTheDocument();
    expect(within(tiles[4]).getByText("—")).toBeInTheDocument();
    expect(within(tiles[6]).getByText("60%")).toBeInTheDocument();
  });

  it("muestra esqueletos mientras carga", () => {
    const { container } = render(<TarjetasCumplimiento resumen={null} loading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBe(8);
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
