/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SelectorProfesional } from "@/components/cumplimiento/SelectorProfesional";

const LISTA = [
  { documento: "30345678", nombre: "GOMEZ ANA" },
  { documento: "10234567", nombre: "PÉREZ JUAN" },
];

function abrir() {
  fireEvent.click(screen.getByRole("button", { name: /Profesional/ }));
}

function opciones() {
  return screen.getAllByRole("option").map((o) => o.textContent);
}

describe("SelectorProfesional", () => {
  it("sin selección muestra 'Todos los profesionales'", () => {
    render(<SelectorProfesional profesionales={LISTA} seleccionado={null} onCambiar={jest.fn()} />);

    expect(screen.getByRole("button", { name: /Profesional/ })).toHaveTextContent("Todos los profesionales");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("muestra el nombre del profesional seleccionado", () => {
    render(<SelectorProfesional profesionales={LISTA} seleccionado="10234567" onCambiar={jest.fn()} />);

    expect(screen.getByRole("button", { name: /Profesional/ })).toHaveTextContent("PÉREZ JUAN");
  });

  it("al abrir lista 'Todos los profesionales' y cada profesional con su cédula", () => {
    render(<SelectorProfesional profesionales={LISTA} seleccionado={null} onCambiar={jest.fn()} />);
    abrir();

    expect(opciones()).toEqual(["Todos los profesionales", "GOMEZ ANA30345678", "PÉREZ JUAN10234567"]);
  });

  it("busca por nombre sin distinguir tildes", () => {
    render(<SelectorProfesional profesionales={LISTA} seleccionado={null} onCambiar={jest.fn()} />);
    abrir();

    fireEvent.change(screen.getByPlaceholderText("Buscar por nombre o cédula…"), { target: { value: "perez" } });

    expect(opciones()).toEqual(["Todos los profesionales", "PÉREZ JUAN10234567"]);
  });

  it("busca por cédula", () => {
    render(<SelectorProfesional profesionales={LISTA} seleccionado={null} onCambiar={jest.fn()} />);
    abrir();

    fireEvent.change(screen.getByPlaceholderText("Buscar por nombre o cédula…"), { target: { value: "3034" } });

    expect(opciones()).toEqual(["Todos los profesionales", "GOMEZ ANA30345678"]);
  });

  it("indica cuando la búsqueda no tiene resultados", () => {
    render(<SelectorProfesional profesionales={LISTA} seleccionado={null} onCambiar={jest.fn()} />);
    abrir();

    fireEvent.change(screen.getByPlaceholderText("Buscar por nombre o cédula…"), { target: { value: "xyz" } });

    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("al elegir un profesional avisa con su cédula y cierra la lista", () => {
    const onCambiar = jest.fn();
    render(<SelectorProfesional profesionales={LISTA} seleccionado={null} onCambiar={onCambiar} />);
    abrir();

    fireEvent.click(screen.getByRole("option", { name: /GOMEZ ANA/ }));

    expect(onCambiar).toHaveBeenCalledWith("30345678");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("'Todos los profesionales' limpia la selección", () => {
    const onCambiar = jest.fn();
    render(<SelectorProfesional profesionales={LISTA} seleccionado="10234567" onCambiar={onCambiar} />);
    abrir();

    fireEvent.click(screen.getByRole("option", { name: "Todos los profesionales" }));

    expect(onCambiar).toHaveBeenCalledWith(null);
  });

  it("marca la opción seleccionada", () => {
    render(<SelectorProfesional profesionales={LISTA} seleccionado="10234567" onCambiar={jest.fn()} />);
    abrir();

    expect(screen.getByRole("option", { name: /PÉREZ JUAN/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Todos los profesionales" })).toHaveAttribute("aria-selected", "false");
  });

  it("se cierra con Escape", () => {
    render(<SelectorProfesional profesionales={LISTA} seleccionado={null} onCambiar={jest.fn()} />);
    abrir();

    fireEvent.keyDown(screen.getByPlaceholderText("Buscar por nombre o cédula…"), { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
