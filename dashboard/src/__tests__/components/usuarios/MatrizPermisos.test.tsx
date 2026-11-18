/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...args: unknown[]) => mockUseSWR(...args) }));

import { MatrizPermisos } from "@/components/usuarios/MatrizPermisos";
import { PERMISOS_POR_DEFECTO, SECCIONES } from "@/lib/acceso";

const celda = (seccion: string, rol: string) => screen.getByLabelText(`${seccion} — ${rol}`) as HTMLSelectElement;

describe("MatrizPermisos", () => {
  const mutate = jest.fn();
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSWR.mockReturnValue({
      data: { permisos: PERMISOS_POR_DEFECTO },
      error: undefined,
      isLoading: false,
      mutate,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ actualizados: 1, permisos: PERMISOS_POR_DEFECTO }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("consulta /api/admin/permisos y muestra una fila por sección con su descripción", () => {
    render(<MatrizPermisos />);

    expect(mockUseSWR.mock.calls[0][0]).toBe("/api/admin/permisos");
    for (const s of SECCIONES) {
      expect(screen.getByText(s.etiqueta, { selector: "td *, td" })).toBeInTheDocument();
      expect(screen.getByText(s.descripcion)).toBeInTheDocument();
    }
  });

  it("muestra los niveles actuales de dirección médica y coordinador", () => {
    render(<MatrizPermisos />);

    expect(celda("Metas", "Dirección médica")).toHaveValue("ver");
    expect(celda("Productividad", "Coordinador")).toHaveValue("ninguno");
  });

  it("la columna de administrador es fija (Total) y usuarios no se configura", () => {
    render(<MatrizPermisos />);

    expect(screen.queryByLabelText(/— Administrador$/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Total")).toHaveLength(SECCIONES.length);
    expect(screen.queryByLabelText("Usuarios — Coordinador")).not.toBeInTheDocument();
    const filaUsuarios = screen.getByText("Usuarios", { selector: "td *, td" }).closest("tr") as HTMLElement;
    expect(within(filaUsuarios).getAllByText("Sin acceso")).toHaveLength(2);
  });

  it("solo ofrece Editar en las secciones que lo admiten", () => {
    render(<MatrizPermisos />);

    const opciones = (s: HTMLSelectElement) => Array.from(s.options).map((o) => o.textContent);
    expect(opciones(celda("Productividad", "Coordinador"))).toEqual(["Sin acceso", "Ver"]);
    expect(opciones(celda("Metas", "Coordinador"))).toEqual(["Sin acceso", "Ver", "Editar"]);
  });

  it("Guardar está deshabilitado sin cambios", () => {
    render(<MatrizPermisos />);
    expect(screen.getByRole("button", { name: "Guardar permisos" })).toBeDisabled();
  });

  it("envía solo lo que cambió y confirma lo guardado", async () => {
    render(<MatrizPermisos />);

    fireEvent.change(celda("Productividad", "Coordinador"), { target: { value: "ver" } });
    fireEvent.change(celda("Metas", "Dirección médica"), { target: { value: "editar" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar permisos" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/permisos");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      cambios: [
        { rol: "direccion_medica", seccion: "metas", nivel: "editar" },
        { rol: "coordinador", seccion: "productividad", nivel: "ver" },
      ],
    });

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent("Se guardaron 2 cambios");
    expect(aviso).toHaveTextContent("Coordinador · Productividad: Ver");
    expect(aviso).toHaveTextContent("Dirección médica · Metas: Editar");
    expect(mutate).toHaveBeenCalled();
  });

  it("deshabilita Guardar mientras guarda", async () => {
    let resolver: (v: unknown) => void = () => {};
    mockFetch.mockReturnValue(new Promise((r) => (resolver = r)));
    render(<MatrizPermisos />);

    fireEvent.change(celda("Productividad", "Coordinador"), { target: { value: "ver" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar permisos" }));

    expect(await screen.findByRole("button", { name: "Guardando…" })).toBeDisabled();
    resolver({ ok: true, json: async () => ({ actualizados: 1, permisos: PERMISOS_POR_DEFECTO }) });
    await screen.findByRole("status");
  });

  it("muestra el error de la API y conserva los cambios", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Fila 1: nivel no válido" }) });
    render(<MatrizPermisos />);

    fireEvent.change(celda("Productividad", "Coordinador"), { target: { value: "ver" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar permisos" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fila 1: nivel no válido");
    expect(celda("Productividad", "Coordinador")).toHaveValue("ver");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("Descartar vuelve a los valores guardados", () => {
    render(<MatrizPermisos />);

    fireEvent.change(celda("Productividad", "Coordinador"), { target: { value: "ver" } });
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(celda("Productividad", "Coordinador")).toHaveValue("ninguno");
    expect(screen.getByRole("button", { name: "Guardar permisos" })).toBeDisabled();
  });

  it("muestra el error de carga", () => {
    mockUseSWR.mockReturnValue({ data: undefined, error: new Error("Sin permisos suficientes"), isLoading: false, mutate });
    render(<MatrizPermisos />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sin permisos suficientes");
  });
});
