/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...a: unknown[]) => mockUseSWR(...a), mutate: jest.fn() }));
jest.mock("@/components/usuarios/MatrizPermisos", () => ({
  MatrizPermisos: () => <div data-testid="matriz-permisos" />,
}));

import UsuariosPage from "@/app/admin/usuarios/page";

describe("/admin/usuarios — pestañas", () => {
  beforeEach(() => {
    mockUseSWR.mockReturnValue({ data: [], isLoading: false });
  });

  it("abre en la gestión de usuarios", () => {
    render(<UsuariosPage />);
    expect(screen.getByRole("tab", { name: "Usuarios" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Crear usuario" })).toBeInTheDocument();
    expect(screen.queryByTestId("matriz-permisos")).not.toBeInTheDocument();
  });

  it("la pestaña Permisos por rol muestra la matriz", () => {
    render(<UsuariosPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Permisos por rol" }));

    expect(screen.getByRole("tab", { name: "Permisos por rol" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("matriz-permisos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear usuario" })).not.toBeInTheDocument();
  });
});
