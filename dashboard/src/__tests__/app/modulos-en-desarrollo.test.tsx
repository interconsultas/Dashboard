/**
 * @jest-environment jsdom
 *
 * Productividad e Inteligencia en desarrollo: quien los vería ya liberados ve
 * el aviso "Módulo en desarrollo"; admin ve el módulo con el aviso de vista
 * previa; quien no tiene permiso en la matriz sigue sin acceso (redirige).
 */
jest.mock("@/lib/acceso-servidor", () => ({ exigirSeccion: jest.fn() }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { exigirSeccion } from "@/lib/acceso-servidor";

const mockExigir = exigirSeccion as jest.MockedFunction<typeof exigirSeccion>;

type Layout = (props: { children: React.ReactNode }) => Promise<React.ReactNode>;

const MODULOS: Array<[string, string, RegExp, () => Promise<{ default: Layout }>]> = [
  ["productividad", "Productividad", /Fase 2 del cronograma/, () => import("@/app/dashboard/productividad/layout")],
  ["inteligencia", "Inteligencia", /Fase 3 del cronograma/, () => import("@/app/dashboard/inteligencia/layout")],
];

async function renderLayout(cargar: () => Promise<{ default: Layout }>) {
  const { default: SeccionLayout } = await cargar();
  const arbol = await SeccionLayout({ children: <p>contenido real</p> });
  return render(<>{arbol}</>);
}

describe.each(MODULOS)("módulo %s en desarrollo", (seccion, nombre, fase, cargar) => {
  beforeEach(() => jest.clearAllMocks());

  it("a quien lo vería ya liberado le muestra el aviso, no el módulo", async () => {
    mockExigir.mockResolvedValue("en_desarrollo");
    await renderLayout(cargar);

    expect(mockExigir).toHaveBeenCalledWith(seccion);
    expect(screen.queryByText("contenido real")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: nombre })).toBeInTheDocument();
    expect(screen.getByText("Módulo en desarrollo")).toBeInTheDocument();
    expect(screen.getByText(fase)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/Vista previa/)).not.toBeInTheDocument();
  });

  it("admin ve el módulo real con el aviso fijo de vista previa", async () => {
    mockExigir.mockResolvedValue("vista_previa");
    await renderLayout(cargar);

    expect(screen.getByText("contenido real")).toBeInTheDocument();
    const aviso = screen.getByRole("note");
    expect(aviso).toHaveTextContent("Vista previa — módulo en desarrollo, solo visible para administradores");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("Módulo en desarrollo")).not.toBeInTheDocument();
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
