-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 002_create_indexes.sql
-- Los índices se crean sobre la tabla padre y PostgreSQL los propaga a las particiones
-- ============================================================

-- Índice 1: filtro más frecuente del dashboard (médico + período)
CREATE INDEX IF NOT EXISTS idx_medico_periodo
    ON autorizaciones (usuario_txt, periodo);

-- Índice 2: distribución por tipo de prestación
CREATE INDEX IF NOT EXISTS idx_periodo_tipo
    ON autorizaciones (periodo, tipo_prestacion_desc);

-- Índice 3: análisis por IPS prestadora
CREATE INDEX IF NOT EXISTS idx_ips_atiende_periodo
    ON autorizaciones (descripcion_prestador_atiende, periodo);

-- Índice 4: análisis por diagnóstico
CREATE INDEX IF NOT EXISTS idx_diagnostico_periodo
    ON autorizaciones (codigo_diagnostico, periodo);

-- Índice 5: vista ejecutiva regional
CREATE INDEX IF NOT EXISTS idx_regional_periodo_tipo
    ON autorizaciones (desc_regional_afiliado, periodo, tipo_prestacion_desc);

-- Índice 6: seguimiento por estado de autorización
CREATE INDEX IF NOT EXISTS idx_estado_periodo
    ON autorizaciones (estado_autorizacion_desc, periodo);

-- Índice 7: análisis por programa/especialidad del médico
CREATE INDEX IF NOT EXISTS idx_programa_periodo
    ON autorizaciones (programa_especialidad, periodo);

-- Índice 8: filtros de tipo_prestacion negocio (tipo_convenio + agrup)
CREATE INDEX IF NOT EXISTS idx_tipo_convenio_agrup
    ON autorizaciones (tipo_convenio_desc, agrup_salud_prest_desc, orden_agrup_prest_desc);

-- Índice 9: filtro por orden_agrup (usado en varios tipos de prestación)
CREATE INDEX IF NOT EXISTS idx_orden_agrup_periodo
    ON autorizaciones (orden_agrup_prest_desc, periodo);

-- Índice 10: filtro por agrup_salud (medicamentos, procedimientos dx)
CREATE INDEX IF NOT EXISTS idx_agrup_salud_periodo
    ON autorizaciones (agrup_salud_prest_desc, periodo);

-- Índices en citas_atendidas
CREATE INDEX IF NOT EXISTS idx_citas_documento_periodo
    ON citas_atendidas (documento, periodo);

CREATE INDEX IF NOT EXISTS idx_citas_periodo
    ON citas_atendidas (periodo);

-- Índices en log_cargas
CREATE INDEX IF NOT EXISTS idx_log_cargas_job_id
    ON log_cargas (job_id);

CREATE INDEX IF NOT EXISTS idx_log_cargas_estado
    ON log_cargas (estado, cargado_en DESC);
