/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

let mockParams = new URLSearchParams();
jest.mock("next/navigation", () => ({ useSearchParams: () => mockParams }));

import { AvisoSinAcceso } from "@/components/layout/AvisoSinAcceso";

describe("AvisoSinAcceso", () => {
  it("avisa cuando el middleware negó una sección", () => {
    mockParams = new URLSearchParams("sin_acceso=1");
    render(<AvisoSinAcceso />);
    expect(screen.getByRole("status")).toHaveTextContent("No tiene acceso a esa sección");
  });

  it("no muestra nada en una visita normal", () => {
    mockParams = new URLSearchParams("periodo=202601");
    const { container } = render(<AvisoSinAcceso />);
    expect(container).toBeEmptyDOMElement();
  });
});
