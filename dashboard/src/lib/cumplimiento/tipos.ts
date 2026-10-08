import type { Atribucion } from "./config";
import type { ResultadoCumplimiento } from "./calcular";

/** Respuesta de POST /api/cumplimiento. */
export interface RespuestaCumplimiento extends ResultadoCumplimiento {
  atribucion: Atribucion;
  /** Todos los periodos que tienen citas atendidas cargadas. */
  periodos_disponibles: number[];
  /** Rango efectivamente consultado (null si no hay citas cargadas). */
  periodo_desde: number | null;
  periodo_hasta: number | null;
  /** Periodos con citas dentro del rango consultado. */
  periodos: number[];
}
