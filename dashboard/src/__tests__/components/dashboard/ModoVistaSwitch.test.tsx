/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ModoVistaSwitch from "@/components/dashboard/ModoVistaSwitch";

describe("ModoVistaSwitch", () => {
  it("marca el botón 'Mes' como activo cuando modo='mes'", () => {
    render(<ModoVistaSwitch modo="mes" onChange={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Mes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Día" })).toHaveAttribute("aria-pressed", "false");
  });

  it("marca el botón 'Día' como activo cuando modo='dia'", () => {
    render(<ModoVistaSwitch modo="dia" onChange={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Día" })).toHaveAttribute("aria-pressed", "true");
  });

  it("llama a onChange con el modo contrario al hacer click", () => {
    const onChange = jest.fn();
    render(<ModoVistaSwitch modo="mes" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Día" }));
    expect(onChange).toHaveBeenCalledWith("dia");
  });

  it("no llama a onChange si ya está en ese modo", () => {
    const onChange = jest.fn();
    render(<ModoVistaSwitch modo="mes" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Mes" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("deshabilita el botón 'Día' cuando disabled=true y no dispara onChange", () => {
    const onChange = jest.fn();
    render(<ModoVistaSwitch modo="mes" onChange={onChange} disabled disabledReason="Seleccioná el mismo mes en Desde y Hasta" />);
    const btnDia = screen.getByRole("button", { name: "Día" });
    expect(btnDia).toBeDisabled();
    fireEvent.click(btnDia);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("muestra disabledReason como title cuando está deshabilitado", () => {
    render(<ModoVistaSwitch modo="mes" onChange={jest.fn()} disabled disabledReason="Seleccioná el mismo mes en Desde y Hasta" />);
    expect(screen.getByRole("button", { name: "Día" })).toHaveAttribute(
      "title",
      "Seleccioná el mismo mes en Desde y Hasta"
    );
  });
});
