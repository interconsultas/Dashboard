export type EstadoCarga =
  | "procesando"
  | "previsualizando"
  | "esperando_confirmacion"
  | "cargando"
  | "exitoso"
  | "exitoso_con_advertencias"
  | "cancelado"
  | "error_fatal"
  | "ya_procesado";

export interface LogCarga {
  id: number;
  job_id: string;
  nombre_archivo: string;
  hash_archivo: string | null;
  periodo_detectado: number | null;
  filas_en_archivo: number;
  filas_validas: number;
  filas_insertadas: number;
  filas_duplicadas: number;
  filas_con_error: number;
  fechas_invalidas: number;
  valores_invalidos: number;
  medicos_no_encontrados: MedicosNoEncontrados;
  columnas_faltantes: string[];
  distribucion_estados: Record<string, number> | null;
  suma_valor_autorizado: number | null;
  estado: EstadoCarga;
  error_mensaje: string | null;
  cargado_por: string | null;
  tiempo_segundos: number | null;
  cargado_en: string;
}

export interface MedicosNoEncontrados {
  total: number;
  nombres: string[];
  cedulas?: string[]; // legacy: compatibilidad con cargas anteriores
}

export interface UploadResponse {
  job_id: string;
  mensaje: string;
}
