/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...args: unknown[]) => mockUseSWR(...args) }));

import AreasServicioPage from "@/app/admin/citas/areas/page";
import { RolProvider } from "@/components/layout/RolContext";
import { PERMISOS_POR_DEFECTO } from "@/lib/acceso";
import type { AreasServicio } from "@/lib/citas/areas";

const DATOS: AreasServicio = {
  areas: ["Medicina general", "Salud oral", "Enfermería"],
  periodo: 202610,
  servicios: [
    {
      codigo_servicio: "62574", nombre_servicio: "ELECTROCARDIOGRAMA", area: "Medicina general",
      area_regla: "Enfermería", area_editada: true, ultimo_periodo: 202610, asignadas: 1470,
    },
    {
      codigo_servicio: "19", nombre_servicio: "CONSULTA ODONTOLOGICA TRATAMIENTO", area: "Salud oral",
      area_regla: "Salud oral", area_editada: false, ultimo_periodo: 202610, asignadas: 3312,
    },
  ],
};

const fila = (nombre: string) => screen.getByText(nombre).closest("tr") as HTMLElement;

describe("/admin/citas/areas", () => {
  const mutate = jest.fn();
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSWR.mockReturnValue({ data: DATOS, error: undefined, isLoading: false, mutate });
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ actualizados: 1 }) });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("consulta el catálogo de áreas y enlaza de vuelta a Citas", () => {
    render(<RolProvider rol="admin"><AreasServicioPage /></RolProvider>);

    expect(mockUseSWR.mock.calls[0][0]).toBe("/api/admin/citas/areas");
    expect(screen.getByRole("heading", { level: 1, name: "Áreas de servicio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a Citas" })).toHaveAttribute("href", "/admin/citas");
  });

  it("muestra cada servicio con su código, área, asignadas del último mes y si fue editada", () => {
    render(<RolProvider rol="admin"><AreasServicioPage /></RolProvider>);

    const ecg = fila("ELECTROCARDIOGRAMA");
    expect(within(ecg).getByText("62574")).toBeInTheDocument();
    expect(within(ecg).getByText("1.470")).toBeInTheDocument();
    expect(within(ecg).getByLabelText("Área de ELECTROCARDIOGRAMA")).toHaveValue("Medicina general");
    expect(within(ecg).getByText(/Editada · regla: Enfermería/)).toBeInTheDocument();

    const odonto = fila("CONSULTA ODONTOLOGICA TRATAMIENTO");
    expect(within(odonto).queryByRole("button", { name: /Restablecer/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Oct 2026/)).toBeInTheDocument();
  });

  it("guarda solo los servicios cambiados", async () => {
    render(<RolProvider rol="admin"><AreasServicioPage /></RolProvider>);

    const guardar = screen.getByRole("button", { name: "Guardar" });
    expect(guardar).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Área de CONSULTA ODONTOLOGICA TRATAMIENTO"), {
      target: { value: "Enfermería" },
    });
    fireEvent.click(guardar);

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/citas/areas");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      cambios: [{ codigo_servicio: "19", area: "Enfermería" }],
    });
  });

  it("restablece un servicio editado a la regla", async () => {
    render(<RolProvider rol="admin"><AreasServicioPage /></RolProvider>);

    fireEvent.click(
      within(fila("ELECTROCARDIOGRAMA")).getByRole("button", { name: "Restablecer a la regla" })
    );

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ cambios: [{ codigo_servicio: "62574", area: null }] });
  });

  it("muestra el error del servidor", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Fila 1 (19): área no válida" }) });
    render(<RolProvider rol="admin"><AreasServicioPage /></RolProvider>);

    fireEvent.change(screen.getByLabelText("Área de CONSULTA ODONTOLOGICA TRATAMIENTO"), {
      target: { value: "Enfermería" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Fila 1 (19): área no válida")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("con Citas en ver queda en solo consulta: sin Guardar, sin Restablecer y áreas bloqueadas", () => {
    const permisos = { ...PERMISOS_POR_DEFECTO.direccion_medica, citas: "ver" as const };
    render(<RolProvider rol="direccion_medica" permisos={permisos}><AreasServicioPage /></RolProvider>);

    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Restablecer/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Área de ELECTROCARDIOGRAMA")).toBeDisabled();
    expect(screen.getByText(/solo consulta/i)).toBeInTheDocument();
  });
});
