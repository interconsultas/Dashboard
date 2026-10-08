/** Valida un periodo YYYYMM (6 dígitos, mes 01–12). Retorna null si no es válido. */
export function parsePeriodo(valor: unknown): number | null {
  const texto = typeof valor === "number" ? String(valor) : valor;
  if (typeof texto !== "string" || !/^\d{6}$/.test(texto)) return null;
  const mes = Number(texto.slice(4));
  if (mes < 1 || mes > 12) return null;
  return Number(texto);
}

/** Periodo YYYYMM del mes calendario anterior a la fecha dada. */
export function periodoAnterior(fecha: Date): number {
  const anterior = new Date(fecha.getFullYear(), fecha.getMonth() - 1, 1);
  return anterior.getFullYear() * 100 + anterior.getMonth() + 1;
}

/** Valida un año entero entre 2000 y 2100. Retorna null si no es válido. */
export function parseAnio(valor: unknown): number | null {
  const texto = typeof valor === "number" ? String(valor) : valor;
  if (typeof texto !== "string" || !/^\d{4}$/.test(texto)) return null;
  const anio = Number(texto);
  return anio >= 2000 && anio <= 2100 ? anio : null;
}

/** Número de meses entre dos periodos YYYYMM, ambos extremos incluidos. */
export function mesesEntre(desde: number, hasta: number): number {
  return (Math.floor(hasta / 100) - Math.floor(desde / 100)) * 12 + ((hasta % 100) - (desde % 100)) + 1;
}

/** Periodo YYYYMM que queda `meses` meses antes del periodo dado. */
export function restarMeses(periodo: number, meses: number): number {
  const total = Math.floor(periodo / 100) * 12 + ((periodo % 100) - 1) - meses;
  return Math.floor(total / 12) * 100 + (total % 12) + 1;
}
