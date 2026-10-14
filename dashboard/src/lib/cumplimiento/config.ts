/**
 * Criterio de atribución de las órdenes en el módulo de cumplimiento.
 * La variable de entorno CUMPLIMIENTO_ATRIBUCION es el único interruptor:
 * cambiarla (y reiniciar el dashboard) basta para cambiar el criterio.
 */

/**
 * 'nombre': nombre del profesional (nombre_medico, resuelto por el ETL);
 * 'ordenador': médico que ordena (numero_remite); 'digitador': usuario que digita (usuario_txt).
 */
export type Atribucion = "ordenador" | "digitador" | "nombre";

const ATRIBUCION_POR_DEFECTO: Atribucion = "nombre";

const ATRIBUCIONES: readonly Atribucion[] = ["ordenador", "digitador", "nombre"];

/** Columna de vm_cumpl_ordenes por la que se agrupan las órdenes en cada modo. */
export const COLUMNA_ORDENES: Record<Atribucion, "numero_remite" | "usuario_txt" | "nombre_medico"> = {
  ordenador: "numero_remite",
  digitador: "usuario_txt",
  nombre: "nombre_medico",
};

/** Lee el criterio en cada llamada; un valor ausente o no reconocido equivale a 'nombre'. */
export function getAtribucion(): Atribucion {
  const valor = (process.env.CUMPLIMIENTO_ATRIBUCION ?? "").trim().toLowerCase();
  return ATRIBUCIONES.find((a) => a === valor) ?? ATRIBUCION_POR_DEFECTO;
}

function alias(valor: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(valor)) {
    throw new Error(`Alias SQL no válido: ${valor}`);
  }
  return valor;
}

/**
 * Condición de JOIN entre las órdenes agrupadas y el médico, armada solo con
 * textos fijos: por nombre normalizado contra el del catálogo de médicos o,
 * en su defecto, el de las citas (nombre); por cédula contra las citas
 * (ordenador) o por usuario contra el catálogo de médicos (digitador).
 */
export function joinOrdenes(
  atribucion: Atribucion,
  aliasOrdenes: string,
  aliasCitas: string,
  aliasMedicos: string
): string {
  const o = alias(aliasOrdenes);
  const c = alias(aliasCitas);
  const m = alias(aliasMedicos);
  switch (atribucion) {
    case "nombre":
      return `UPPER(TRIM(${o}.nombre_medico)) = UPPER(TRIM(COALESCE(${m}.nombre, ${c}.nombre_medico)))`;
    case "digitador":
      return `${o}.usuario_txt = ${m}.usuario_txt`;
    case "ordenador":
      return `${o}.numero_remite = ${c}.documento`;
  }
}
