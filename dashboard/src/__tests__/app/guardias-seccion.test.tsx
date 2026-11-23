/**
 * Cada página valida su sección en el servidor (layout de la sección o la
 * propia página). El middleware solo exige sesión.
 */
jest.mock("@/lib/acceso-servidor", () => ({
  exigirSeccion: jest.fn(async () => "completo"),
  rutaDeEntrada: jest.fn(async () => "/dashboard/productividad"),
  sesionConPermisos: jest.fn(async () => ({ rol: "coordinador", permisos: PERMISOS_PRUEBA, enDesarrollo: EN_DESARROLLO })),
}));
const PERMISOS_PRUEBA = { dashboard: "ver", productividad: "ver" };
const EN_DESARROLLO = ["inteligencia"];
jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
jest.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: unknown }) => children }));
jest.mock("@/components/dashboard/DashboardView", () => ({ __esModule: true, default: () => null }));

import React from "react";
import { exigirSeccion } from "@/lib/acceso-servidor";
import { RolProvider } from "@/components/layout/RolContext";
import type { Seccion } from "@/lib/acceso";

const mockExigir = exigirSeccion as jest.MockedFunction<typeof exigirSeccion>;

type Layout = (props: { children: React.ReactNode }) => Promise<React.ReactNode>;

const LAYOUTS: Array<[string, Seccion, () => Promise<{ default: Layout }>]> = [
  ["dashboard/tipo", "dashboard", () => import("@/app/dashboard/tipo/layout")],
  ["dashboard/cumplimiento", "cumplimiento", () => import("@/app/dashboard/cumplimiento/layout")],
  ["dashboard/productividad", "productividad", () => import("@/app/dashboard/productividad/layout")],
  ["dashboard/inteligencia", "inteligencia", () => import("@/app/dashboard/inteligencia/layout")],
  ["admin/carga", "carga", () => import("@/app/admin/carga/layout")],
  ["admin/medicos", "profesionales", () => import("@/app/admin/medicos/layout")],
  ["admin/metas", "metas", () => import("@/app/admin/metas/layout")],
  ["admin/citas", "citas", () => import("@/app/admin/citas/layout")],
  ["admin/citas-atendidas", "citas", () => import("@/app/admin/citas-atendidas/layout")],
  ["admin/usuarios", "usuarios", () => import("@/app/admin/usuarios/layout")],
];

describe("guardias de sección", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(LAYOUTS)("layout de %s exige la sección %s y muestra su contenido", async (_ruta, seccion, cargar) => {
    const { default: SeccionLayout } = await cargar();
    const hijo = <p>contenido</p>;

    const resultado = await SeccionLayout({ children: hijo });

    expect(mockExigir).toHaveBeenCalledWith(seccion);
    expect(resultado).toBe(hijo);
  });

  it("si exigirSeccion redirige, el layout no muestra el contenido", async () => {
    mockExigir.mockRejectedValueOnce(new Error("REDIRECT:/dashboard?sin_acceso=1"));
    const { default: SeccionLayout } = await import("@/app/admin/metas/layout");
    await expect(SeccionLayout({ children: <p>x</p> })).rejects.toThrow("REDIRECT");
  });

  it("/dashboard exige la sección dashboard en la propia página", async () => {
    const { default: DashboardPage } = await import("@/app/dashboard/page");
    await DashboardPage();
    expect(mockExigir).toHaveBeenCalledWith("dashboard");
  });

  it("la raíz redirige a la ruta de entrada del rol", async () => {
    const { default: HomePage } = await import("@/app/page");
    await expect(HomePage()).rejects.toThrow("REDIRECT:/dashboard/productividad");
  });

  it.each([
    ["admin", () => import("@/app/admin/layout")],
    ["dashboard", () => import("@/app/dashboard/layout")],
  ])("el layout de /%s pasa el rol, los permisos efectivos y los módulos en desarrollo al menú", async (_n, cargar) => {
    const { default: Layout } = await cargar();
    const arbol = (await Layout({ children: <p>x</p> })) as React.ReactElement<{
      rol: string;
      permisos: unknown;
      enDesarrollo: unknown;
    }>;
    expect(arbol.type).toBe(RolProvider);
    expect(arbol.props.rol).toBe("coordinador");
    expect(arbol.props.permisos).toBe(PERMISOS_PRUEBA);
    expect(arbol.props.enDesarrollo).toBe(EN_DESARROLLO);
  });
});
