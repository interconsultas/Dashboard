jest.mock("@/lib/middleware-roles", () => ({ requireAuth: jest.fn() }));
jest.mock("@/lib/etl-run-sync", () => ({ runEtlMedicosSync: jest.fn() }));
jest.mock("fs/promises", () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("fs", () => ({ existsSync: jest.fn().mockReturnValue(true) }));

import { NextResponse } from "next/server";
import { POST } from "@/app/api/admin/medicos/importar/route";
import { requireAuth } from "@/lib/middleware-roles";
import { runEtlMedicosSync } from "@/lib/etl-run-sync";
import { writeFile, unlink } from "fs/promises";

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockRunEtl = runEtlMedicosSync as jest.MockedFunction<typeof runEtlMedicosSync>;
const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockUnlink = unlink as jest.MockedFunction<typeof unlink>;

const ADMIN_USER = { id: "1", email: "admin@ips.local", rol: "admin" as const, regional: null };

function reqConFormData(fd: FormData) {
  return { formData: () => Promise.resolve(fd) } as never;
}

function archivoValido(nombre = "BD profesionales TXT.xlsx", sizeBytes = 100) {
  return new File([new Uint8Array(sizeBytes)], nombre, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("POST /api/admin/medicos/importar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ error: null, user: ADMIN_USER });
  });

  it("retorna el error de requireAuth si no está autorizado", async () => {
    const authError = NextResponse.json({ error: "No autorizado" }, { status: 403 });
    mockRequireAuth.mockResolvedValue({ error: authError, user: null });

    const res = await POST(reqConFormData(new FormData()));

    expect(res).toBe(authError);
    expect(mockRunEtl).not.toHaveBeenCalled();
  });

  it("rechaza si no se envía archivo", async () => {
    const res = await POST(reqConFormData(new FormData()));
    expect(res.status).toBe(400);
  });

  it("rechaza archivos que no son .xlsx", async () => {
    const fd = new FormData();
    fd.set("archivo", archivoValido("medicos.csv"));

    const res = await POST(reqConFormData(fd));
    expect(res.status).toBe(400);
    expect(mockRunEtl).not.toHaveBeenCalled();
  });

  it("rechaza archivos que superan el límite de tamaño", async () => {
    const fd = new FormData();
    fd.set("archivo", archivoValido("medicos.xlsx", 21 * 1024 * 1024));

    const res = await POST(reqConFormData(fd));
    expect(res.status).toBe(400);
    expect(mockRunEtl).not.toHaveBeenCalled();
  });

  it("guarda el archivo, corre el ETL sincrono y devuelve el resultado en 200", async () => {
    const fd = new FormData();
    fd.set("archivo", archivoValido());
    mockRunEtl.mockResolvedValue({
      success: true,
      resultado: { archivo: "a.xlsx", filas_procesadas: 5, registros_en_bd: 5, errores: 0 },
    });

    const res = await POST(reqConFormData(fd));
    const body = await res.json();

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockRunEtl).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(body).toEqual({ archivo: "a.xlsx", filas_procesadas: 5, registros_en_bd: 5, errores: 0 });
  });

  it("borra el archivo temporal después de una importación exitosa", async () => {
    const fd = new FormData();
    fd.set("archivo", archivoValido());
    mockRunEtl.mockResolvedValue({ success: true, resultado: {} });

    await POST(reqConFormData(fd));

    expect(mockUnlink).toHaveBeenCalledTimes(1);
  });

  it("devuelve 500 con el error del ETL si la carga falla, y aun así limpia el archivo temporal", async () => {
    const fd = new FormData();
    fd.set("archivo", archivoValido());
    mockRunEtl.mockResolvedValue({ success: false, error: "Columnas faltantes: [...]" });

    const res = await POST(reqConFormData(fd));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Columnas faltantes: [...]");
    expect(mockUnlink).toHaveBeenCalledTimes(1);
  });
});
