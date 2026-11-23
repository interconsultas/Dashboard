/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Semaforo, colorTasa } from "@/components/ui/Semaforo";
import { COLORES } from "@/lib/tema/tokens";

describe("Semaforo", () => {
  it("renderiza neutro para tasa null", () => {
    const { container } = render(<Semaforo tasa={null} />);
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    expect(span!.className).toContain("bg-borde");
  });

  it("renderiza bien para tasa >= 80", () => {
    const { container } = render(<Semaforo tasa={85} />);
    const span = container.querySelector("span");
    expect(span!.style.backgroundColor).toBe("rgb(68, 112, 22)");
  });

  it("renderiza atención para tasa entre 60 y 79", () => {
    const { container } = render(<Semaforo tasa={70} />);
    const span = container.querySelector("span");
    expect(span!.style.backgroundColor).toBe("rgb(154, 90, 0)");
  });

  it("renderiza crítico para tasa < 60", () => {
    const { container } = render(<Semaforo tasa={30} />);
    const span = container.querySelector("span");
    expect(span!.style.backgroundColor).toBe("rgb(192, 57, 43)");
  });

  it("tamaño sm tiene dimensiones de 10px", () => {
    const { container } = render(<Semaforo tasa={90} size="sm" />);
    const span = container.querySelector("span");
    expect(span!.style.width).toBe("10px");
    expect(span!.style.height).toBe("10px");
  });

  it("tamaño lg tiene dimensiones de 18px", () => {
    const { container } = render(<Semaforo tasa={90} size="lg" />);
    const span = container.querySelector("span");
    expect(span!.style.width).toBe("18px");
    expect(span!.style.height).toBe("18px");
  });

  it("tamaño md (default) tiene dimensiones de 14px", () => {
    const { container } = render(<Semaforo tasa={90} />);
    const span = container.querySelector("span");
    expect(span!.style.width).toBe("14px");
  });

  it("muestra title con porcentaje", () => {
    const { container } = render(<Semaforo tasa={75.5} />);
    const span = container.querySelector("span");
    expect(span!.title).toBe("75.5% cumplimiento");
  });
});

describe("colorTasa", () => {
  it("retorna gris para null", () => {
    expect(colorTasa(null)).toBe(COLORES["tinta-3"]);
  });

  it("retorna verde para >= 80", () => {
    expect(colorTasa(80)).toBe(COLORES.bien);
    expect(colorTasa(100)).toBe(COLORES.bien);
  });

  it("retorna amarillo para >= 60 y < 80", () => {
    expect(colorTasa(60)).toBe(COLORES.atencion);
    expect(colorTasa(79)).toBe(COLORES.atencion);
  });

  it("retorna rojo para < 60", () => {
    expect(colorTasa(0)).toBe(COLORES.critico);
    expect(colorTasa(59)).toBe(COLORES.critico);
  });
});

describe("Semaforo — accesibilidad", () => {
  it("se anuncia con la tasa y el nivel, no solo con el color", () => {
    const { getByRole } = render(<Semaforo tasa={70} />);
    expect(getByRole("img")).toHaveAttribute("aria-label", "70.0% cumplimiento (atención)");
  });

  it("sin tasa se anuncia como sin dato", () => {
    const { getByRole } = render(<Semaforo tasa={null} />);
    expect(getByRole("img")).toHaveAttribute("aria-label", "Sin dato de cumplimiento");
  });
});
