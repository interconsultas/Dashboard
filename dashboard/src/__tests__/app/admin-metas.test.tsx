/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...args: unknown[]) => mockUseSWR(...args) }));

import MetasPage from "@/app/admin/metas/page";
import ProgramasPage from "@/app/admin/metas/programas/page";
import { RolProvider } from "@/components/layout/RolContext";
import type { Rol } from "@/lib/acceso";

function renderComo(rol: Rol, pagina: React.ReactElement) {
  return render(<RolProvider rol={rol}>{pagina}</RolProvider>);
}

describe("/admin/metas — edición solo para admin (como el PUT de la API)", () => {
  beforeEach(() => {
    mockUseSWR.mockReturnValue({
      data: { anio: 2026, anios: [2026], metas: [] },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    });
  });

  it("admin ve los controles de edición", () => {
    renderComo("admin", <MetasPage />);

    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Agregar año" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar metas del año anterior" })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")[0]).not.toHaveAttribute("readonly");
  });

  it("dirección médica consulta en solo lectura", () => {
    renderComo("direccion_medica", <MetasPage />);

    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Agregar año" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar metas del año anterior" })).not.toBeInTheDocument();
    for (const celda of screen.getAllByRole("textbox")) expect(celda).toHaveAttribute("readonly");
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
    // Puede seguir cambiando de año y abrir el mapeo de programas
    expect(screen.getByRole("combobox", { name: "Año" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Programas por especialidad" })).toBeInTheDocument();
  });
});

describe("/admin/metas/programas — edición solo para admin", () => {
  beforeEach(() => {
    mockUseSWR.mockReturnValue({
      data: { mapeo: [{ programa_especialidad: "MEDICINA GENERAL", programa: null, profesionales: 3 }] },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    });
  });

  it("admin puede cambiar el programa y guardar", () => {
    renderComo("admin", <ProgramasPage />);

    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /MEDICINA GENERAL/ })).toBeEnabled();
  });

  it("dirección médica consulta en solo lectura", () => {
    renderComo("direccion_medica", <ProgramasPage />);

    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /MEDICINA GENERAL/ })).toBeDisabled();
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });
});
