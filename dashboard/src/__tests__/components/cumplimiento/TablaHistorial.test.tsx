/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TablaHistorial } from "@/components/cumplimiento/TablaHistorial";
import { calcularFila, type FilaCumplimiento } from "@/lib/cumplimiento/calcular";

function fila(
  periodo: number,
  citas: number | null,
  programa: string | null,
  ordenes: Record<string, number>,
  metas: Record<string, number>
): FilaCumplimiento {
  return {
    documento: "10234567",
    nombre: "PEREZ JUAN",
    periodo,
    citas,
    programa,
    ...calcularFila({ citas, ordenes, metaDe: (c) => metas[c] ?? null }),
  };
}

const FILAS = [
  fila(202601, 335, "RCV", { medicamentos: 3515, rx: 11 }, { medicamentos: 5.746656734947238, rx: 1.7693358162631905 }),
  fila(202602, null, "RCV", { medicamentos: 80 }, { medicamentos: 5.746656734947238 }),
  fila(202603, 1200, null, { medicamentos: 300 }, {}),
];

function filasCuerpo() {
  const [, cuerpo] = screen.getAllByRole("rowgroup");
  return within(cuerpo).getAllByRole("row");
}

describe("TablaHistorial", () => {
  it("muestra una fila por periodo en orden cronológico", () => {
    render(<TablaHistorial filas={[FILAS[2], FILAS[0], FILAS[1]]} />);

    const periodos = filasCuerpo().map((f) => within(f).getByRole("rowheader").textContent);
    expect(periodos).toEqual(["Ene 2026", "Feb 2026", "Mar 2026"]);
  });

  it("agrupa las columnas por categoría con órdenes, tasa, meta y porcentaje", () => {
    render(<TablaHistorial filas={FILAS} />);

    const grupos = screen
      .getAllByRole("columnheader")
      .filter((th) => th.getAttribute("colspan") === "4")
      .map((th) => th.textContent);
    expect(grupos).toEqual([
      "Medicamentos",
      "Laboratorios",
      "Proc. dx no capitados",
      "Radiografías",
      "Ecografías capitadas",
      "Remisiones capitadas",
      "Remisiones red externa",
    ]);
    expect(screen.getAllByRole("columnheader", { name: "Órdenes" })).toHaveLength(7);
    expect(screen.getAllByRole("columnheader", { name: "Tasa" })).toHaveLength(7);
    expect(screen.getAllByRole("columnheader", { name: "Meta" })).toHaveLength(7);
    expect(screen.getAllByRole("columnheader", { name: "%" })).toHaveLength(7);
  });

  it("muestra citas, programa, global y el detalle de cada categoría", () => {
    render(<TablaHistorial filas={FILAS} />);

    const celdas = within(filasCuerpo()[0]).getAllByRole("cell").map((c) => c.textContent);
    // Citas, Programa, Global y luego Medicamentos: órdenes, tasa, meta, %
    expect(celdas.slice(0, 3)).toEqual(["335", "RCV", expect.stringContaining("184%")]);
    expect(celdas.slice(3, 7)).toEqual(["3.515", "10,49", "5,75", expect.stringContaining("183%")]);
    // Laboratorios: sin órdenes y sin meta → 0 órdenes, tasa 0 y sin porcentaje
    expect(celdas.slice(7, 11)).toEqual(["0", "0,00", "—", "—"]);
    expect(celdas).toHaveLength(3 + 7 * 4);
  });

  it("un mes sin citas queda sin datos, no en cero", () => {
    render(<TablaHistorial filas={FILAS} />);

    const fila = filasCuerpo()[1];
    const celdas = within(fila).getAllByRole("cell").map((c) => c.textContent);
    expect(celdas.slice(0, 3)).toEqual(["—", "RCV", "—"]);
    // Las órdenes y la meta se conservan; la tasa y el porcentaje no existen
    expect(celdas.slice(3, 7)).toEqual(["80", "—", "5,75", "—"]);
  });

  it("un mes sin programa lo indica y no muestra porcentajes", () => {
    render(<TablaHistorial filas={FILAS} />);

    const fila = filasCuerpo()[2];
    expect(within(fila).getByText("Sin programa")).toBeInTheDocument();
    const celdas = within(fila).getAllByRole("cell").map((c) => c.textContent);
    expect(celdas[0]).toBe("1.200");
    expect(celdas.slice(3, 7)).toEqual(["300", "0,25", "—", "—"]);
  });

  it("la tabla se desplaza horizontalmente dentro de su tarjeta", () => {
    render(<TablaHistorial filas={FILAS} />);

    expect(screen.getByRole("table").parentElement).toHaveClass("overflow-x-auto");
  });

  it("muestra un mensaje cuando no hay periodos", () => {
    render(<TablaHistorial filas={[]} />);

    expect(screen.getByText("Sin periodos para mostrar")).toBeInTheDocument();
  });
});
