/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...args: unknown[]) => mockUseSWR(...args) }));

// @react-pdf/renderer solo corre en el navegador: aquí se verifica qué se le pide al generador
const mockDescargar = jest.fn();
jest.mock("@/components/cumplimiento/pdf/descargarInforme", () => ({
  descargarInforme: (...args: unknown[]) => mockDescargar(...args),
}));

import CumplimientoView from "@/components/cumplimiento/CumplimientoView";
import { construirCumplimiento } from "@/lib/cumplimiento/calcular";
import type { RespuestaCumplimiento } from "@/lib/cumplimiento/tipos";
import { FetchError } from "@/lib/fetcher";

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

  it("el filtro de programas muestra las etiquetas del Excel y no ofrece el total", () => {
    swr({ data: DATOS });
    render(<CumplimientoView />);

    fireEvent.click(screen.getByRole("button", { name: "Todos" }));

    expect(screen.getByLabelText("CPR")).toBeInTheDocument();
    expect(screen.getByLabelText("Pediatría")).toBeInTheDocument();
    expect(screen.queryByLabelText(/TOTAL/)).not.toBeInTheDocument();
  });

  describe("exportar a PDF", () => {
    const botonExportar = () => screen.getByRole("button", { name: /Exportar PDF|Generando PDF/ });
    const SIN_CITAS = { ...DATOS, periodos_disponibles: [], periodo_desde: null, periodo_hasta: null, periodos: [], ...construirCumplimiento({ entradas: [], metas: [] }) };

    beforeEach(() => {
      mockDescargar.mockReset();
      mockDescargar.mockResolvedValue(undefined);
    });

    it("no se ofrece mientras carga, si la consulta falla sin datos o si no hay citas cargadas", () => {
      swr({ isLoading: true });
      const { rerender } = render(<CumplimientoView />);
      expect(screen.queryByRole("button", { name: /Exportar PDF/ })).not.toBeInTheDocument();

      swr({ error: new FetchError("Sin permisos suficientes", 403, null) });
      rerender(<CumplimientoView />);
      expect(screen.queryByRole("button", { name: /Exportar PDF/ })).not.toBeInTheDocument();

      swr({ data: SIN_CITAS });
      rerender(<CumplimientoView />);
      expect(screen.queryByRole("button", { name: /Exportar PDF/ })).not.toBeInTheDocument();
    });

    it("el botón está deshabilitado mientras se actualizan los datos", () => {
      swr({ data: DATOS, isValidating: true });
      render(<CumplimientoView />);

      expect(botonExportar()).toBeDisabled();
    });

    it("con datos en pantalla el botón está habilitado en la vista general y en la de un profesional", () => {
      swr({ data: DATOS });
      render(<CumplimientoView />);

      expect(botonExportar()).toBeEnabled();

      fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de PEREZ JUAN/ }));
      expect(botonExportar()).toBeEnabled();
    });

    it("genera el informe de la vista general con los datos en pantalla", async () => {
      swr({ data: DATOS });
      render(<CumplimientoView />);

      fireEvent.click(botonExportar());

      await waitFor(() => expect(mockDescargar).toHaveBeenCalledTimes(1));
      expect(mockDescargar).toHaveBeenCalledWith({
        datos: DATOS,
        programas: null,
        documento: null,
        generado: expect.any(Date),
      });
    });

    it("genera el informe del profesional seleccionado con el filtro de programas aplicado", async () => {
      swr({ data: DATOS });
      render(<CumplimientoView />);

      fireEvent.click(screen.getByRole("button", { name: "Todos" }));
      fireEvent.click(screen.getByRole("button", { name: "Quitar todos" }));
      fireEvent.click(screen.getByLabelText("RCV"));
      fireEvent.click(screen.getByRole("button", { name: /Aplicar filtros/ }));
      fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de PEREZ JUAN/ }));

      fireEvent.click(botonExportar());

      await waitFor(() => expect(mockDescargar).toHaveBeenCalledTimes(1));
      expect(mockDescargar.mock.calls[0][0]).toMatchObject({ programas: ["RCV"], documento: "10234567" });
    });

    it("muestra el estado de carga mientras genera y no permite pedir otro", async () => {
      let terminar: () => void = () => {};
      mockDescargar.mockReturnValue(new Promise<void>((r) => (terminar = r)));
      swr({ data: DATOS });
      render(<CumplimientoView />);

      fireEvent.click(botonExportar());

      await waitFor(() => expect(botonExportar()).toHaveTextContent("Generando PDF..."));
      expect(botonExportar()).toBeDisabled();

      await act(async () => terminar());

      expect(botonExportar()).toHaveTextContent("Exportar PDF");
      expect(botonExportar()).toBeEnabled();
      expect(mockDescargar).toHaveBeenCalledTimes(1);
    });

    it("informa el error si no se pudo generar el PDF y lo limpia al reintentar", async () => {
      const consola = jest.spyOn(console, "error").mockImplementation(() => {});
      mockDescargar.mockRejectedValueOnce(new Error("falló"));
      swr({ data: DATOS });
      render(<CumplimientoView />);

      fireEvent.click(botonExportar());

      expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo generar el PDF. Intente de nuevo.");
      expect(botonExportar()).toBeEnabled();

      fireEvent.click(botonExportar());
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
      expect(consola).toHaveBeenCalled();
      consola.mockRestore();
    });
  });
});
