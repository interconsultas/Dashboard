/**
 * @jest-environment jsdom
 *
 * Productividad e Inteligencia en desarrollo: quien los vería ya liberados
 * (admin incluido) ve solo el aviso "Módulo en desarrollo", nada del módulo;
 * quien no tiene permiso en la matriz sigue sin acceso (redirige).
 */
jest.mock("@/lib/acceso-servidor", () => ({ exigirSeccion: jest.fn() }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { exigirSeccion } from "@/lib/acceso-servidor";

const mockExigir = exigirSeccion as jest.MockedFunction<typeof exigirSeccion>;

type Layout = (props: { children: React.ReactNode }) => Promise<React.ReactNode>;

const MODULOS: Array<[string, string, () => Promise<{ default: Layout }>]> = [
  ["productividad", "Productividad", () => import("@/app/dashboard/productividad/layout")],
  ["inteligencia", "Inteligencia", () => import("@/app/dashboard/inteligencia/layout")],
];

async function renderLayout(cargar: () => Promise<{ default: Layout }>) {
  const { default: SeccionLayout } = await cargar();
  const arbol = await SeccionLayout({ children: <p>contenido real</p> });
  return render(<>{arbol}</>);
}

describe.each(MODULOS)("módulo %s en desarrollo", (seccion, nombre, cargar) => {
  beforeEach(() => jest.clearAllMocks());

  it("muestra solo el aviso: encabezado con el nombre y la tarjeta de módulo en desarrollo", async () => {
    mockExigir.mockResolvedValue("en_desarrollo");
    await renderLayout(cargar);

    expect(mockExigir).toHaveBeenCalledWith(seccion);
    expect(screen.queryByText("contenido real")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: nombre })).toBeInTheDocument();
    const aviso = screen.getByRole("status");
    expect(within(aviso).getByText("Módulo en desarrollo")).toBeInTheDocument();
    expect(within(aviso).getByText("Este módulo estará disponible próximamente.")).toBeInTheDocument();
  });

  it("no revela nada del módulo: ni funcionalidades, ni fase, ni enlaces, ni exportación", async () => {
    mockExigir.mockResolvedValue("en_desarrollo");
    await renderLayout(cargar);

    expect(within(screen.getByRole("status")).queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText(/Fase|cronograma|Incluirá/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText(/Vista previa/)).not.toBeInTheDocument();
  });

  it("ya liberado muestra el módulo sin avisos", async () => {
    mockExigir.mockResolvedValue("completo");
    await renderLayout(cargar);

    expect(screen.getByText("contenido real")).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.queryByText("Módulo en desarrollo")).not.toBeInTheDocument();
  });

  it("sin permiso en la matriz no muestra nada: exigirSeccion redirige", async () => {
    mockExigir.mockRejectedValue(new Error("REDIRECT:/dashboard?sin_acceso=1"));
    const { default: SeccionLayout } = await cargar();
    await expect(SeccionLayout({ children: <p>x</p> })).rejects.toThrow("REDIRECT");
  });
});
