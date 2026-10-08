jest.mock("@/lib/middleware-roles", () => ({ requireAuth: jest.fn() }));
jest.mock("@/lib/etl-run-sync", () => ({ runEtlCitasSync: jest.fn() }));
jest.mock("@/lib/cache", () => ({ clearCache: jest.fn() }));
jest.mock("fs/promises", () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("fs", () => ({ existsSync: jest.fn().mockReturnValue(true) }));

import { NextResponse } from "next/server";
import { POST } from "@/app/api/admin/citas-atendidas/importar/route";
import { requireAuth } from "@/lib/middleware-roles";
import { runEtlCitasSync } from "@/lib/etl-run-sync";
import { clearCache } from "@/lib/cache";
import { writeFile, unlink } from "fs/promises";

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockRunEtl = runEtlCitasSync as jest.MockedFunction<typeof runEtlCitasSync>;
const mockClearCache = clearCache as jest.MockedFunction<typeof clearCache>;
const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockUnlink = unlink as jest.MockedFunction<typeof unlink>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

const RESULTADO = {
  registros: 486,
  periodos: [202601, 202602],
  profesionales: 81,
  sin_catalogo: [],
  sin_programa: 0,
  advertencias: [],
};

function reqConFormData(fd: FormData) {
  return { formData: () => Promise.resolve(fd) } as never;
}

function archivoValido(nombre = "2026 Indicadores MAESTRO V5.xlsx", sizeBytes = 100) {
  return new File([new Uint8Array(sizeBytes)], nombre, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function formConArchivo(archivo = archivoValido()) {
  const fd = new FormData();
  fd.set("archivo", archivo);
  return fd;
}

describe("POST /api/admin/citas-atendidas/importar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
    mockRunEtl.mockResolvedValue({ success: true, resultado: RESULTADO });
  });

  it("permite solo el rol admin", async () => {
    await POST(reqConFormData(formConArchivo()));
    expect(mockRequireAuth).toHaveBeenCalledWith(["admin"]);
  });

  it("retorna el error de requireAuth si no está autorizado", async () => {
    const authError = NextResponse.json({ error: "No autorizado" }, { status: 403 });
    mockRequireAuth.mockResolvedValue({ error: authError, user: null });

    const res = await POST(reqConFormData(formConArchivo()));

    expect(res).toBe(authError);
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockRunEtl).not.toHaveBeenCalled();
  });

  it("rechaza si el formulario no se puede leer", async () => {
    const res = await POST({ formData: () => Promise.reject(new Error("x")) } as never);

    expect(res.status).toBe(400);
    expect(mockRunEtl).not.toHaveBeenCalled();
  });

  it("rechaza si no se envía archivo", async () => {
    const res = await POST(reqConFormData(new FormData()));

    expect(res.status).toBe(400);
    expect(mockRunEtl).not.toHaveBeenCalled();
  });

  it("rechaza archivos que no son .xlsx", async () => {
    const res = await POST(reqConFormData(formConArchivo(archivoValido("citas.csv"))));

    expect(res.status).toBe(400);
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockRunEtl).not.toHaveBeenCalled();
  });

  it("rechaza archivos que superan el límite de tamaño", async () => {
    const res = await POST(
      reqConFormData(formConArchivo(archivoValido("citas.xlsx", 21 * 1024 * 1024)))
    );

    expect(res.status).toBe(400);
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockRunEtl).not.toHaveBeenCalled();
  });

  it("guarda el archivo, corre el ETL sobre esa ruta y devuelve su resultado en 200", async () => {
    const res = await POST(reqConFormData(formConArchivo()));
    const body = await res.json();

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const rutaGuardada = mockWriteFile.mock.calls[0][0];
    expect(mockRunEtl).toHaveBeenCalledTimes(1);
    expect(mockRunEtl).toHaveBeenCalledWith(rutaGuardada);
    expect(res.status).toBe(200);
    expect(body).toEqual(RESULTADO);
  });

  it("sanea el nombre del archivo temporal", async () => {
    await POST(reqConFormData(formConArchivo(archivoValido("../../citas;rm.xlsx"))));

    const ruta = String(mockWriteFile.mock.calls[0][0]);
    const nombre = ruta.split(/[\\/]/).pop() as string;
    expect(nombre).toMatch(/^citas_[0-9a-f-]{36}_/);
    expect(nombre).not.toContain(";");
  });

  it("vacía el caché después de una importación exitosa", async () => {
    await POST(reqConFormData(formConArchivo()));

    expect(mockClearCache).toHaveBeenCalledTimes(1);
  });

  it("borra el archivo temporal después de una importación exitosa", async () => {
    await POST(reqConFormData(formConArchivo()));

    expect(mockUnlink).toHaveBeenCalledTimes(1);
    expect(mockUnlink).toHaveBeenCalledWith(mockWriteFile.mock.calls[0][0]);
  });

  it("devuelve 500 con el error del ETL si la carga falla, limpia el archivo y no vacía el caché", async () => {
    mockRunEtl.mockResolvedValue({
      success: false,
      error: "No se encontró la columna de cédula",
    });

    const res = await POST(reqConFormData(formConArchivo()));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("No se encontró la columna de cédula");
    expect(mockUnlink).toHaveBeenCalledTimes(1);
    expect(mockClearCache).not.toHaveBeenCalled();
  });

  it("limpia el archivo temporal aunque el ETL lance una excepción", async () => {
    mockRunEtl.mockRejectedValue(new Error("fallo inesperado"));

    await expect(POST(reqConFormData(formConArchivo()))).rejects.toThrow("fallo inesperado");

    expect(mockUnlink).toHaveBeenCalledTimes(1);
    expect(mockClearCache).not.toHaveBeenCalled();
  });
});
