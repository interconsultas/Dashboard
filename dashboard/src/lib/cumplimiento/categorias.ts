/**
 * Constantes del módulo de cumplimiento de profesionales.
 * `clave` coincide con metas.tipo_prestacion y con vm_cumpl_ordenes.categoria
 * (ver etl/sql/013_cumplimiento.sql).
 */

/** 'ratio': órdenes por cita; 'x100': órdenes por cada 100 citas. */
export type Escala = "ratio" | "x100";

export interface Categoria {
  clave: string;
  etiqueta: string;
  escala: Escala;
}

export const CATEGORIAS: readonly Categoria[] = [
  { clave: "medicamentos", etiqueta: "Medicamentos", escala: "ratio" },
  { clave: "laboratorios", etiqueta: "Laboratorios", escala: "ratio" },
  { clave: "proc_dx", etiqueta: "Proc. dx no capitados", escala: "x100" },
  { clave: "rx", etiqueta: "Radiografías", escala: "x100" },
  { clave: "ecografias", etiqueta: "Ecografías capitadas", escala: "x100" },
  { clave: "remisiones_cap", etiqueta: "Remisiones capitadas", escala: "x100" },
  { clave: "remisiones_ext", etiqueta: "Remisiones red externa", escala: "x100" },
];

export const PROGRAMAS_META = [
  "PROGRAMADA",
  "NO PROGRAMADA",
  "RCV",
  "CyD-RIAS-PF-SALUD PÚBLICA",
  "CPR",
] as const;

export type ProgramaMeta = (typeof PROGRAMAS_META)[number];

export function esCategoria(valor: unknown): valor is string {
  return typeof valor === "string" && CATEGORIAS.some((c) => c.clave === valor);
}

export function esProgramaMeta(valor: unknown): valor is ProgramaMeta {
  return typeof valor === "string" && (PROGRAMAS_META as readonly string[]).includes(valor);
}

export function escalaDe(clave: string): Escala | null {
  return CATEGORIAS.find((c) => c.clave === clave)?.escala ?? null;
}

/**
 * Normaliza el programa recibido de un formulario: vacío equivale a
 * "sin asignar" (NULL en la BD); cualquier otro valor debe ser un programa.
 */
export function normalizarProgramaMeta(
  valor: unknown
): { valido: true; valor: ProgramaMeta | null } | { valido: false } {
  if (valor === null || valor === undefined || valor === "") {
    return { valido: true, valor: null };
  }
  if (esProgramaMeta(valor)) return { valido: true, valor };
  return { valido: false };
}
