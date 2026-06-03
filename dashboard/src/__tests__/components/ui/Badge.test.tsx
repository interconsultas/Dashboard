/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BadgeEstado } from "@/components/ui/Badge";
import type { EstadoCarga } from "@/types/carga";

describe("BadgeEstado", () => {
  const ESTADOS_LABEL: Record<string, string> = {
    procesando: "Procesando...",
    previsualizando: "Previsualizando",
    esperando_confirmacion: "En espera",
    cargando: "Cargando...",
    exitoso: "Exitoso",
    exitoso_con_advertencias: "Con advertencias",
    cancelado: "Cancelado",
    error_fatal: "Error",
    ya_procesado: "Duplicado",
  };

  it.each(Object.entries(ESTADOS_LABEL))(
    "renderiza el label correcto para estado '%s'",
    (estado, labelEsperado) => {
      render(<BadgeEstado estado={estado as EstadoCarga} />);
      expect(screen.getByText(labelEsperado)).toBeInTheDocument();
    }
  );

  it("renderiza como span con clases de badge", () => {
    const { container } = render(<BadgeEstado estado="exitoso" />);
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    expect(span!.className).toContain("rounded-full");
    expect(span!.className).toContain("text-xs");
  });

  it("estado exitoso tiene clase verde", () => {
    const { container } = render(<BadgeEstado estado="exitoso" />);
    const span = container.querySelector("span");
    expect(span!.className).toContain("bg-green-100");
  });

  it("estado error_fatal tiene clase roja", () => {
    const { container } = render(<BadgeEstado estado="error_fatal" />);
    const span = container.querySelector("span");
    expect(span!.className).toContain("bg-red-100");
  });

  it("estado esperando_confirmacion tiene clase amarilla", () => {
    const { container } = render(<BadgeEstado estado="esperando_confirmacion" />);
    const span = container.querySelector("span");
    expect(span!.className).toContain("bg-yellow-100");
  });
});
