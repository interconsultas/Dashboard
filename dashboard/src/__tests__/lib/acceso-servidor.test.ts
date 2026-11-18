jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
jest.mock("@/lib/middleware-roles", () => ({ rolDeSesion: jest.fn() }));
jest.mock("@/lib/permisos", () => ({ obtenerPermisos: jest.fn() }));

import { rolDeSesion } from "@/lib/middleware-roles";
import { obtenerPermisos } from "@/lib/permisos";
import { exigirSeccion, sesionConPermisos, rutaDeEntrada } from "@/lib/acceso-servidor";
import { PERMISOS_POR_DEFECTO, SECCIONES, type Permisos } from "@/lib/acceso";

const mockRol = rolDeSesion as jest.MockedFunction<typeof rolDeSesion>;
const mockObtener = obtenerPermisos as jest.MockedFunction<typeof obtenerPermisos>;

const NINGUNO = Object.fromEntries(SECCIONES.map((s) => [s.clave, "ninguno"])) as Permisos;

describe("acceso-servidor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockObtener.mockImplementation(async (rol) => PERMISOS_POR_DEFECTO[rol]);
  });

  describe("exigirSeccion", () => {
    it("sin sesión envía al login", async () => {
      mockRol.mockResolvedValue(null);
      await expect(exigirSeccion("dashboard")).rejects.toThrow("REDIRECT:/login");
    });

    it("con permiso de ver no redirige", async () => {
      mockRol.mockResolvedValue("coordinador");
      await expect(exigirSeccion("dashboard")).resolves.toBeUndefined();
    });

    it("sin permiso redirige al inicio del rol con el aviso", async () => {
      mockRol.mockResolvedValue("coordinador");
      await expect(exigirSeccion("productividad")).rejects.toThrow("REDIRECT:/dashboard?sin_acceso=1");
    });

    it("sigue los permisos configurados", async () => {
      mockRol.mockResolvedValue("coordinador");
      mockObtener.mockResolvedValue({ ...PERMISOS_POR_DEFECTO.coordinador, productividad: "ver" });
      await expect(exigirSeccion("productividad")).resolves.toBeUndefined();
    });

    it("si el rol no ve el dashboard, redirige a su primera sección visible", async () => {
      mockRol.mockResolvedValue("coordinador");
      mockObtener.mockResolvedValue({ ...NINGUNO, metas: "ver" });
      await expect(exigirSeccion("dashboard")).rejects.toThrow("REDIRECT:/admin/metas?sin_acceso=1");
    });

    it("sin ninguna sección va a la página fija /sin-acceso", async () => {
      mockRol.mockResolvedValue("coordinador");
      mockObtener.mockResolvedValue(NINGUNO);
      await expect(exigirSeccion("dashboard")).rejects.toThrow("REDIRECT:/sin-acceso");
    });

    it("admin entra a todo", async () => {
      mockRol.mockResolvedValue("admin");
      await expect(exigirSeccion("usuarios")).resolves.toBeUndefined();
    });
  });

  describe("rutaDeEntrada", () => {
    it("lleva al inicio del rol", async () => {
      mockRol.mockResolvedValue("admin");
      expect(await rutaDeEntrada()).toBe("/admin/carga");
      mockRol.mockResolvedValue("coordinador");
      expect(await rutaDeEntrada()).toBe("/dashboard");
    });

    it("sin secciones lleva a /sin-acceso y sin sesión al login", async () => {
      mockRol.mockResolvedValue("coordinador");
      mockObtener.mockResolvedValue(NINGUNO);
      expect(await rutaDeEntrada()).toBe("/sin-acceso");
      mockRol.mockResolvedValue(null);
      expect(await rutaDeEntrada()).toBe("/login");
    });
  });

  describe("sesionConPermisos", () => {
    it("devuelve el rol y sus permisos efectivos", async () => {
      mockRol.mockResolvedValue("direccion_medica");
      expect(await sesionConPermisos()).toEqual({
        rol: "direccion_medica",
        permisos: PERMISOS_POR_DEFECTO.direccion_medica,
      });
    });

    it("sin sesión no consulta permisos", async () => {
      mockRol.mockResolvedValue(null);
      expect(await sesionConPermisos()).toEqual({ rol: null, permisos: null });
      expect(mockObtener).not.toHaveBeenCalled();
    });
  });
});
