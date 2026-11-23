/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockDescargar = jest.fn();
jest.mock("@/lib/informes/descarga", () => ({
  ...jest.requireActual("@/lib/informes/descarga"),
  descargarArchivo: (...a: unknown[]) => mockDescargar(...a),
}));

const mockPdf = jest.fn();
jest.mock("@/components/informes/pdf/generar", () => ({
  descargarInformePdf: (...a: unknown[]) => mockPdf(...a),
}));

import { MenuExportar } from "@/components/informes/MenuExportar";
import { FILTROS_VACIOS } from "@/lib/productividad/filtros";

const FILTROS = { ...FILTROS_VACIOS, periodo: "202610", area: "Salud oral" };

function abrir() {
  fireEvent.click(screen.getByRole("button", { name: /Exportar/ }));
}

describe("MenuExportar", () => {
  beforeEach(() => {
    mockDescargar.mockReset();
    mockPdf.mockReset();
  });

  it("abre un menú con Excel y PDF de la vista y del informe mensual", () => {
    render(<MenuExportar filtros={FILTROS} />);
    const boton = screen.getByRole("button", { name: /Exportar/ });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    abrir();
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: /Excel — esta vista/ })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: /Excel — informe mensual/ })).toBeEnabled();
    const pdf = screen.getAllByRole("menuitem", { name: /PDF/ });
    expect(pdf).toHaveLength(2);
    pdf.forEach((p) => {
      expect(p).toBeEnabled();
      expect(p).not.toHaveTextContent("Próximamente");
    });
  });

  it("PDF — esta vista: genera el PDF en el navegador a partir del modelo con los filtros activos", async () => {
    mockPdf.mockResolvedValue("Productividad_Octubre_2026.pdf");
    render(<MenuExportar filtros={FILTROS} />);
    abrir();
    fireEvent.click(screen.getByRole("menuitem", { name: /PDF — esta vista/ }));
    await waitFor(() => expect(mockPdf).toHaveBeenCalledWith("/api/informes/datos?tipo=vista&periodo=202610&area=Salud+oral"));
    expect(mockDescargar).not.toHaveBeenCalled();
  });

  it("PDF — informe mensual: muestra Generando… y luego el error en línea", async () => {
    let fallar: (e: Error) => void = () => {};
    mockPdf.mockReturnValue(new Promise((_, rej) => (fallar = rej)));
    render(<MenuExportar filtros={FILTROS} />);
    abrir();
    fireEvent.click(screen.getByRole("menuitem", { name: /PDF — informe mensual/ }));
    expect(screen.getByRole("button", { name: /Generando/ })).toBeDisabled();
    await waitFor(() => expect(mockPdf).toHaveBeenCalledWith("/api/informes/datos?tipo=mensual&periodo=202610"));
    await act(async () => fallar(new Error("Error al generar el informe")));
    expect(screen.getByRole("alert")).toHaveTextContent("Error al generar el informe");
  });

  it("descarga esta vista con los filtros de la URL", async () => {
    mockDescargar.mockResolvedValue("x.xlsx");
    render(<MenuExportar filtros={FILTROS} />);
    abrir();
    fireEvent.click(screen.getByRole("menuitem", { name: /Excel — esta vista/ }));
    expect(mockDescargar).toHaveBeenCalledWith("/api/informes/excel?tipo=vista&periodo=202610&area=Salud+oral");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("el informe mensual lleva solo el periodo", () => {
    mockDescargar.mockResolvedValue("x.xlsx");
    render(<MenuExportar filtros={{ ...FILTROS, profesional: "1053" }} />);
    abrir();
    fireEvent.click(screen.getByRole("menuitem", { name: /Excel — informe mensual/ }));
    expect(mockDescargar).toHaveBeenCalledWith("/api/informes/excel?tipo=mensual&periodo=202610");
  });

  it("muestra el estado de carga y luego el error", async () => {
    let fallar: (e: Error) => void = () => {};
    mockDescargar.mockReturnValue(new Promise((_, rej) => (fallar = rej)));
    render(<MenuExportar filtros={FILTROS} />);
    abrir();
    fireEvent.click(screen.getByRole("menuitem", { name: /Excel — esta vista/ }));
    const boton = screen.getByRole("button", { name: /Generando/ });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute("aria-busy", "true");
    await act(async () => fallar(new Error("Sin permisos suficientes")));
    expect(screen.getByRole("alert")).toHaveTextContent("Sin permisos suficientes");
    expect(screen.getByRole("button", { name: /Exportar/ })).toBeEnabled();
  });

  it("Escape cierra el menú", () => {
    render(<MenuExportar filtros={FILTROS} />);
    abrir();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
