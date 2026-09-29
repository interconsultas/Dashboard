-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 008_delete_carga.sql
-- Soporta eliminar y volver a cargar un archivo fuente (issue #3)
-- ============================================================

ALTER TABLE log_cargas DROP CONSTRAINT IF EXISTS log_cargas_estado_check;
ALTER TABLE log_cargas ADD CONSTRAINT log_cargas_estado_check
    CHECK (estado IN (
        'procesando', 'previsualizando', 'esperando_confirmacion', 'cargando',
        'exitoso', 'exitoso_con_advertencias', 'cancelado', 'error_fatal',
        'ya_procesado', 'eliminando', 'eliminado'
    ));

-- Soporta el DELETE FROM autorizaciones WHERE periodo = ... AND archivo_fuente = ...
CREATE INDEX IF NOT EXISTS idx_autorizaciones_periodo_archivo
    ON autorizaciones (periodo, archivo_fuente);
