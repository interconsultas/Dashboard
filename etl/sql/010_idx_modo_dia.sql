-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 010_idx_modo_dia.sql
-- El modo "dia" del dashboard (issue #4) consulta autorizaciones
-- directamente en vez de la vista materializada vm_filtros_dashboard,
-- que ya tiene indices en las 8 dimensiones de filtro. Estas 4 columnas
-- no tenian indice equivalente en la tabla base.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_estado_medico_periodo
    ON autorizaciones (estado_medico, periodo);

CREATE INDEX IF NOT EXISTS idx_nombre_medico_periodo
    ON autorizaciones (nombre_medico, periodo);

CREATE INDEX IF NOT EXISTS idx_diagnostico_desc_periodo
    ON autorizaciones (diagnostico_desc, periodo);

CREATE INDEX IF NOT EXISTS idx_descripcion_prestacion_periodo
    ON autorizaciones (descripcion_prestacion, periodo);
