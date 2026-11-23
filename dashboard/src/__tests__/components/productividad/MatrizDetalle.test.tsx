/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MatrizDetalle } from "@/components/productividad/MatrizDetalle";
import { AREAS, RESPUESTA } from "@/test-utils/productividad-fixtures";

function filas() {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1);
}
function primeraCelda() {
  return filas().map((f) => within(f).getAllByRole("cell")[0].textContent);
}

function renderizar(area: string | null = null) {
  const onServicio = jest.fn();
  render(
    <MatrizDetalle matriz={RESPUESTA.matriz} areas={AREAS} area={area} etiquetaPeriodo="Octubre 2026" onServicio={onServicio} />
  );
  return onServicio;
}

describe("MatrizDetalle", () => {
  it("por defecto: áreas colapsadas ordenadas por citas perdidas y fila de total", () => {
    renderizar();
    expect(primeraCelda()).toEqual([
      expect.stringContaining("Medicina general"),
      expect.stringContaining("Salud oral"),
      "Total Octubre 2026",
    ]);
    expect(within(filas()[0]).getByText("· 2 servicios")).toBeInTheDocument();
    const total = filas()[2];
    expect(within(total).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Total Octubre 2026", "280", "250", "53", "30", "83", "21,2 %", "10,7 %",
    ]);
  });

  it("clic en un área la despliega y vuelve a plegarla", () => {
    renderizar();
    const boton = screen.getByRole("button", { name: /Medicina general/ });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(primeraCelda()).toContain("11 · CONSULTA MEDICINA GENERAL");
    fireEvent.click(boton);
    expect(primeraCelda()).not.toContain("11 · CONSULTA MEDICINA GENERAL");
  });

  it("el área filtrada aparece desplegada", () => {
    renderizar("Salud oral");
    expect(primeraCelda()).toContain("152 · ODONTOLOGIA");
  });

  it("clic en un servicio lo filtra", () => {
    const onServicio = renderizar("Salud oral");
    fireEvent.click(screen.getByText("152 · ODONTOLOGIA"));
    expect(onServicio).toHaveBeenCalledWith("152");
  });

  it("ordenar por columna: primer clic descendente, segundo ascendente", () => {
    renderizar();
    const pinas = screen.getByRole("columnheader", { name: /% Inasistencia/ });
    fireEvent.click(within(pinas).getByRole("button"));
    expect(pinas).toHaveAttribute("aria-sort", "descending");
    expect(primeraCelda()[0]).toContain("Salud oral"); // 30 % > 19 %
    fireEvent.click(within(pinas).getByRole("button"));
    expect(pinas).toHaveAttribute("aria-sort", "ascending");
    expect(primeraCelda()[0]).toContain("Medicina general");
  });

  it("formato condicional en los porcentajes", () => {
    renderizar();
    const celda = within(filas()[1]).getByText("30,0 %");
    expect(celda).toHaveStyle({ color: "#fff" });
  });

  it("sin filas muestra el estado vacío", () => {
    render(
      <MatrizDetalle matriz={{ areas: [], total: null }} areas={AREAS} area={null} etiquetaPeriodo="Octubre 2026" onServicio={jest.fn()} />
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/No hay citas/)).toBeInTheDocument();
  });
});
