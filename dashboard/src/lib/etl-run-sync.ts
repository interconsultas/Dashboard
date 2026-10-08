import { spawn } from "child_process";
import path from "path";

/**
 * Ejecuta un script Python del ETL de forma sincrona (esperando a que termine)
 * y parsea el resultado final de su stdout. A diferencia de `spawnEtl`
 * (fire-and-forget, para archivos grandes que corren en background), esto es
 * para scripts chicos y rapidos donde el caller necesita el resultado en la
 * misma respuesta HTTP.
 */

const RESULT_PREFIX = "RESULT_JSON:";

export interface EtlSyncResult {
  success: boolean;
  resultado?: Record<string, unknown>;
  error?: string;
}

export function runEtlMedicosSync(archivoPath: string): Promise<EtlSyncResult> {
  const scriptPath =
    process.env.ETL_MEDICOS_SCRIPT_PATH ??
    path.join(process.cwd(), "..", "etl", "etl_medicos.py");

  return runEtlSync(scriptPath, archivoPath);
}

/**
 * Carga de citas atendidas (etl_citas.py). Sin ETL_CITAS_SCRIPT_PATH, el
 * script se busca junto al de ETL_SCRIPT_PATH, que es la carpeta del ETL
 * tanto en desarrollo como en la imagen Docker.
 */
export function runEtlCitasSync(archivoPath: string): Promise<EtlSyncResult> {
  const etlDir = process.env.ETL_SCRIPT_PATH
    ? path.dirname(process.env.ETL_SCRIPT_PATH)
    : path.join(process.cwd(), "..", "etl");
  const scriptPath = process.env.ETL_CITAS_SCRIPT_PATH ?? path.join(etlDir, "etl_citas.py");

  return runEtlSync(scriptPath, archivoPath);
}

function runEtlSync(scriptPath: string, archivoPath: string): Promise<EtlSyncResult> {
  const pythonPath = process.env.PYTHON_PATH ?? "python";

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn(pythonPath, [scriptPath, "--archivo", archivoPath]);

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err: Error) => {
      resolve({ success: false, error: err.message });
    });

    proc.on("close", (code: number | null) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: stderr.trim() || stdout.trim() || `El proceso termino con codigo ${code}`,
        });
        return;
      }

      const linea = stdout
        .split("\n")
        .reverse()
        .find((l) => l.startsWith(RESULT_PREFIX));

      if (!linea) {
        resolve({ success: false, error: "No se encontro el resultado en la salida del proceso" });
        return;
      }

      try {
        const resultado = JSON.parse(linea.slice(RESULT_PREFIX.length));
        resolve({ success: true, resultado });
      } catch {
        resolve({ success: false, error: "El resultado del proceso no es JSON valido" });
      }
    });
  });
}
