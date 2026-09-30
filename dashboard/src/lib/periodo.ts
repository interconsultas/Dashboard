const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function fmtPeriodo(p: number | null): string {
  if (!p) return "—";
  const anio = Math.floor(p / 100);
  const mes = (p % 100) - 1;
  return `${MESES[mes]} ${anio}`;
}

/**
 * Un archivo puede abarcar mas de un periodo (ej. un corte semanal que
 * cruza fin de mes) — log_cargas.periodo_detectado solo guarda el primero.
 * Usa la lista completa cuando esta disponible; cae al valor unico
 * (periodo_detectado) para filas cargadas antes de que existiera esa lista.
 */
export function fmtPeriodos(periodos: number[] | null | undefined, fallback: number | null): string {
  if (periodos && periodos.length > 0) {
    if (periodos.length === 1) return fmtPeriodo(periodos[0]);
    return periodos.map(fmtPeriodo).join(" / ");
  }
  return fmtPeriodo(fallback);
}
