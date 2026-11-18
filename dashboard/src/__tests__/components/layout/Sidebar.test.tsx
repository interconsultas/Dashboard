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

// La insignia consulta la API: aquí solo importa dónde se monta
jest.mock("@/components/layout/InsigniaAlertas", () => ({
  InsigniaAlertas: () => <span data-testid="insignia-alertas" />,
}));

import { Sidebar } from "@/components/layout/Sidebar";
import { RolProvider } from "@/components/layout/RolContext";
import { PERMISOS_POR_DEFECTO, type Permisos, type Rol } from "@/lib/acceso";

/** Por defecto admin: ve todo el menú. Sin permisos explícitos usa los del rol por defecto. */
function renderSidebar(rol: Rol | null = "admin", permisos?: Permisos | null) {
  return render(
    <RolProvider rol={rol} permisos={permisos}>
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

describe("Sidebar — entrada Inteligencia", () => {
  it("enlaza a /dashboard/inteligencia justo debajo de Productividad", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    renderSidebar();

    expect(enlace("Inteligencia")).toHaveAttribute("href", "/dashboard/inteligencia");
    const nombres = screen.getAllByRole("link").map((l) => l.textContent?.trim());
    expect(nombres.indexOf("Inteligencia")).toBe(nombres.indexOf("Productividad") + 1);
  });

  it("en /dashboard/inteligencia resalta Inteligencia y no Dashboard ni Productividad", () => {
    mockUsePathname.mockReturnValue("/dashboard/inteligencia");
    renderSidebar();

    expect(enlace("Inteligencia")).toHaveClass("bg-brand-green");
    expect(enlace("Dashboard")).not.toHaveClass("bg-brand-green");
    expect(enlace("Dashboard")).not.toHaveClass("bg-white/10");
    expect(enlace("Productividad")).not.toHaveClass("bg-brand-green");
  });

  it("muestra la insignia de alertas dentro del enlace solo a quien ve Inteligencia", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    renderSidebar("direccion_medica");
    expect(enlace("Inteligencia")).toContainElement(screen.getByTestId("insignia-alertas"));
  });

  it("sin acceso a Inteligencia no monta la insignia (no consulta el conteo)", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    renderSidebar("coordinador");
    expect(screen.queryByTestId("insignia-alertas")).not.toBeInTheDocument();
  });

  it("coordinador no la ve con los permisos por defecto", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    renderSidebar("coordinador");
    expect(screen.queryByRole("link", { name: "Inteligencia" })).not.toBeInTheDocument();
  });

  it("direccion_medica la ve con los permisos por defecto", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    renderSidebar("direccion_medica");
    expect(enlace("Inteligencia")).toBeInTheDocument();
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

describe("Sidebar — permisos configurados", () => {
  beforeEach(() => mockUsePathname.mockReturnValue("/dashboard"));

  function nombresMenu() {
    return screen.getAllByRole("link").map((l) => l.textContent?.trim());
  }

  it("coordinador con Productividad asignada la ve en el menú", () => {
    renderSidebar("coordinador", { ...PERMISOS_POR_DEFECTO.coordinador, productividad: "ver" });
    expect(nombresMenu()).toContain("Productividad");
    expect(nombresMenu()).not.toContain("Cumplimiento");
  });

  it("dirección médica sin Dashboard no ve Dashboard ni sus tipos", () => {
    renderSidebar("direccion_medica", { ...PERMISOS_POR_DEFECTO.direccion_medica, dashboard: "ninguno" });
    const nombres = nombresMenu();
    expect(nombres).not.toContain("Dashboard");
    expect(nombres).not.toContain("RX");
    expect(nombres).toEqual(expect.arrayContaining(["Cumplimiento", "Productividad", "Metas"]));
  });

  it("sin permisos no muestra enlaces", () => {
    renderSidebar("coordinador", null);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
