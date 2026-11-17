/** Servicio del catálogo de Agenda Web con su área de servicio (017_areas_servicio.sql). */
export interface ServicioArea {
  codigo_servicio: string;
  nombre_servicio: string;
  area: string;
  /** Área que asigna la regla por defecto (clasificar_area_servicio). */
  area_regla: string;
  /** true cuando un administrador eligió el área. */
  area_editada: boolean;
  ultimo_periodo: number;
  /** Citas asignadas en la carga mensual del último mes cargado. */
  asignadas: number;
}

export interface AreasServicio {
  /** Áreas en el orden de presentación. */
  areas: string[];
  /** Último mes con carga mensual, o null si no hay ninguna. */
  periodo: number | null;
  servicios: ServicioArea[];
}

/** Cambio de área de un servicio; area null = restablecer a la regla. */
export interface CambioArea {
  codigo_servicio: string;
  area: string | null;
}
