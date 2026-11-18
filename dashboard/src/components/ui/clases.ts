/** Une clases condicionales: cx("a", cond && "b", undefined) → "a b". */
export function cx(...clases: (string | false | null | undefined)[]): string {
  return clases.filter(Boolean).join(" ");
}

/**
 * Estilo base de campos (select, input). Se exporta como clases para los
 * controles que aún no usan <Select>/<Input> (p. ej. CheckDropdown).
 */
export const CLASES_CAMPO =
  "rounded-control border border-borde bg-superficie px-3 py-2 text-sm text-tinta " +
  "focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

/** Etiqueta pequeña en mayúsculas sobre un campo de filtro. */
export const CLASES_ETIQUETA_CAMPO = "block text-[10.5px] font-bold uppercase tracking-[0.08em] text-tinta-3 mb-1";
