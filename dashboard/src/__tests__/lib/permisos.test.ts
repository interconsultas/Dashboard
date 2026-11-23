jest.mock("@/lib/db", () => ({ query: jest.fn() }));

import { query } from "@/lib/db";
import { obtenerPermisos, invalidarPermisos, TTL_PERMISOS_MS } from "@/lib/permisos";
import { PERMISOS_POR_DEFECTO } from "@/lib/acceso";

const mockQuery = query as jest.MockedFunction<typeof query>;

const FILAS = [
  { rol: "coordinador", seccion: "dashboard", nivel: "ver" },
  { rol: "coordinador", seccion: "productividad", nivel: "ver" },
  { rol: "direccion_medica", seccion: "metas", nivel: "editar" },
];

describe("obtenerPermisos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    invalidarPermisos();
    mockQuery.mockResolvedValue(FILAS as never);
  });

  it("aplica las filas de permisos_rol al rol", async () => {
    const p = await obtenerPermisos("coordinador");
    expect(p.productividad).toBe("ver");
    expect(p.metas).toBe("ninguno");
    expect(mockQuery.mock.calls[0][0]).toContain("FROM permisos_rol");
  });

  it("admin tiene acceso total sin consultar la base de datos", async () => {
    expect(await obtenerPermisos("admin")).toEqual(PERMISOS_POR_DEFECTO.admin);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("guarda la tabla en caché: una sola consulta para varios roles y llamadas", async () => {
    await obtenerPermisos("coordinador");
    await obtenerPermisos("direccion_medica");
    await obtenerPermisos("coordinador");
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("vuelve a consultar cuando vence el TTL", async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    await obtenerPermisos("coordinador");
    jest.setSystemTime(1_000_000 + TTL_PERMISOS_MS + 1);
    await obtenerPermisos("coordinador");
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("invalidarPermisos obliga a leer de nuevo (cambios visibles de inmediato)", async () => {
    await obtenerPermisos("coordinador");
    mockQuery.mockResolvedValue([{ rol: "coordinador", seccion: "dashboard", nivel: "ver" }] as never);
    invalidarPermisos();
    expect((await obtenerPermisos("coordinador")).productividad).toBe("ninguno");
  });

  it("consultas simultáneas comparten una sola lectura", async () => {
    await Promise.all([obtenerPermisos("coordinador"), obtenerPermisos("direccion_medica")]);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("si la tabla aún no existe (018 sin aplicar) usa el acceso fijo anterior", async () => {
    mockQuery.mockRejectedValue(Object.assign(new Error("no existe"), { code: "42P01" }));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(await obtenerPermisos("coordinador")).toEqual(PERMISOS_POR_DEFECTO.coordinador);
    spy.mockRestore();
  });

  it("otros errores de la base de datos se propagan y no quedan en caché", async () => {
    mockQuery.mockRejectedValueOnce(new Error("conexión rechazada"));
    await expect(obtenerPermisos("coordinador")).rejects.toThrow("conexión rechazada");
    expect((await obtenerPermisos("coordinador")).productividad).toBe("ver");
  });
});
