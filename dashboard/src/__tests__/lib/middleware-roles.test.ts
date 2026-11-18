jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/permisos", () => ({ obtenerPermisos: jest.fn() }));

import { auth } from "@/lib/auth";
import { obtenerPermisos } from "@/lib/permisos";
import { requirePermiso } from "@/lib/middleware-roles";
import { PERMISOS_POR_DEFECTO } from "@/lib/acceso";

const mockAuth = auth as unknown as jest.Mock;
const mockObtener = obtenerPermisos as jest.MockedFunction<typeof obtenerPermisos>;

function sesion(rol: string) {
  return { user: { id: "7", email: "x@ips.local", rol, regional: "CENTRO" } };
}

describe("requirePermiso", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockObtener.mockImplementation(async (rol) => PERMISOS_POR_DEFECTO[rol]);
  });

  it("sin sesión responde 401", async () => {
    mockAuth.mockResolvedValue(null);
    const { error, user } = await requirePermiso({ secciones: ["dashboard"], nivel: "ver" });
    expect(error!.status).toBe(401);
    expect(user).toBeNull();
  });

  it("con un rol desconocido responde 403 sin leer permisos", async () => {
    mockAuth.mockResolvedValue(sesion("invitado"));
    const { error } = await requirePermiso({ secciones: ["dashboard"], nivel: "ver" });
    expect(error!.status).toBe(403);
    expect(mockObtener).not.toHaveBeenCalled();
  });

  it("deja pasar si los permisos del rol cumplen el requisito y devuelve el usuario", async () => {
    mockAuth.mockResolvedValue(sesion("coordinador"));
    const { error, user } = await requirePermiso({ secciones: ["dashboard"], nivel: "ver" });
    expect(error).toBeNull();
    expect(user).toEqual(expect.objectContaining({ rol: "coordinador", regional: "CENTRO" }));
    expect(mockObtener).toHaveBeenCalledWith("coordinador");
  });

  it("responde 403 si el nivel no alcanza", async () => {
    mockAuth.mockResolvedValue(sesion("direccion_medica"));
    const { error } = await requirePermiso({ secciones: ["metas"], nivel: "editar" });
    expect(error!.status).toBe(403);
    expect(await error!.json()).toEqual({ error: "Sin permisos suficientes" });
  });

  it("sigue los permisos configurados (no el rol fijo)", async () => {
    mockAuth.mockResolvedValue(sesion("coordinador"));
    mockObtener.mockResolvedValue({ ...PERMISOS_POR_DEFECTO.coordinador, productividad: "ver" });
    const { error } = await requirePermiso({ secciones: ["productividad"], nivel: "ver" });
    expect(error).toBeNull();
  });
});
