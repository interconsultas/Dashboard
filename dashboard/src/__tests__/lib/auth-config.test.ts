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

  describe("páginas permitidas", () => {
    it.each([
      ["admin", "/admin/usuarios"],
      ["admin", "/dashboard/productividad"],
      ["direccion_medica", "/dashboard/cumplimiento"],
      ["direccion_medica", "/admin/metas/programas"],
      ["coordinador", "/dashboard"],
      ["coordinador", "/dashboard/tipo/rx"],
    ])("%s en %s → true", async (rol, ruta) => {
      expect(await evaluar(ruta, rol)).toBe(true);
    });
  });

  describe("páginas sin acceso redirigen al inicio con aviso", () => {
    it.each([
      ["coordinador", "/dashboard/cumplimiento"],
      ["coordinador", "/dashboard/productividad"],
      ["coordinador", "/admin/metas"],
      ["coordinador", "/admin/carga"],
      ["direccion_medica", "/admin/citas"],
      ["direccion_medica", "/admin/citas/areas"],
      ["direccion_medica", "/admin/citas-atendidas"],
      ["direccion_medica", "/admin/medicos"],
      ["direccion_medica", "/admin/usuarios"],
      ["direccion_medica", "/admin/carga"],
    ])("%s en %s → /dashboard?sin_acceso=1", async (rol, ruta) => {
      expect(destino(await evaluar(ruta, rol))).toBe("/dashboard?sin_acceso=1");
    });
  });

  describe("raíz y login llevan al inicio de cada rol", () => {
    it.each([
      ["admin", "/admin/carga"],
      ["direccion_medica", "/dashboard"],
      ["coordinador", "/dashboard"],
    ])("%s en / → %s", async (rol, inicio) => {
      expect(destino(await evaluar("/", rol))).toBe(inicio);
    });

    it("con sesión, /login lleva al inicio del rol", async () => {
      expect(destino(await evaluar("/login", "coordinador"))).toBe("/dashboard");
      expect(destino(await evaluar("/login", "admin"))).toBe("/admin/carga");
    });
  });

  it("las rutas /api no se filtran aquí: cada una valida su rol con requireAuth", async () => {
    expect(await evaluar("/api/admin/medicos", "coordinador")).toBe(true);
  });

  it("un rol desconocido no entra a ninguna página (vuelve al login, sin bucles)", async () => {
    expect(await evaluar("/dashboard", "invitado")).toBe(false);
    expect(await evaluar("/dashboard", undefined)).toBe(false);
  });
});
