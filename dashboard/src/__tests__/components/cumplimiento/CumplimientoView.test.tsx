/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...args: unknown[]) => mockUseSWR(...args) }));

import CumplimientoView from "@/components/cumplimiento/CumplimientoView";
import { construirCumplimiento } from "@/lib/cumplimiento/calcular";
import type { RespuestaCumplimiento } from "@/lib/cumplimiento/tipos";
import { FetchError } from "@/lib/fetcher";
import { ANCHO_IMPRESION_PX, ESPERA_LAYOUT_MS } from "@/hooks/useImpresion";

const DATOS: RespuestaCumplimiento = {
  atribucion: "ordenador",
  periodos_disponibles: [202511, 202512, 202601, 202602],
  periodo_desde: 202512,
  periodo_hasta: 202602,
  periodos: [202512, 202601, 202602],
  ...construirCumplimiento({
    entradas: [
      { documento: "10234567", nombre: "PEREZ JUAN", periodo: 202601, citas: 100, programa: "RCV", categoria: "medicamentos", ordenes: 300 },
      { documento: "30345678", nombre: "GOMEZ ANA", periodo: 202602, citas: 100, programa: "RCV", categoria: "medicamentos", ordenes: 100 },
    ],
    metas: [{ anio: 2026, programa: "RCV", categoria: "medicamentos", valor: 2 }],
  }),
};

function swr(estado: Partial<{ data: unknown; error: unknown; isLoading: boolean; isValidating: boolean }>) {
  mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false, isValidating: false, mutate: jest.fn(), ...estado });
}

/** Cuerpo (ya parseado) de la última consulta pedida a SWR. */
function ultimoCuerpo() {
  const [clave] = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1];
  expect(clave[0]).toBe("/api/cumplimiento");
  return JSON.parse(clave[1]);
}

describe("CumplimientoView", () => {
  beforeEach(() => {
    mockUseSWR.mockReset();
  });

  it("la primera consulta no envía periodos y conserva los datos anteriores al refrescar", () => {
    swr({ isLoading: true });
    render(<CumplimientoView />);

    expect(ultimoCuerpo()).toEqual({});
    expect(mockUseSWR.mock.calls[0][2]).toMatchObject({ keepPreviousData: true });
  });

  it("muestra esqueletos mientras carga por primera vez", () => {
    swr({ isLoading: true });
    const { container } = render(<CumplimientoView />);

    expect(container.querySelectorAll(".animate-pulse, .skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText("Ranking de profesionales")).not.toBeInTheDocument();
  });

  it("muestra el estado de error cuando la consulta falla sin datos previos", () => {
    swr({ error: new FetchError("Sin permisos suficientes", 403, null) });
    render(<CumplimientoView />);

    expect(screen.getByText("No se pudo cargar el cumplimiento")).toBeInTheDocument();
    expect(screen.getByText("Sin permisos suficientes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("sin citas cargadas muestra el estado vacío y oculta los filtros", () => {
    swr({ data: { ...DATOS, periodos_disponibles: [], periodo_desde: null, periodo_hasta: null, periodos: [], ...construirCumplimiento({ entradas: [], metas: [] }) } });
    render(<CumplimientoView />);

    expect(screen.getByText("Aún no hay citas atendidas cargadas")).toBeInTheDocument();
    expect(screen.queryByLabelText("Desde")).not.toBeInTheDocument();
  });

  it("ofrece solo los periodos con citas y parte del rango que resolvió el servidor", () => {
    swr({ data: DATOS });
    render(<CumplimientoView />);

    const desde = screen.getByLabelText("Desde") as HTMLSelectElement;
    const hasta = screen.getByLabelText("Hasta") as HTMLSelectElement;
    expect(desde.value).toBe("202512");
    expect(hasta.value).toBe("202602");
    expect(Array.from(desde.options).map((o) => o.textContent)).toEqual(["Nov 2025", "Dic 2025", "Ene 2026", "Feb 2026"]);
    expect(screen.getByRole("button", { name: /Aplicar filtros/ })).toBeDisabled();
  });

  it("al cambiar un periodo habilita 'Aplicar' y al aplicar consulta el nuevo rango", () => {
    swr({ data: DATOS });
    render(<CumplimientoView />);

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "202601" } });
    expect(screen.getByText("Filtros sin aplicar")).toBeInTheDocument();
    // Mientras no se aplique, la consulta sigue siendo la inicial
    expect(ultimoCuerpo()).toEqual({});

    fireEvent.click(screen.getByRole("button", { name: /Aplicar filtros/ }));

    expect(ultimoCuerpo()).toEqual({ periodo_desde: 202601, periodo_hasta: 202602 });
  });

  it("'Hasta' solo ofrece periodos iguales o posteriores a 'Desde'", () => {
    swr({ data: DATOS });
    render(<CumplimientoView />);

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "202601" } });

    const hasta = screen.getByLabelText("Hasta") as HTMLSelectElement;
    expect(Array.from(hasta.options).map((o) => o.value)).toEqual(["202601", "202602"]);
  });

  it("elegir un profesional en el filtro abre su tablero sin volver a consultar", () => {
    swr({ data: DATOS });
    render(<CumplimientoView />);

    fireEvent.click(screen.getByRole("button", { name: /^Profesional:/ }));
    fireEvent.click(screen.getByRole("option", { name: /GOMEZ ANA/ }));

    expect(screen.getByRole("heading", { name: "GOMEZ ANA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Profesional:/ })).toHaveTextContent("GOMEZ ANA");
    expect(ultimoCuerpo()).toEqual({});
  });

  it("'Volver al ranking' regresa a la vista general", () => {
    swr({ data: DATOS });
    render(<CumplimientoView />);

    fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de PEREZ JUAN/ }));
    expect(screen.getByRole("heading", { name: "PEREZ JUAN" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver al ranking" }));
    expect(screen.getByText("Ranking de profesionales")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Profesional:/ })).toHaveTextContent("Todos los profesionales");
  });

  it("no ofrece la exportación a PDF mientras esté deshabilitada", () => {
    swr({ data: DATOS });
    render(<CumplimientoView />);

    expect(screen.queryByRole("button", { name: /Exportar PDF/ })).not.toBeInTheDocument();
  });

  describe("exportar a PDF", () => {
    const botonExportar = () => screen.getByRole("button", { name: /Exportar PDF|Preparando/ });

    beforeEach(() => {
      jest.useFakeTimers();
      window.print = jest.fn();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    /** Dos cuadros de animación más la espera del layout. */
    function esperarLayout() {
      act(() => {
        jest.advanceTimersToNextFrame();
      });
      act(() => {
        jest.advanceTimersToNextFrame();
      });
      act(() => {
        jest.advanceTimersByTime(ESPERA_LAYOUT_MS);
      });
    }

    it("el botón está deshabilitado mientras carga por primera vez", () => {
      swr({ isLoading: true });
      render(<CumplimientoView exportarPdf />);

      expect(botonExportar()).toBeDisabled();
    });

    it("el botón está deshabilitado cuando la consulta falla sin datos previos", () => {
      swr({ error: new FetchError("Sin permisos suficientes", 403, null) });
      render(<CumplimientoView exportarPdf />);

      expect(botonExportar()).toBeDisabled();
    });

    it("el botón está deshabilitado cuando no hay citas cargadas", () => {
      swr({ data: { ...DATOS, periodos_disponibles: [], periodo_desde: null, periodo_hasta: null, periodos: [], ...construirCumplimiento({ entradas: [], metas: [] }) } });
      render(<CumplimientoView exportarPdf />);

      expect(botonExportar()).toBeDisabled();
    });

    it("el botón está deshabilitado mientras se actualizan los datos", () => {
      swr({ data: DATOS, isValidating: true });
      render(<CumplimientoView exportarPdf />);

      expect(botonExportar()).toBeDisabled();
    });

    it("con datos en pantalla el botón está habilitado en la vista general y en la de un profesional", () => {
      swr({ data: DATOS });
      render(<CumplimientoView exportarPdf />);

      expect(botonExportar()).toBeEnabled();

      fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de PEREZ JUAN/ }));
      expect(botonExportar()).toBeEnabled();
    });

    it("al exportar fija el ancho de impresión, abre el diálogo y luego restaura el layout", () => {
      swr({ data: DATOS });
      render(<CumplimientoView exportarPdf />);
      const region = screen.getByTestId("cumplimiento-imprimible");
      expect(region).not.toHaveClass("cumplimiento-imprimiendo");
      expect(region.style.width).toBe("");

      fireEvent.click(botonExportar());

      expect(region).toHaveClass("cumplimiento-imprimiendo");
      expect(region.style.width).toBe(`${ANCHO_IMPRESION_PX}px`);
      expect(botonExportar()).toBeDisabled();
      expect(window.print).not.toHaveBeenCalled();

      esperarLayout();
      expect(window.print).toHaveBeenCalledTimes(1);

      act(() => {
        window.dispatchEvent(new Event("afterprint"));
      });
      expect(region).not.toHaveClass("cumplimiento-imprimiendo");
      expect(region.style.width).toBe("");
      expect(botonExportar()).toBeEnabled();
    });

    it("el encabezado de impresión indica el rango, la atribución y la fecha de generación", () => {
      jest.setSystemTime(new Date(2026, 9, 8, 10, 0));
      swr({ data: DATOS });
      render(<CumplimientoView exportarPdf />);

      const encabezado = screen.getByTestId("encabezado-impresion");
      expect(encabezado).toHaveTextContent("Periodo: Dic 2025 – Feb 2026");
      expect(encabezado).toHaveTextContent("Órdenes atribuidas al médico ordenador");
      expect(encabezado).toHaveTextContent("Generado el 8 de octubre de 2026");
      expect(encabezado).not.toHaveTextContent("Programa");
      expect(encabezado).not.toHaveTextContent("Profesional");
    });

    it("el encabezado de impresión incluye el programa cuando hay un filtro aplicado", () => {
      swr({ data: DATOS });
      render(<CumplimientoView exportarPdf />);

      fireEvent.click(screen.getByRole("button", { name: "Todos" }));
      fireEvent.click(screen.getByRole("button", { name: "Quitar todos" }));
      fireEvent.click(screen.getByLabelText("RCV"));
      expect(screen.getByTestId("encabezado-impresion")).not.toHaveTextContent("Programa: RCV");

      fireEvent.click(screen.getByRole("button", { name: /Aplicar filtros/ }));

      expect(screen.getByTestId("encabezado-impresion")).toHaveTextContent("Programa: RCV");
    });

    it("el encabezado de impresión identifica al profesional en la vista de detalle", () => {
      swr({ data: DATOS });
      render(<CumplimientoView exportarPdf />);

      fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de PEREZ JUAN/ }));

      expect(screen.getByTestId("encabezado-impresion")).toHaveTextContent(
        "Profesional: PEREZ JUAN · Cédula 10234567 · Programa RCV"
      );
    });

    it("sin datos no hay encabezado de impresión", () => {
      swr({ isLoading: true });
      render(<CumplimientoView exportarPdf />);

      expect(screen.queryByTestId("encabezado-impresion")).not.toBeInTheDocument();
    });
  });
});
