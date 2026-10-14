import { parseDecimal } from "./decimal";

/**
 * Una celda de la matriz de metas es válida si contiene un número mayor que
 * cero, o si está vacía y no tenía meta guardada (programa sin meta: el
 * porcentaje queda en null). Una meta guardada no se puede vaciar.
 */
export function celdaValida(texto: string | undefined, original: string | undefined): boolean {
  const n = parseDecimal(texto ?? "");
  if (n === null) return parseDecimal(original ?? "") === null;
  return !Number.isNaN(n) && n > 0;
}
