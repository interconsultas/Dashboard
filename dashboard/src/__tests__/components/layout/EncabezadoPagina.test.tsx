/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EncabezadoPagina } from "@/components/layout/EncabezadoPagina";

describe("EncabezadoPagina", () => {
  it("muestra migas, título (h1) y subtítulo sobre el degradado de marca", () => {
    render(
      <EncabezadoPagina
        titulo="Productividad"
        subtitulo="Oferta y asignación"
        migas={[{ etiqueta: "Análisis" }, { etiqueta: "Productividad" }]}
      />
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "Productividad" });
    expect(h1).toHaveClass("font-titulo");
    expect(h1.closest("header")).toHaveClass("bg-cabecera", "text-white", "rounded-tarjeta");
    expect(screen.getByText("Oferta y asignación")).toBeInTheDocument();
    const ruta = screen.getByRole("navigation", { name: "Ruta" });
    expect(ruta).toHaveTextContent("Análisis/Productividad");
    expect(screen.getAllByText("Productividad")[0]).toHaveAttribute("aria-current", "page");
  });

  it("las migas con href son enlaces", () => {
    render(<EncabezadoPagina titulo="X" migas={[{ etiqueta: "Inicio", href: "/dashboard" }, { etiqueta: "X" }]} />);
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/dashboard");
  });

  it("acepta acciones y una franja inferior", () => {
    render(
      <EncabezadoPagina titulo="Inteligencia" acciones={<button>Exportar</button>}>
        <div role="tablist" aria-label="Pestañas" />
      </EncabezadoPagina>
    );
    expect(screen.getByRole("button", { name: "Exportar" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Pestañas" })).toBeInTheDocument();
  });

  it("sin migas no pinta la ruta", () => {
    render(<EncabezadoPagina titulo="Solo" />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
