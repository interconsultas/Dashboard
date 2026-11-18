/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUsePathname = jest.fn();

jest.mock("next/navigation", () => ({ usePathname: () => mockUsePathname() }));
jest.mock("next-auth/react", () => ({ signOut: jest.fn() }));
jest.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

import { Sidebar } from "@/components/layout/Sidebar";
import { RolProvider } from "@/components/layout/RolContext";
import type { Rol } from "@/lib/acceso";

/** Por defecto admin: ve todo el menú, como antes de filtrar por rol. */
function renderSidebar(rol: Rol | null = "admin") {
  return render(
    <RolProvider rol={rol}>
      <Sidebar />
    </RolProvider>,
  );
}

function enlace(nombre: string) {
  return screen.getByRole("link", { name: nombre });
}

describe("Sidebar — entrada Citas", () => {
  it("se llama Citas y enlaza a /admin/citas", () => {
    mockUsePathname.mockReturnValue("/admin/carga");
    renderSidebar();

    expect(enlace("Citas")).toHaveAttribute("href", "/admin/citas");
    expect(screen.queryByRole("link", { name: "Citas atendidas" })).not.toBeInTheDocument();
  });

  it("en /admin/citas resalta Citas", () => {
    mockUsePathname.mockReturnValue("/admin/citas");
    renderSidebar();

    expect(enlace("Citas")).toHaveClass("bg-brand-green");
  });
});

describe("Sidebar — entrada Cumplimiento", () => {
  it("enlaza a /dashboard/cumplimiento", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    renderSidebar();

    expect(enlace("Cumplimiento")).toHaveAttribute("href", "/dashboard/cumplimiento");
  });

  it("en /dashboard/cumplimiento resalta Cumplimiento y no resalta Dashboard", () => {
    mockUsePathname.mockReturnValue("/dashboard/cumplimiento");
    renderSidebar();

    expect(enlace("Cumplimiento")).toHaveClass("bg-brand-green");
    expect(enlace("Dashboard")).not.toHaveClass("bg-brand-green");
    expect(enlace("Dashboard")).not.toHaveClass("bg-white/10");
  });

  it("en /dashboard resalta Dashboard y no resalta Cumplimiento", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    renderSidebar();

    expect(enlace("Dashboard")).toHaveClass("bg-brand-green");
    expect(enlace("Cumplimiento")).not.toHaveClass("bg-brand-green");
  });

  it("en una subvista del dashboard mantiene el comportamiento anterior y no resalta Cumplimiento", () => {
    mockUsePathname.mockReturnValue("/dashboard/tipo/rx");
    renderSidebar();

    expect(enlace("Dashboard")).toHaveClass("bg-white/10");
    expect(enlace("RX")).toHaveClass("bg-brand-green/90");
    expect(enlace("Cumplimiento")).not.toHaveClass("bg-brand-green");
  });
});

describe("Sidebar — entrada Productividad", () => {
  it("enlaza a /dashboard/productividad justo debajo de Cumplimiento", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    renderSidebar();

    expect(enlace("Productividad")).toHaveAttribute("href", "/dashboard/productividad");
    const nombres = screen.getAllByRole("link").map((l) => l.textContent?.trim());
    expect(nombres.indexOf("Productividad")).toBe(nombres.indexOf("Cumplimiento") + 1);
  });

  it("en /dashboard/productividad resalta Productividad y no Dashboard ni Cumplimiento", () => {
    mockUsePathname.mockReturnValue("/dashboard/productividad");
    renderSidebar();

    expect(enlace("Productividad")).toHaveClass("bg-brand-green");
    expect(enlace("Dashboard")).not.toHaveClass("bg-brand-green");
    expect(enlace("Dashboard")).not.toHaveClass("bg-white/10");
    expect(enlace("Cumplimiento")).not.toHaveClass("bg-brand-green");
  });
});

describe("Sidebar — enlaces según el rol", () => {
  const SUBITEMS = ["Laboratorios", "RX", "Asesorias"];

  function nombresMenu() {
    return screen.getAllByRole("link").map((l) => l.textContent?.trim());
  }

  beforeEach(() => mockUsePathname.mockReturnValue("/dashboard"));

  it("admin ve todas las entradas", () => {
    renderSidebar("admin");
    expect(nombresMenu()).toEqual(
      expect.arrayContaining([
        "Dashboard", "Cumplimiento", "Productividad", "Carga de archivos",
        "Profesionales", "Metas", "Citas", "Usuarios", ...SUBITEMS,
      ]),
    );
  });

  it("direccion_medica ve Dashboard, Cumplimiento, Productividad y Metas", () => {
    renderSidebar("direccion_medica");
    const nombres = nombresMenu();
    expect(nombres).toEqual(
      expect.arrayContaining(["Dashboard", "Cumplimiento", "Productividad", "Metas", ...SUBITEMS]),
    );
    for (const oculto of ["Carga de archivos", "Profesionales", "Citas", "Usuarios"]) {
      expect(nombres).not.toContain(oculto);
    }
  });

  it("coordinador ve solo el Dashboard y sus tipos de prestación", () => {
    renderSidebar("coordinador");
    const nombres = nombresMenu();
    expect(nombres).toEqual(expect.arrayContaining(["Dashboard", ...SUBITEMS]));
    for (const oculto of ["Cumplimiento", "Productividad", "Carga de archivos", "Profesionales", "Metas", "Citas", "Usuarios"]) {
      expect(nombres).not.toContain(oculto);
    }
    expect(screen.getByRole("button", { name: /cerrar sesion/i })).toBeInTheDocument();
  });

  it("sin rol no muestra enlaces", () => {
    renderSidebar(null);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
