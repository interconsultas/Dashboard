/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...args: unknown[]) => mockUseSWR(...args) }));

import { InsigniaAlertas, URL_CONTEO, REFRESCO_MS } from "@/components/layout/InsigniaAlertas";

describe("InsigniaAlertas", () => {
  beforeEach(() => mockUseSWR.mockReset());

  it("consulta el conteo y se refresca cada pocos minutos", () => {
    mockUseSWR.mockReturnValue({ data: { total: 3 } });
    render(<InsigniaAlertas />);
    expect(mockUseSWR).toHaveBeenCalledWith(URL_CONTEO, expect.any(Function), expect.objectContaining({ refreshInterval: REFRESCO_MS }));
    expect(REFRESCO_MS).toBeGreaterThanOrEqual(60_000);
    expect(screen.getByText("3")).toHaveAttribute("title", "3 prioridades");
    expect(screen.getByText("prioridades", { exact: false })).toBeInTheDocument();
  });

  it("una sola prioridad en singular y más de 99 abreviado", () => {
    mockUseSWR.mockReturnValue({ data: { total: 1 } });
    const { rerender } = render(<InsigniaAlertas />);
    expect(screen.getByText("1")).toHaveAttribute("title", "1 prioridad");
    mockUseSWR.mockReturnValue({ data: { total: 250 } });
    rerender(<InsigniaAlertas />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it.each([
    ["sin prioridades", { data: { total: 0 } }],
    ["con error", { data: undefined, error: new Error("x") }],
    ["cargando", { data: undefined }],
  ])("%s no muestra insignia", (_n, r) => {
    mockUseSWR.mockReturnValue(r);
    const { container } = render(<InsigniaAlertas />);
    expect(container).toBeEmptyDOMElement();
  });
});
