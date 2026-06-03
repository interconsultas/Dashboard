-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 003_create_views.sql
-- Vista única pre-agregada para filtros del dashboard
-- Refresco: REFRESH MATERIALIZED VIEW CONCURRENTLY vm_filtros_dashboard;
-- ============================================================

-- Eliminar vistas anteriores
DROP MATERIALIZED VIEW IF EXISTS vm_autorizaciones_por_medico CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vm_cumplimiento_mensual CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vm_distribucion_prestacion CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vm_tendencia_mensual CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vm_tasas_por_medico CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vm_top_prestaciones CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vm_concentracion_ips CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vm_distribucion_programas CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vm_resumen_dimensiones CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vm_resumen_prestaciones CASCADE;

-- ─────────────────────────────────────────────
-- Vista única: todas las dimensiones de filtro
-- Incluye diagnostico y prestacion
-- ─────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS vm_filtros_dashboard AS
SELECT
    periodo,
    estado_medico,
    nombre_medico,
    programa_especialidad,
    tipo_convenio_desc,
    orden_agrup_prest_desc,
    agrup_salud_prest_desc,
    diagnostico_desc,
    descripcion_prestacion,
    estado_autorizacion_desc,
    desc_regional_afiliado,
    usuario_txt,
    COUNT(*)                           AS total_autorizaciones,
    SUM(valor_autorizado_prestacion)   AS valor_total,
    SUM(cantidad_autorizada)           AS total_cantidad
FROM autorizaciones
GROUP BY
    periodo,
    estado_medico,
    nombre_medico,
    programa_especialidad,
    tipo_convenio_desc,
    orden_agrup_prest_desc,
    agrup_salud_prest_desc,
    diagnostico_desc,
    descripcion_prestacion,
    estado_autorizacion_desc,
    desc_regional_afiliado,
    usuario_txt
WITH NO DATA;

-- Índice único requerido por REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_vm_filtros_uq
    ON vm_filtros_dashboard (
        periodo, usuario_txt,
        tipo_convenio_desc, orden_agrup_prest_desc,
        agrup_salud_prest_desc, programa_especialidad,
        desc_regional_afiliado, estado_autorizacion_desc,
        estado_medico, nombre_medico,
        diagnostico_desc, descripcion_prestacion
    ) NULLS NOT DISTINCT;

-- Índices para consultas de filtro rápidas
CREATE INDEX IF NOT EXISTS idx_vm_filtros_periodo
    ON vm_filtros_dashboard (periodo);
CREATE INDEX IF NOT EXISTS idx_vm_filtros_estado_medico
    ON vm_filtros_dashboard (estado_medico);
CREATE INDEX IF NOT EXISTS idx_vm_filtros_nombre_medico
    ON vm_filtros_dashboard (nombre_medico);
CREATE INDEX IF NOT EXISTS idx_vm_filtros_programa
    ON vm_filtros_dashboard (programa_especialidad);
CREATE INDEX IF NOT EXISTS idx_vm_filtros_tipo_convenio
    ON vm_filtros_dashboard (tipo_convenio_desc);
CREATE INDEX IF NOT EXISTS idx_vm_filtros_diagnostico
    ON vm_filtros_dashboard (diagnostico_desc);
CREATE INDEX IF NOT EXISTS idx_vm_filtros_prestacion
    ON vm_filtros_dashboard (descripcion_prestacion);
CREATE INDEX IF NOT EXISTS idx_vm_filtros_regional
    ON vm_filtros_dashboard (desc_regional_afiliado);

-- Índices compuestos para queries con filtro de periodo combinado
CREATE INDEX IF NOT EXISTS idx_vm_filtros_periodo_estado
    ON vm_filtros_dashboard (periodo, estado_medico);
CREATE INDEX IF NOT EXISTS idx_vm_filtros_periodo_diag
    ON vm_filtros_dashboard (periodo, diagnostico_desc);
CREATE INDEX IF NOT EXISTS idx_vm_filtros_periodo_nombre
    ON vm_filtros_dashboard (periodo, nombre_medico);
CREATE INDEX IF NOT EXISTS idx_vm_filtros_regional_periodo
    ON vm_filtros_dashboard (desc_regional_afiliado, periodo);
