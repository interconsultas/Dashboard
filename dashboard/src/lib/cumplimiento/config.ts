/**
 * Criterio de atribución de las órdenes en el módulo de cumplimiento.
 * La variable de entorno CUMPLIMIENTO_ATRIBUCION es el único interruptor:
 * cambiarla (y reiniciar el dashboard) basta para cambiar el criterio.
 */

/** 'ordenador': médico que ordena (numero_remite); 'digitador': usuario que digita (usuario_txt). */
export type Atribucion = "ordenador" | "digitador";

const ATRIBUCION_POR_DEFECTO: Atribucion = "ordenador";

/** Columna de vm_cumpl_ordenes por la que se agrupan las órdenes en cada modo. */
export const COLUMNA_ORDENES: Record<Atribucion, "numero_remite" | "usuario_txt"> = {
  ordenador: "numero_remite",
  digitador: "usuario_txt",
};

/** Lee el criterio en cada llamada; un valor ausente o no reconocido equivale a 'ordenador'. */
export function getAtribucion(): Atribucion {
  const valor = (process.env.CUMPLIMIENTO_ATRIBUCION ?? "").trim().toLowerCase();
  return valor === "digitador" ? "digitador" : ATRIBUCION_POR_DEFECTO;
}

function alias(valor: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(valor)) {
    throw new Error(`Alias SQL no válido: ${valor}`);
  }
  return valor;
}

/**
 * Condición de JOIN entre las órdenes agrupadas y el médico, armada solo con
 * textos fijos: por cédula contra las citas (ordenador) o por usuario contra
 * el catálogo de médicos (digitador).
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
  return atribucion === "digitador"
    ? `${o}.usuario_txt = ${m}.usuario_txt`
    : `${o}.numero_remite = ${c}.documento`;
}
