/** Textos del encabezado que solo aparece al exportar el cumplimiento a PDF. */
import { fmtPeriodo } from "@/lib/periodo";
import { PROGRAMAS_META } from "./categorias";

/** Rango consultado ("Dic 2025 – Feb 2026"); null si aún no hay rango resuelto. */
export function rangoPeriodos(desde: number | null, hasta: number | null): string | null {
  if (desde === null || hasta === null) return null;
  if (desde === hasta) return fmtPeriodo(desde);
  return `${fmtPeriodo(desde)} – ${fmtPeriodo(hasta)}`;
}

/**
 * Programas del filtro aplicado, o null cuando no restringe la consulta
 * (ninguno o todos equivale a no filtrar, igual que en `cuerpoConsulta`).
 */
export function programasFiltrados(programas: string[] | null): string | null {
  if (programas === null) return null;
  if (programas.length === 0 || programas.length >= PROGRAMAS_META.length) return null;
  return programas.join(", ");
}

export function fmtFechaGeneracion(fecha: Date): string {
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}
