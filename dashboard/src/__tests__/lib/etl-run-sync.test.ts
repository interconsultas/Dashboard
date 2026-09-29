import { EventEmitter } from "events";

jest.mock("child_process", () => ({ spawn: jest.fn() }));

import { spawn } from "child_process";
import { runEtlMedicosSync } from "@/lib/etl-run-sync";

function mockProc() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

describe("runEtlMedicosSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resuelve success:true con el resultado parseado cuando el proceso termina en 0", async () => {
    const proc = mockProc();
    (spawn as jest.Mock).mockReturnValue(proc);

    const promise = runEtlMedicosSync("/tmp/archivo.xlsx");
    proc.stdout.emit("data", Buffer.from("[INFO] Leyendo...\n"));
    proc.stdout.emit(
      "data",
      Buffer.from(
        'RESULT_JSON:{"archivo":"a.xlsx","filas_procesadas":2,"registros_en_bd":2,"errores":0}\n'
      )
    );
    proc.emit("close", 0);

    const result = await promise;
    expect(result).toEqual({
      success: true,
      resultado: { archivo: "a.xlsx", filas_procesadas: 2, registros_en_bd: 2, errores: 0 },
    });
  });

  it("resuelve success:false con el stderr cuando el proceso termina con codigo distinto de 0", async () => {
    const proc = mockProc();
    (spawn as jest.Mock).mockReturnValue(proc);

    const promise = runEtlMedicosSync("/tmp/archivo.xlsx");
    proc.stderr.emit("data", Buffer.from("Traceback...\nError X"));
    proc.emit("close", 1);

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toContain("Error X");
  });

  it("resuelve success:false si no encuentra la linea RESULT_JSON", async () => {
    const proc = mockProc();
    (spawn as jest.Mock).mockReturnValue(proc);

    const promise = runEtlMedicosSync("/tmp/archivo.xlsx");
    proc.stdout.emit("data", Buffer.from("solo texto sin resultado\n"));
    proc.emit("close", 0);

    const result = await promise;
    expect(result.success).toBe(false);
  });

  it("resuelve success:false si el proceso no puede lanzarse (evento error)", async () => {
    const proc = mockProc();
    (spawn as jest.Mock).mockReturnValue(proc);

    const promise = runEtlMedicosSync("/tmp/archivo.xlsx");
    proc.emit("error", new Error("spawn ENOENT"));

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toContain("ENOENT");
  });

  it("pasa --archivo con la ruta correcta al script", async () => {
    const proc = mockProc();
    (spawn as jest.Mock).mockReturnValue(proc);

    const promise = runEtlMedicosSync("/tmp/mi-archivo.xlsx");
    proc.stdout.emit(
      "data",
      Buffer.from('RESULT_JSON:{"archivo":"x","filas_procesadas":0,"registros_en_bd":0,"errores":0}\n')
    );
    proc.emit("close", 0);
    await promise;

    const [, args] = (spawn as jest.Mock).mock.calls[0];
    expect(args).toContain("--archivo");
    expect(args).toContain("/tmp/mi-archivo.xlsx");
  });
});
