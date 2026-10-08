/**
 * Lee un decimal escrito con punto o con coma.
 * Retorna null si el texto está vacío y NaN si no es un decimal simple
 * (no admite signo, separadores de miles ni notación científica).
 */
export function parseDecimal(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === "") return null;
  if (!/^\d+([.,]\d+)?$/.test(limpio)) return NaN;
  return Number(limpio.replace(",", "."));
}

/** Muestra un número con coma decimal, como lo espera parseDecimal. */
export function fmtDecimal(valor: number): string {
  return String(valor).replace(".", ",");
}
