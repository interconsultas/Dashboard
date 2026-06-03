/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Semaforo, colorTasa } from "@/components/ui/Semaforo";

describe("Semaforo", () => {
  it("renderiza gris para tasa null", () => {
    const { container } = render(<Semaforo tasa={null} />);
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    expect(span!.className).toContain("bg-gray-200");
  });

  it("renderiza verde para tasa >= 80", () => {
    const { container } = render(<Semaforo tasa={85} />);
    const span = container.querySelector("span");
    expect(span!.style.backgroundColor).toBe("rgb(78, 162, 52)");
  });

  it("renderiza amarillo para tasa entre 60 y 79", () => {
    const { container } = render(<Semaforo tasa={70} />);
    const span = container.querySelector("span");
    expect(span!.style.backgroundColor).toBe("rgb(245, 158, 11)");
  });

  it("renderiza rojo para tasa < 60", () => {
    const { container } = render(<Semaforo tasa={30} />);
    const span = container.querySelector("span");
    expect(span!.style.backgroundColor).toBe("rgb(239, 68, 68)");
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
    expect(colorTasa(null)).toBe("#6B7280");
  });

  it("retorna verde para >= 80", () => {
    expect(colorTasa(80)).toBe("#4EA234");
    expect(colorTasa(100)).toBe("#4EA234");
  });

  it("retorna amarillo para >= 60 y < 80", () => {
    expect(colorTasa(60)).toBe("#F59E0B");
    expect(colorTasa(79)).toBe("#F59E0B");
  });

  it("retorna rojo para < 60", () => {
    expect(colorTasa(0)).toBe("#EF4444");
    expect(colorTasa(59)).toBe("#EF4444");
  });
});
