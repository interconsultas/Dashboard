import { EventEmitter } from "events";

jest.mock("child_process", () => ({ spawn: jest.fn() }));

import { spawn } from "child_process";
import path from "path";
import { runEtlCitasSync, runEtlMedicosSync } from "@/lib/etl-run-sync";

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

  it("usa ETL_MEDICOS_SCRIPT_PATH si está definida y, si no, ../etl/etl_medicos.py", async () => {
    const original = process.env.ETL_MEDICOS_SCRIPT_PATH;
    try {
      delete process.env.ETL_MEDICOS_SCRIPT_PATH;
      (spawn as jest.Mock).mockReturnValue(mockProc());
      void runEtlMedicosSync("/tmp/a.xlsx");
      expect((spawn as jest.Mock).mock.calls[0][1][0]).toBe(
        path.join(process.cwd(), "..", "etl", "etl_medicos.py")
      );

      process.env.ETL_MEDICOS_SCRIPT_PATH = "/opt/etl/etl_medicos.py";
      void runEtlMedicosSync("/tmp/a.xlsx");
      expect((spawn as jest.Mock).mock.calls[1][1][0]).toBe("/opt/etl/etl_medicos.py");
    } finally {
      if (original === undefined) delete process.env.ETL_MEDICOS_SCRIPT_PATH;
      else process.env.ETL_MEDICOS_SCRIPT_PATH = original;
    }
  });
});

describe("runEtlCitasSync", () => {
  const VARIABLES = ["ETL_CITAS_SCRIPT_PATH", "ETL_SCRIPT_PATH", "PYTHON_PATH"] as const;
  const originales: Record<string, string | undefined> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    for (const v of VARIABLES) {
      originales[v] = process.env[v];
      delete process.env[v];
    }
  });

  afterEach(() => {
    for (const v of VARIABLES) {
      if (originales[v] === undefined) delete process.env[v];
      else process.env[v] = originales[v];
    }
  });

  function scriptUsado(): string {
    return (spawn as jest.Mock).mock.calls[0][1][0];
  }

  it("resuelve success:true con el resultado parseado cuando el proceso termina en 0", async () => {
    const proc = mockProc();
    (spawn as jest.Mock).mockReturnValue(proc);

    const promise = runEtlCitasSync("/tmp/citas.xlsx");
    proc.stdout.emit("data", Buffer.from("[INFO] Leyendo...\n"));
    proc.stdout.emit(
      "data",
      Buffer.from('RESULT_JSON:{"registros":3,"periodos":[202601],"profesionales":2}\n')
    );
    proc.emit("close", 0);

    expect(await promise).toEqual({
      success: true,
      resultado: { registros: 3, periodos: [202601], profesionales: 2 },
    });
  });

  it("resuelve success:false con el mensaje de stderr cuando el proceso falla", async () => {
    const proc = mockProc();
    (spawn as jest.Mock).mockReturnValue(proc);

    const promise = runEtlCitasSync("/tmp/citas.xlsx");
    proc.stdout.emit("data", Buffer.from("[INFO] Leyendo...\n"));
    proc.stderr.emit("data", Buffer.from("No se encontró la columna de cédula\n"));
    proc.emit("close", 1);

    expect(await promise).toEqual({
      success: false,
      error: "No se encontró la columna de cédula",
    });
  });

  it("ejecuta el intérprete de PYTHON_PATH con --archivo y la ruta recibida", () => {
    process.env.PYTHON_PATH = "python3";
    (spawn as jest.Mock).mockReturnValue(mockProc());

    void runEtlCitasSync("/tmp/citas.xlsx");

    const [comando, args] = (spawn as jest.Mock).mock.calls[0];
    expect(comando).toBe("python3");
    expect(args.slice(1)).toEqual(["--archivo", "/tmp/citas.xlsx"]);
  });

  it("usa ETL_CITAS_SCRIPT_PATH si está definida", () => {
    process.env.ETL_CITAS_SCRIPT_PATH = "/opt/etl/etl_citas.py";
    process.env.ETL_SCRIPT_PATH = "/app/etl/etl_autorizaciones.py";
    (spawn as jest.Mock).mockReturnValue(mockProc());

    void runEtlCitasSync("/tmp/citas.xlsx");

    expect(scriptUsado()).toBe("/opt/etl/etl_citas.py");
  });

  it("sin esa variable busca etl_citas.py junto al script de ETL_SCRIPT_PATH", () => {
    process.env.ETL_SCRIPT_PATH = "/app/etl/etl_autorizaciones.py";
    (spawn as jest.Mock).mockReturnValue(mockProc());

    void runEtlCitasSync("/tmp/citas.xlsx");

    expect(scriptUsado()).toBe(path.join("/app/etl", "etl_citas.py"));
  });

  it("sin ninguna de las dos usa ../etl/etl_citas.py respecto al directorio de trabajo", () => {
    (spawn as jest.Mock).mockReturnValue(mockProc());

    void runEtlCitasSync("/tmp/citas.xlsx");

    expect(scriptUsado()).toBe(path.join(process.cwd(), "..", "etl", "etl_citas.py"));
  });
});
