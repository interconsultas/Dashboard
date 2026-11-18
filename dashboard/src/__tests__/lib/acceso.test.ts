import { esRol, puedeVer, rutaInicio, puedeEditarMetas } from "@/lib/acceso";
import type { Rol } from "@/lib/acceso";

const TODOS: Rol[] = ["admin", "direccion_medica", "coordinador"];

/** Página → roles que pueden abrirla. Cubre todas las páginas bajo src/app. */
const ESPERADO: Array<[string, Rol[]]> = [
  ["/", TODOS],
  ["/dashboard", TODOS],
  ["/dashboard/tipo/rx", TODOS],
  ["/dashboard/tipo/laboratorios", TODOS],
  ["/dashboard/cumplimiento", ["admin", "direccion_medica"]],
  ["/dashboard/productividad", ["admin", "direccion_medica"]],
  ["/admin/metas", ["admin", "direccion_medica"]],
  ["/admin/metas/programas", ["admin", "direccion_medica"]],
  ["/admin/citas", ["admin"]],
  ["/admin/citas/areas", ["admin"]],
  ["/admin/citas-atendidas", ["admin"]],
  ["/admin/carga", ["admin"]],
  ["/admin/medicos", ["admin"]],
  ["/admin/usuarios", ["admin"]],
  ["/admin", ["admin"]],
  ["/admin/ruta-nueva", ["admin"]],
];

describe("puedeVer", () => {
  describe.each(ESPERADO)("%s", (ruta, permitidos) => {
    it.each(TODOS)("rol %s", (rol) => {
      expect(puedeVer(rol, ruta)).toBe(permitidos.includes(rol));
    });
  });

  it("respeta los límites de segmento: /admin/metasx no hereda de /admin/metas", () => {
    expect(puedeVer("direccion_medica", "/admin/metasx")).toBe(false);
    // /dashboard/cumplimientos cae en /dashboard, no en /dashboard/cumplimiento
    expect(puedeVer("coordinador", "/dashboard/cumplimientos")).toBe(true);
    expect(puedeVer("coordinador", "/dashboard/cumplimiento/detalle")).toBe(false);
  });

  it("ignora la barra final", () => {
    expect(puedeVer("coordinador", "/dashboard/")).toBe(true);
    expect(puedeVer("coordinador", "/admin/metas/")).toBe(false);
  });

  it("niega todo a un rol desconocido o ausente", () => {
    expect(puedeVer(null, "/dashboard")).toBe(false);
    expect(puedeVer(undefined, "/")).toBe(false);
    expect(puedeVer("invitado", "/dashboard")).toBe(false);
  });
});

describe("rutaInicio", () => {
  it("admin conserva su inicio en Carga de archivos", () => {
    expect(rutaInicio("admin")).toBe("/admin/carga");
  });

  it("los demás roles inician en el dashboard", () => {
    expect(rutaInicio("direccion_medica")).toBe("/dashboard");
    expect(rutaInicio("coordinador")).toBe("/dashboard");
  });

  it.each(TODOS)("el inicio de %s siempre es visible para ese rol", (rol) => {
    expect(puedeVer(rol, rutaInicio(rol))).toBe(true);
  });
});

describe("esRol", () => {
  it("reconoce solo los tres roles", () => {
    for (const rol of TODOS) expect(esRol(rol)).toBe(true);
    expect(esRol("invitado")).toBe(false);
    expect(esRol(undefined)).toBe(false);
  });
});

describe("puedeEditarMetas", () => {
  it("solo admin edita metas, igual que el PUT de la API", () => {
    expect(puedeEditarMetas("admin")).toBe(true);
    expect(puedeEditarMetas("direccion_medica")).toBe(false);
    expect(puedeEditarMetas("coordinador")).toBe(false);
    expect(puedeEditarMetas(null)).toBe(false);
  });
});
