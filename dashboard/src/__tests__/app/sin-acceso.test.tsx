/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockSignOut = jest.fn();
jest.mock("next-auth/react", () => ({ signOut: (...a: unknown[]) => mockSignOut(...a) }));

import SinAccesoPage from "@/app/sin-acceso/page";

describe("/sin-acceso", () => {
  it("explica que el rol no tiene secciones y permite cerrar sesión", () => {
    render(<SinAccesoPage />);

    expect(screen.getByRole("heading", { name: "Sin secciones asignadas" })).toBeInTheDocument();
    expect(screen.getByText(/administrador/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });

  it("no enlaza a ninguna sección (evita bucles de redirección)", () => {
    render(<SinAccesoPage />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
