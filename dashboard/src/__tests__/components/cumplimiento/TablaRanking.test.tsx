/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TablaRanking } from "@/components/cumplimiento/TablaRanking";
import type { ProfesionalCumplimiento } from "@/lib/cumplimiento/calcular";

function prof(parcial: Partial<ProfesionalCumplimiento> & { documento: string; nombre: string }): ProfesionalCumplimiento {
  return { programa: "RCV", citas: 0, periodosConDatos: 1, pct: {}, global: null, ...parcial };
}

const LISTA = [
  prof({ documento: "10234567", nombre: "PEREZ JUAN", programa: "RCV", citas: 1400, global: 1.25, pct: { medicamentos: 1.5, rx: 1 } }),
  prof({ documento: "30345678", nombre: "GOMEZ ANA", programa: "CPR", citas: 200, global: 0.25, pct: { medicamentos: 0.5, rx: 0 } }),
  prof({ documento: "40456789", nombre: "ARIAS LUZ", programa: null, citas: 50, global: null, pct: {} }),
];

function filas() {
  return screen.getAllByRole("row").slice(1);
}

function nombres() {
  return filas().map((f) => within(f).getAllByRole("cell")[0].textContent);
}

describe("TablaRanking", () => {
  it("muestra las columnas Profesional, Programa, Citas, Global y las 7 categorías", () => {
    render(<TablaRanking profesionales={LISTA} onSeleccionar={jest.fn()} />);

    const encabezados = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(encabezados).toEqual([
      "Profesional",
      "Programa",
      "Citas",
      "Global",
      "Medicamentos",
      "Laboratorios",
      "Proc. dx no capitados",
      "Radiografías",
      "Ecografías capitadas",
      "Remisiones capitadas",
      "Remisiones red externa",
    ]);
  });

  it("por defecto ordena por global descendente con las filas sin dato al final", () => {
    render(<TablaRanking profesionales={LISTA} onSeleccionar={jest.fn()} />);

    expect(nombres()).toEqual([
      expect.stringContaining("PEREZ JUAN"),
      expect.stringContaining("GOMEZ ANA"),
      expect.stringContaining("ARIAS LUZ"),
    ]);
    expect(screen.getByRole("columnheader", { name: /Global/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("muestra nombre, cédula, programa, citas y porcentajes de cada fila", () => {
    render(<TablaRanking profesionales={LISTA} onSeleccionar={jest.fn()} />);

    const [perez, , arias] = filas();
    expect(within(perez).getByText("10234567")).toBeInTheDocument();
    expect(within(perez).getByText("RCV")).toBeInTheDocument();
    expect(within(perez).getByText("1.400")).toBeInTheDocument();
    expect(within(perez).getByText("125%")).toBeInTheDocument();
    expect(within(perez).getByText("150%")).toBeInTheDocument();
    expect(within(perez).getByText("100%")).toBeInTheDocument();

    expect(within(arias).getByText("Sin programa")).toBeInTheDocument();
    // Global y las 7 categorías sin dato
    expect(within(arias).getAllByTitle("Sin datos")).toHaveLength(8);
  });

  it("al hacer clic en el encabezado activo invierte la dirección y mantiene al final las filas sin dato", () => {
    render(<TablaRanking profesionales={LISTA} onSeleccionar={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Global/ }));

    expect(nombres()).toEqual([
      expect.stringContaining("GOMEZ ANA"),
      expect.stringContaining("PEREZ JUAN"),
      expect.stringContaining("ARIAS LUZ"),
    ]);
    expect(screen.getByRole("columnheader", { name: /Global/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("permite ordenar por cualquier otra columna", () => {
    render(<TablaRanking profesionales={LISTA} onSeleccionar={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Profesional/ }));
    expect(nombres()).toEqual([
      expect.stringContaining("ARIAS LUZ"),
      expect.stringContaining("GOMEZ ANA"),
      expect.stringContaining("PEREZ JUAN"),
    ]);
    expect(screen.getByRole("columnheader", { name: /Global/ })).toHaveAttribute("aria-sort", "none");

    fireEvent.click(screen.getByRole("button", { name: /Citas/ }));
    expect(nombres()[0]).toContain("PEREZ JUAN");

    fireEvent.click(screen.getByRole("button", { name: /Medicamentos/ }));
    expect(nombres()).toEqual([
      expect.stringContaining("PEREZ JUAN"),
      expect.stringContaining("GOMEZ ANA"),
      expect.stringContaining("ARIAS LUZ"),
    ]);
  });

  it("al hacer clic en una fila selecciona a ese profesional", () => {
    const onSeleccionar = jest.fn();
    render(<TablaRanking profesionales={LISTA} onSeleccionar={onSeleccionar} />);

    fireEvent.click(filas()[1]);

    expect(onSeleccionar).toHaveBeenCalledTimes(1);
    expect(onSeleccionar).toHaveBeenCalledWith("30345678");
  });

  it("el nombre es un botón accesible por teclado que selecciona al profesional una sola vez", () => {
    const onSeleccionar = jest.fn();
    render(<TablaRanking profesionales={LISTA} onSeleccionar={onSeleccionar} />);

    fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de PEREZ JUAN/ }));

    expect(onSeleccionar).toHaveBeenCalledTimes(1);
    expect(onSeleccionar).toHaveBeenCalledWith("10234567");
  });

  it("muestra un mensaje cuando no hay profesionales", () => {
    render(<TablaRanking profesionales={[]} onSeleccionar={jest.fn()} />);

    expect(screen.getByText("Sin profesionales para los filtros seleccionados")).toBeInTheDocument();
  });
});
