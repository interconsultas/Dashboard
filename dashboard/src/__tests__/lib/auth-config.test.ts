import { authConfig } from "@/auth.config";

type Authorized = NonNullable<NonNullable<typeof authConfig.callbacks>["authorized"]>;
const authorized = authConfig.callbacks!.authorized as Authorized;

function sesion(rol: string | undefined) {
  return { user: { email: "x@ips.co", rol }, expires: "2099-01-01" };
}

async function evaluar(ruta: string, rol: string | null | undefined) {
  const nextUrl = new URL(`http://localhost:3000${ruta}`);
  const auth = rol === null ? null : sesion(rol);
  // El callback solo usa auth y request.nextUrl
  return authorized({ auth, request: { nextUrl } } as unknown as Parameters<Authorized>[0]);
}

function destino(res: unknown): string | null {
  if (!(res instanceof Response)) return null;
  const url = new URL(res.headers.get("location")!);
  return `${url.pathname}${url.search}`;
}

describe("authConfig.callbacks.authorized", () => {
  describe("sin sesión (igual que antes)", () => {
    it.each(["/", "/dashboard", "/admin/carga", "/api/dashboard/kpis"])("%s → false (login)", async (ruta) => {
      expect(await evaluar(ruta, null)).toBe(false);
    });

    it("/login sin sesión se permite", async () => {
      expect(await evaluar("/login", null)).toBe(true);
    });
  });

  describe("con sesión, las páginas pasan: el acceso por sección lo validan los layouts del servidor", () => {
    it.each([
      ["admin", "/admin/usuarios"],
      ["direccion_medica", "/admin/metas/programas"],
      ["coordinador", "/dashboard"],
      // Antes se negaba aquí; ahora depende de permisos_rol (en el servidor)
      ["coordinador", "/dashboard/productividad"],
      ["direccion_medica", "/admin/carga"],
      ["coordinador", "/"],
      ["coordinador", "/sin-acceso"],
    ])("%s en %s → true", async (rol, ruta) => {
      expect(await evaluar(ruta, rol)).toBe(true);
    });
  });

  it("con sesión, /login lleva a la raíz, que resuelve el inicio del rol", async () => {
    expect(destino(await evaluar("/login", "coordinador"))).toBe("/");
    expect(destino(await evaluar("/login", "admin"))).toBe("/");
  });

  it("las rutas /api no se filtran aquí: cada una valida su permiso con requirePermiso", async () => {
    expect(await evaluar("/api/admin/medicos", "coordinador")).toBe(true);
  });

  it("un rol desconocido no entra a ninguna página (vuelve al login, sin bucles)", async () => {
    expect(await evaluar("/dashboard", "invitado")).toBe(false);
    expect(await evaluar("/dashboard", undefined)).toBe(false);
  });
});
