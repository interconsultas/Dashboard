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

const boton = (accion: "Ver" | "Editar", seccion: string, rol: string) =>
  screen.getByRole("button", { name: `${accion} ${seccion} — ${rol}` });
const ver = (seccion: string, rol: string) => boton("Ver", seccion, rol);
const editar = (seccion: string, rol: string) => boton("Editar", seccion, rol);

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

    expect(ver("Metas", "Dirección médica")).toHaveAttribute("aria-pressed", "true");
    expect(editar("Metas", "Dirección médica")).toHaveAttribute("aria-pressed", "false");
    expect(ver("Productividad", "Coordinador")).toHaveAttribute("aria-pressed", "false");
  });

  it("la columna de administrador es fija (todo activo) y usuarios no se configura", () => {
    render(<MatrizPermisos />);

    expect(ver("Metas", "Administrador")).toHaveAttribute("aria-pressed", "true");
    expect(ver("Metas", "Administrador")).toBeDisabled();
    expect(editar("Metas", "Administrador")).toBeDisabled();
    expect(ver("Usuarios", "Coordinador")).toBeDisabled();
    expect(ver("Usuarios", "Coordinador")).toHaveAttribute("aria-pressed", "false");
    const filaUsuarios = screen.getByText("Usuarios", { selector: "td *, td" }).closest("tr") as HTMLElement;
    expect(within(filaUsuarios).getAllByRole("button").filter((b) => !b.hasAttribute("disabled"))).toHaveLength(0);
  });

  it("Editar está deshabilitado en las secciones de solo consulta", () => {
    render(<MatrizPermisos />);

    expect(editar("Productividad", "Coordinador")).toBeDisabled();
    expect(editar("Metas", "Coordinador")).toBeEnabled();
  });

  it("activar Editar activa Ver y quitar Ver quita Editar", () => {
    render(<MatrizPermisos />);

    fireEvent.click(editar("Metas", "Coordinador"));
    expect(ver("Metas", "Coordinador")).toHaveAttribute("aria-pressed", "true");
    expect(editar("Metas", "Coordinador")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(ver("Metas", "Coordinador"));
    expect(ver("Metas", "Coordinador")).toHaveAttribute("aria-pressed", "false");
    expect(editar("Metas", "Coordinador")).toHaveAttribute("aria-pressed", "false");
  });

  it("Guardar está deshabilitado sin cambios", () => {
    render(<MatrizPermisos />);
    expect(screen.getByRole("button", { name: "Guardar permisos" })).toBeDisabled();
  });

  it("envía solo lo que cambió y confirma lo guardado", async () => {
    render(<MatrizPermisos />);

    fireEvent.click(ver("Productividad", "Coordinador"));
    fireEvent.click(editar("Metas", "Dirección médica"));
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

    fireEvent.click(ver("Productividad", "Coordinador"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar permisos" }));

    expect(await screen.findByRole("button", { name: "Guardando…" })).toBeDisabled();
    resolver({ ok: true, json: async () => ({ actualizados: 1, permisos: PERMISOS_POR_DEFECTO }) });
    await screen.findByRole("status");
  });

  it("muestra el error de la API y conserva los cambios", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Fila 1: nivel no válido" }) });
    render(<MatrizPermisos />);

    fireEvent.click(ver("Productividad", "Coordinador"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar permisos" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fila 1: nivel no válido");
    expect(ver("Productividad", "Coordinador")).toHaveAttribute("aria-pressed", "true");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("Descartar vuelve a los valores guardados", () => {
    render(<MatrizPermisos />);

    fireEvent.click(ver("Productividad", "Coordinador"));
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(ver("Productividad", "Coordinador")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Guardar permisos" })).toBeDisabled();
  });

  it("muestra el error de carga", () => {
    mockUseSWR.mockReturnValue({ data: undefined, error: new Error("Sin permisos suficientes"), isLoading: false, mutate });
    render(<MatrizPermisos />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sin permisos suficientes");
  });
});
