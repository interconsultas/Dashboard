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

/**
 * Programas de metas que se pueden asignar a un profesional (por el mapeo de
 * especialidades o por periodo en citas atendidas), en el orden de la hoja
 * METAS del Excel del cliente.
 */
export const PROGRAMAS_META = [
  "PROGRAMADA",
  "NO PROGRAMADA",
  "RCV",
  "CyD-RIAS-PF-SALUD PÚBLICA",
  "CPR",
  "DERMATOLOGÍA",
  "MEDICINA INTERNA",
  "GINECOLOGÍA Y OBSTETRICIA",
  "PEDIATRÍA",
] as const;

export type ProgramaMeta = (typeof PROGRAMAS_META)[number];

/**
 * Fila informativa del total de médicos generales integradores: se edita en
 * Metas, pero no se asigna a profesionales ni entra en ningún cálculo.
 */
export const PROGRAMA_TOTAL_MGI = "TOTAL MGI";

/** Filas de la matriz de metas, en el orden de la hoja METAS. */
export const PROGRAMAS_EDITABLES: readonly string[] = [PROGRAMA_TOTAL_MGI, ...PROGRAMAS_META];

const ETIQUETAS_PROGRAMA: Record<string, string> = {
  [PROGRAMA_TOTAL_MGI]: "TOTAL MÉDICOS GENERALES INTEGRADORES",
  PROGRAMADA: "PROGRAMADA",
  "NO PROGRAMADA": "NO PROGRAMADA",
  RCV: "RCV",
  "CyD-RIAS-PF-SALUD PÚBLICA": "CyD-RIAS-PF-SALUD PÚBLICA",
  CPR: "CPR",
  "DERMATOLOGÍA": "DERMATOLOGÍA",
  "MEDICINA INTERNA": "MEDICINA INTERNA",
  "GINECOLOGÍA Y OBSTETRICIA": "GINECOLOGÍA Y OBSTETRICIA",
  "PEDIATRÍA": "PEDIATRÍA",
};

/** Etiqueta del Excel para un programa; la clave misma si no está en el catálogo. */
export function etiquetaPrograma(clave: string): string {
  return ETIQUETAS_PROGRAMA[clave] ?? clave;
}

export function esCategoria(valor: unknown): valor is string {
  return typeof valor === "string" && CATEGORIAS.some((c) => c.clave === valor);
}

export function esProgramaMeta(valor: unknown): valor is ProgramaMeta {
  return typeof valor === "string" && (PROGRAMAS_META as readonly string[]).includes(valor);
}

/** Programa que admite metas: los asignables más la fila TOTAL MGI. */
export function esProgramaEditable(valor: unknown): valor is string {
  return typeof valor === "string" && PROGRAMAS_EDITABLES.includes(valor);
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
