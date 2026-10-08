/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { GrillaCitas } from "@/components/cumplimiento/GrillaCitas";
import type { FilaGrilla } from "@/lib/cumplimiento/grilla-citas";

function fila(parcial: Partial<FilaGrilla> & { documento: string; nombre: string }): FilaGrilla {
  return {
    estado: "ACTIVO",
    programaMeta: null,
    citas: "",
    programa: "",
    guardada: false,
    citasInvalida: false,
    cambiada: false,
    ...parcial,
  };
}

const FILAS = [
  fila({ documento: "10234567", nombre: "PEREZ JUAN", citas: "120", programa: "RCV" }),
  fila({ documento: "30345678", nombre: "GOMEZ ANA" }),
];

function renderGrilla(filas: FilaGrilla[] = FILAS) {
  const onCambiarCitas = jest.fn();
  render(
    <GrillaCitas
      filas={filas}
      onCambiarCitas={onCambiarCitas}
    />
  );
  return { onCambiarCitas };
}

describe("GrillaCitas", () => {
  it("muestra una fila por profesional con nombre, cédula, citas y programa", () => {
    renderGrilla();

    expect(screen.getByText("PEREZ JUAN")).toBeInTheDocument();
    expect(screen.getByText("10234567")).toBeInTheDocument();
    expect(screen.getByLabelText("Citas atendidas de PEREZ JUAN")).toHaveValue("120");
    expect(screen.getByText("RCV")).toBeInTheDocument();
    expect(screen.getByLabelText("Citas atendidas de GOMEZ ANA")).toHaveValue("");
    expect(screen.getByText("Sin asignar")).toBeInTheDocument();
  });

  it("muestra el programa solo como texto, sin controles para cambiarlo", () => {
    renderGrilla();

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("avisa al contenedor cuando cambian las citas", () => {
    const { onCambiarCitas } = renderGrilla();

    fireEvent.change(screen.getByLabelText("Citas atendidas de GOMEZ ANA"), {
      target: { value: "45" },
    });

    expect(onCambiarCitas).toHaveBeenCalledWith("30345678", "45");
  });

  it("marca como inválidas las citas que no son un entero", () => {
    renderGrilla([fila({ documento: "1", nombre: "PEREZ JUAN", citas: "12,5", citasInvalida: true })]);

    expect(screen.getByLabelText("Citas atendidas de PEREZ JUAN")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Ingrese un número entero")).toBeInTheDocument();
  });

  it("señala al profesional que tiene citas pero no tiene programa", () => {
    renderGrilla([fila({ documento: "1", nombre: "PEREZ JUAN", citas: "30", programa: "" })]);

    expect(screen.getByText("Sin programa no hay meta")).toBeInTheDocument();
  });

  it("no señala la falta de programa cuando el profesional no tiene citas", () => {
    renderGrilla([fila({ documento: "1", nombre: "PEREZ JUAN" })]);

    expect(screen.queryByText("Sin programa no hay meta")).not.toBeInTheDocument();
  });

  it("identifica a los profesionales inactivos y a los que no están en el catálogo", () => {
    renderGrilla([
      fila({ documento: "1", nombre: "PEREZ JUAN", estado: "INACTIVO", citas: "5" }),
      fila({ documento: "2", nombre: "GOMEZ ANA", estado: null, citas: "8" }),
    ]);

    expect(screen.getByText("Inactivo")).toBeInTheDocument();
    expect(screen.getByText("Fuera del catálogo")).toBeInTheDocument();
  });

  it("muestra el mensaje indicado cuando no hay filas", () => {
    render(
      <GrillaCitas
        filas={[]}
        mensajeVacio="Sin resultados para esa búsqueda"
        onCambiarCitas={jest.fn()}
      />
    );

    expect(screen.getByText("Sin resultados para esa búsqueda")).toBeInTheDocument();
  });
});
