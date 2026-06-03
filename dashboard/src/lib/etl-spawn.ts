import { spawn } from "child_process";
import { existsSync, openSync, closeSync, mkdirSync } from "fs";
import path from "path";

/**
 * Lanza el ETL de Python como proceso desacoplado y redirige stdout+stderr
 * a `<ETL_LOGS_DIR>/<jobId>.log`. Si Python crashea antes de actualizar
 * `log_cargas.estado`, el log queda disponible en disco para postmortem.
 */
export function spawnEtl(args: string[], jobId: string): void {
  const logsDir =
    process.env.ETL_LOGS_DIR ??
    path.join(process.cwd(), "..", "logs");

  // Validación extra por seguridad
  if (!/^[0-9a-f-]+$/i.test(jobId)) {
    throw new Error("Invalid jobId format");
  }

  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  const logPath = path.join(logsDir, `${jobId}.log`);
  const fd = openSync(logPath, "a");

  const pythonPath = process.env.PYTHON_PATH ?? "python";
  const scriptPath =
    process.env.ETL_SCRIPT_PATH ??
    path.join(process.cwd(), "..", "etl", "etl_autorizaciones.py");

  const proc = spawn(
    pythonPath,
    [scriptPath, ...args],
    { detached: true, stdio: ["ignore", fd, fd] }
  );
  proc.unref();

  // El hijo dupló el fd: el padre puede liberar su referencia.
  closeSync(fd);
}
