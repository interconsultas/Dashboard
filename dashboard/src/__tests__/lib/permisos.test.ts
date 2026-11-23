jest.mock("@/lib/db", () => ({ query: jest.fn() }));

import { query } from "@/lib/db";
import { obtenerPermisos, obtenerEnDesarrollo, invalidarPermisos, TTL_PERMISOS_MS } from "@/lib/permisos";
import { PERMISOS_POR_DEFECTO } from "@/lib/acceso";

const mockQuery = query as jest.MockedFunction<typeof query>;

const FILAS = [
  { rol: "coordinador", seccion: "dashboard", nivel: "ver" },
  { rol: "coordinador", seccion: "productividad", nivel: "ver" },
  { rol: "direccion_medica", seccion: "metas", nivel: "editar" },
];

const MODULOS_ORIGINAL = process.env.MODULOS_EN_DESARROLLO;
afterAll(() => {
  if (MODULOS_ORIGINAL === undefined) delete process.env.MODULOS_EN_DESARROLLO;
  else process.env.MODULOS_EN_DESARROLLO = MODULOS_ORIGINAL;
});

describe("obtenerPermisos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Estas pruebas cubren la matriz: ningún módulo en desarrollo
    process.env.MODULOS_EN_DESARROLLO = "";
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

describe("módulos en desarrollo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidarPermisos();
    mockQuery.mockResolvedValue(FILAS as never);
    delete process.env.MODULOS_EN_DESARROLLO;
  });

  it("por defecto Productividad e Inteligencia quedan sin acceso para los demás roles", async () => {
    const p = await obtenerPermisos("coordinador");
    expect(p.productividad).toBe("ninguno");
    expect(p.inteligencia).toBe("ninguno");
    expect(p.dashboard).toBe("ver");
  });

  it("admin conserva el acceso total", async () => {
    expect(await obtenerPermisos("admin")).toEqual(PERMISOS_POR_DEFECTO.admin);
  });

  it("con la variable vacía se libera lo configurado en la matriz", async () => {
    process.env.MODULOS_EN_DESARROLLO = "";
    expect((await obtenerPermisos("coordinador")).productividad).toBe("ver");
  });

  it("obtenerEnDesarrollo: las secciones en desarrollo que la matriz deja ver al rol", async () => {
    expect(await obtenerEnDesarrollo("coordinador")).toEqual(["productividad"]);
    expect(await obtenerEnDesarrollo("direccion_medica")).toEqual([]);
  });

  it("obtenerEnDesarrollo: admin las ve todas sin consultar la base", async () => {
    expect(await obtenerEnDesarrollo("admin")).toEqual(["productividad", "inteligencia"]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("obtenerEnDesarrollo: sin módulos en desarrollo no hay ninguna", async () => {
    process.env.MODULOS_EN_DESARROLLO = "";
    expect(await obtenerEnDesarrollo("coordinador")).toEqual([]);
  });
});
