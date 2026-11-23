/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ErrorState } from "@/components/layout/ErrorState";

describe("ErrorState", () => {
  it("«Ir al inicio» apunta a la raíz, que el middleware envía al inicio de cada rol", () => {
    render(<ErrorState error={new Error("falló")} reset={jest.fn()} />);
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
  });
});
