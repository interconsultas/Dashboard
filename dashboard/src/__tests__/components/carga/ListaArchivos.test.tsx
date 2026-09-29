/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ListaArchivos } from "@/components/carga/ListaArchivos";
import type { LogCarga } from "@/types/carga";

function carga(overrides: Partial<LogCarga> = {}): LogCarga {
  return {
    id: 1,
    job_id: "550e8400-e29b-41d4-a716-446655440000",
    nombre_archivo: "detallado_marzo.xlsx",
    hash_archivo: null,
    periodo_detectado: 202603,
    filas_en_archivo: 100,
    filas_validas: 100,
    filas_insertadas: 100,
    filas_duplicadas: 0,
    filas_con_error: 0,
    fechas_invalidas: 0,
    valores_invalidos: 0,
    medicos_no_encontrados: { total: 0, nombres: [] },
    columnas_faltantes: [],
    distribucion_estados: null,
    suma_valor_autorizado: null,
    estado: "exitoso",
    error_mensaje: null,
    cargado_por: "admin@ips.local",
    tiempo_segundos: 12.3,
    cargado_en: "2026-03-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("ListaArchivos - botón Eliminar", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it.each(["exitoso", "exitoso_con_advertencias"] as const)(
    "muestra el botón Eliminar para estado '%s'",
    (estado) => {
      render(
        <ListaArchivos cargas={[carga({ estado })]} onVerInforme={jest.fn()} onEliminado={jest.fn()} />
      );
      expect(screen.getByText("Eliminar")).toBeInTheDocument();
    }
  );

  it.each(["procesando", "esperando_confirmacion", "error_fatal", "cancelado", "eliminando", "eliminado"] as const)(
    "no muestra el botón Eliminar para estado '%s'",
    (estado) => {
      render(
        <ListaArchivos cargas={[carga({ estado })]} onVerInforme={jest.fn()} onEliminado={jest.fn()} />
      );
      expect(screen.queryByText("Eliminar")).not.toBeInTheDocument();
    }
  );

  it("abre el modal de confirmación con el nombre del archivo al hacer click en Eliminar", () => {
    render(
      <ListaArchivos
        cargas={[carga({ nombre_archivo: "marzo_2026.xlsx" })]}
        onVerInforme={jest.fn()}
        onEliminado={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText("Eliminar"));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText(/marzo_2026\.xlsx/)).toBeInTheDocument();
  });

  it("hace DELETE al job correcto y llama a onEliminado al confirmar", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mensaje: "Eliminación en proceso" }),
    }) as unknown as typeof fetch;
    const onEliminado = jest.fn();

    render(
      <ListaArchivos cargas={[carga()]} onVerInforme={jest.fn()} onEliminado={onEliminado} />
    );

    fireEvent.click(screen.getByText("Eliminar"));
    const botones = screen.getAllByRole("button", { name: "Eliminar" });
    fireEvent.click(botones[botones.length - 1]);

    await waitFor(() => expect(onEliminado).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/carga/550e8400-e29b-41d4-a716-446655440000",
      { method: "DELETE" }
    );
  });

  it("muestra el error y no llama a onEliminado si el DELETE falla", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "El job está en estado 'procesando', no se puede eliminar" }),
    }) as unknown as typeof fetch;
    const onEliminado = jest.fn();

    render(
      <ListaArchivos cargas={[carga()]} onVerInforme={jest.fn()} onEliminado={onEliminado} />
    );

    fireEvent.click(screen.getByText("Eliminar"));
    const botones = screen.getAllByRole("button", { name: "Eliminar" });
    fireEvent.click(botones[botones.length - 1]);

    await waitFor(() =>
      expect(screen.getByText(/no se puede eliminar/)).toBeInTheDocument()
    );
    expect(onEliminado).not.toHaveBeenCalled();
  });
});
