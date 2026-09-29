import { spawn } from "child_process";
import { existsSync, openSync, closeSync, mkdirSync } from "fs";
import path from "path";
import { clearCache } from "@/lib/cache";

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

  // Invalida el cache del dashboard al terminar, sin depender de que alguien
  // este mirando el historial de cargas (esa via solo invalidaba si el
  // usuario se quedaba en esa pantalla el tiempo suficiente para que el
  // polling detectara la transicion a estado terminal).
  proc.on("exit", (code) => {
    if (code === 0) clearCache();
  });

  proc.unref();

  // El hijo dupló el fd: el padre puede liberar su referencia.
  closeSync(fd);
}
