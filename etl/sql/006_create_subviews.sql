-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 006_create_subviews.sql
-- Vistas materializadas por tipo de prestación
-- Cada subvista filtra desde autorizaciones con las condiciones
-- fijas del tipo, reduciendo drásticamente el tamaño vs la vista
-- general (vm_filtros_dashboard: 2.3M filas / 2.1 GB).
-- ============================================================

-- ─────────────────────────────────────────────
-- Columnas y GROUP BY compartidos por todas las subvistas
-- ─────────────────────────────────────────────
-- SELECT
--     periodo, estado_medico, nombre_medico, programa_especialidad,
--     tipo_convenio_desc, orden_agrup_prest_desc, agrup_salud_prest_desc,
--     diagnostico_desc, descripcion_prestacion,
--     estado_autorizacion_desc, desc_regional_afiliado, usuario_txt,
--     COUNT(*)                         AS total_autorizaciones,
--     SUM(valor_autorizado_prestacion) AS valor_total,
--     SUM(cantidad_autorizada)         AS total_cantidad
-- FROM autorizaciones
-- WHERE <condiciones del tipo>
-- GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12

-- ─────────────────────────────────────────────
-- Helper: macro de columnas para no repetir
-- (PostgreSQL no tiene macros, se repite el SELECT/GROUP BY)
-- ─────────────────────────────────────────────

-- ═══════════════════════════════════════════════
-- 1. LABORATORIOS
-- ═══════════════════════════════════════════════
DROP MATERIALIZED VIEW IF EXISTS vm_dash_laboratorios CASCADE;
CREATE MATERIALIZED VIEW vm_dash_laboratorios AS
SELECT
    periodo, estado_medico, nombre_medico, programa_especialidad,
    tipo_convenio_desc, orden_agrup_prest_desc, agrup_salud_prest_desc,
    diagnostico_desc, descripcion_prestacion,
    estado_autorizacion_desc, desc_regional_afiliado, usuario_txt,
    COUNT(*)                         AS total_autorizaciones,
    SUM(valor_autorizado_prestacion) AS valor_total,
    SUM(cantidad_autorizada)         AS total_cantidad
FROM autorizaciones
WHERE tipo_convenio_desc = 'CAPITADO'
  AND orden_agrup_prest_desc IN ('LABORATORIO CLINICO', 'ACT Y PROCEDIMIENTOS OTROS POS')
  AND agrup_salud_prest_desc = 'PROCEDIMIENTOS DIAGNOSTICOS'
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12;

CREATE UNIQUE INDEX idx_vm_dash_laboratorios_uq ON vm_dash_laboratorios (
    periodo, usuario_txt, tipo_convenio_desc, orden_agrup_prest_desc,
    agrup_salud_prest_desc, programa_especialidad, desc_regional_afiliado,
    estado_autorizacion_desc, estado_medico, nombre_medico,
    diagnostico_desc, descripcion_prestacion
) NULLS NOT DISTINCT;

CREATE INDEX idx_vm_dash_laboratorios_periodo ON vm_dash_laboratorios (periodo);
CREATE INDEX idx_vm_dash_laboratorios_periodo_estado ON vm_dash_laboratorios (periodo, estado_medico);

-- ═══════════════════════════════════════════════
-- 2. RX
-- ═══════════════════════════════════════════════
DROP MATERIALIZED VIEW IF EXISTS vm_dash_rx CASCADE;
CREATE MATERIALIZED VIEW vm_dash_rx AS
SELECT
    periodo, estado_medico, nombre_medico, programa_especialidad,
    tipo_convenio_desc, orden_agrup_prest_desc, agrup_salud_prest_desc,
    diagnostico_desc, descripcion_prestacion,
    estado_autorizacion_desc, desc_regional_afiliado, usuario_txt,
    COUNT(*)                         AS total_autorizaciones,
    SUM(valor_autorizado_prestacion) AS valor_total,
    SUM(cantidad_autorizada)         AS total_cantidad
FROM autorizaciones
WHERE orden_agrup_prest_desc = 'RADIOLOGIA'
  AND agrup_salud_prest_desc = 'PROCEDIMIENTOS DIAGNOSTICOS'
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12;

CREATE UNIQUE INDEX idx_vm_dash_rx_uq ON vm_dash_rx (
    periodo, usuario_txt, tipo_convenio_desc, orden_agrup_prest_desc,
    agrup_salud_prest_desc, programa_especialidad, desc_regional_afiliado,
    estado_autorizacion_desc, estado_medico, nombre_medico,
    diagnostico_desc, descripcion_prestacion
) NULLS NOT DISTINCT;

CREATE INDEX idx_vm_dash_rx_periodo ON vm_dash_rx (periodo);
CREATE INDEX idx_vm_dash_rx_periodo_estado ON vm_dash_rx (periodo, estado_medico);

-- ═══════════════════════════════════════════════
-- 3. ECOGRAFIAS CAPITADAS
-- ═══════════════════════════════════════════════
DROP MATERIALIZED VIEW IF EXISTS vm_dash_ecografias CASCADE;
CREATE MATERIALIZED VIEW vm_dash_ecografias AS
SELECT
    periodo, estado_medico, nombre_medico, programa_especialidad,
    tipo_convenio_desc, orden_agrup_prest_desc, agrup_salud_prest_desc,
    diagnostico_desc, descripcion_prestacion,
    estado_autorizacion_desc, desc_regional_afiliado, usuario_txt,
    COUNT(*)                         AS total_autorizaciones,
    SUM(valor_autorizado_prestacion) AS valor_total,
    SUM(cantidad_autorizada)         AS total_cantidad
FROM autorizaciones
WHERE tipo_convenio_desc = 'CAPITADO'
  AND orden_agrup_prest_desc = 'ECOGRAFIA'
  AND agrup_salud_prest_desc = 'PROCEDIMIENTOS DIAGNOSTICOS'
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12;

CREATE UNIQUE INDEX idx_vm_dash_ecografias_uq ON vm_dash_ecografias (
    periodo, usuario_txt, tipo_convenio_desc, orden_agrup_prest_desc,
    agrup_salud_prest_desc, programa_especialidad, desc_regional_afiliado,
    estado_autorizacion_desc, estado_medico, nombre_medico,
    diagnostico_desc, descripcion_prestacion
) NULLS NOT DISTINCT;

CREATE INDEX idx_vm_dash_ecografias_periodo ON vm_dash_ecografias (periodo);
CREATE INDEX idx_vm_dash_ecografias_periodo_estado ON vm_dash_ecografias (periodo, estado_medico);

-- ═══════════════════════════════════════════════
-- 4. REMISIONES CAPITADAS
-- ═══════════════════════════════════════════════
DROP MATERIALIZED VIEW IF EXISTS vm_dash_remisiones_cap CASCADE;
CREATE MATERIALIZED VIEW vm_dash_remisiones_cap AS
SELECT
    periodo, estado_medico, nombre_medico, programa_especialidad,
    tipo_convenio_desc, orden_agrup_prest_desc, agrup_salud_prest_desc,
    diagnostico_desc, descripcion_prestacion,
    estado_autorizacion_desc, desc_regional_afiliado, usuario_txt,
    COUNT(*)                         AS total_autorizaciones,
    SUM(valor_autorizado_prestacion) AS valor_total,
    SUM(cantidad_autorizada)         AS total_cantidad
FROM autorizaciones
WHERE tipo_convenio_desc = 'CAPITADO'
  AND orden_agrup_prest_desc IN ('CONSULTA ESP BASICAS', 'CONSULTA MEDICA URGENTE', 'CONSULTA MEDICO GENERAL', 'CONSULTA OTRAS ESP.', 'PROCEDIMIENTOS MENORES', 'PROMOCION Y PREVENCION', 'SALUD EN CASA', 'SALUD ORAL')
  AND agrup_salud_prest_desc IN ('CONSULTAS MEDICAS', 'NIVEL BASICO Y ATENCION DOMICIALIARIA')
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12;

CREATE UNIQUE INDEX idx_vm_dash_remisiones_cap_uq ON vm_dash_remisiones_cap (
    periodo, usuario_txt, tipo_convenio_desc, orden_agrup_prest_desc,
    agrup_salud_prest_desc, programa_especialidad, desc_regional_afiliado,
    estado_autorizacion_desc, estado_medico, nombre_medico,
    diagnostico_desc, descripcion_prestacion
) NULLS NOT DISTINCT;

CREATE INDEX idx_vm_dash_remisiones_cap_periodo ON vm_dash_remisiones_cap (periodo);
CREATE INDEX idx_vm_dash_remisiones_cap_periodo_estado ON vm_dash_remisiones_cap (periodo, estado_medico);

-- ═══════════════════════════════════════════════
-- 5. MEDICAMENTOS
-- ═══════════════════════════════════════════════
DROP MATERIALIZED VIEW IF EXISTS vm_dash_medicamentos CASCADE;
CREATE MATERIALIZED VIEW vm_dash_medicamentos AS
SELECT
    periodo, estado_medico, nombre_medico, programa_especialidad,
    tipo_convenio_desc, orden_agrup_prest_desc, agrup_salud_prest_desc,
    diagnostico_desc, descripcion_prestacion,
    estado_autorizacion_desc, desc_regional_afiliado, usuario_txt,
    COUNT(*)                         AS total_autorizaciones,
    SUM(valor_autorizado_prestacion) AS valor_total,
    SUM(cantidad_autorizada)         AS total_cantidad
FROM autorizaciones
WHERE orden_agrup_prest_desc <> 'PROGRAMAS ESPECIALES'
  AND agrup_salud_prest_desc IN ('MEDICAMENTOS NO PBS', 'MEDICAMENTOS PBS AMBULATORIOS')
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12;

CREATE UNIQUE INDEX idx_vm_dash_medicamentos_uq ON vm_dash_medicamentos (
    periodo, usuario_txt, tipo_convenio_desc, orden_agrup_prest_desc,
    agrup_salud_prest_desc, programa_especialidad, desc_regional_afiliado,
    estado_autorizacion_desc, estado_medico, nombre_medico,
    diagnostico_desc, descripcion_prestacion
) NULLS NOT DISTINCT;

CREATE INDEX idx_vm_dash_medicamentos_periodo ON vm_dash_medicamentos (periodo);
CREATE INDEX idx_vm_dash_medicamentos_periodo_estado ON vm_dash_medicamentos (periodo, estado_medico);

-- ═══════════════════════════════════════════════
-- 6. REMISIONES RED EXTERNA
-- ═══════════════════════════════════════════════
DROP MATERIALIZED VIEW IF EXISTS vm_dash_remisiones_ext CASCADE;
CREATE MATERIALIZED VIEW vm_dash_remisiones_ext AS
SELECT
    periodo, estado_medico, nombre_medico, programa_especialidad,
    tipo_convenio_desc, orden_agrup_prest_desc, agrup_salud_prest_desc,
    diagnostico_desc, descripcion_prestacion,
    estado_autorizacion_desc, desc_regional_afiliado, usuario_txt,
    COUNT(*)                         AS total_autorizaciones,
    SUM(valor_autorizado_prestacion) AS valor_total,
    SUM(cantidad_autorizada)         AS total_cantidad
FROM autorizaciones
WHERE orden_agrup_prest_desc IN ('CONSULTA ESP BASICAS', 'CONSULTA MEDICA URGENTE', 'CONSULTA MEDICO GENERAL', 'CONSULTA OTRAS ESP.', 'PROCEDIMIENTOS MENORES', 'PROMOCION Y PREVENCION', 'SALUD EN CASA', 'SALUD ORAL')
  AND agrup_salud_prest_desc IN ('CONSULTAS MEDICAS', 'NIVEL BASICO Y ATENCION DOMICIALIARIA')
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12;

CREATE UNIQUE INDEX idx_vm_dash_remisiones_ext_uq ON vm_dash_remisiones_ext (
    periodo, usuario_txt, tipo_convenio_desc, orden_agrup_prest_desc,
    agrup_salud_prest_desc, programa_especialidad, desc_regional_afiliado,
    estado_autorizacion_desc, estado_medico, nombre_medico,
    diagnostico_desc, descripcion_prestacion
) NULLS NOT DISTINCT;

CREATE INDEX idx_vm_dash_remisiones_ext_periodo ON vm_dash_remisiones_ext (periodo);
CREATE INDEX idx_vm_dash_remisiones_ext_periodo_estado ON vm_dash_remisiones_ext (periodo, estado_medico);

-- ═══════════════════════════════════════════════
-- 7. PROCEDIMIENTOS DX NO CAPITADOS
-- ═══════════════════════════════════════════════
DROP MATERIALIZED VIEW IF EXISTS vm_dash_proc_dx CASCADE;
CREATE MATERIALIZED VIEW vm_dash_proc_dx AS
SELECT
    periodo, estado_medico, nombre_medico, programa_especialidad,
    tipo_convenio_desc, orden_agrup_prest_desc, agrup_salud_prest_desc,
    diagnostico_desc, descripcion_prestacion,
    estado_autorizacion_desc, desc_regional_afiliado, usuario_txt,
    COUNT(*)                         AS total_autorizaciones,
    SUM(valor_autorizado_prestacion) AS valor_total,
    SUM(cantidad_autorizada)         AS total_cantidad
FROM autorizaciones
WHERE tipo_convenio_desc IN ('ACTIVIDAD', 'VALOR AGREGADO', 'COMPRAS POR VOLUMEN')
  AND agrup_salud_prest_desc IN ('ENDOSCOPIAS DIAGNOST Y TERAPEUTICAS', 'NIVEL BASICO Y ATENCION DOMICILIARIA', 'PROCEDIMIENTOS DIAGNOSTICOS')
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12;

CREATE UNIQUE INDEX idx_vm_dash_proc_dx_uq ON vm_dash_proc_dx (
    periodo, usuario_txt, tipo_convenio_desc, orden_agrup_prest_desc,
    agrup_salud_prest_desc, programa_especialidad, desc_regional_afiliado,
    estado_autorizacion_desc, estado_medico, nombre_medico,
    diagnostico_desc, descripcion_prestacion
) NULLS NOT DISTINCT;

CREATE INDEX idx_vm_dash_proc_dx_periodo ON vm_dash_proc_dx (periodo);
CREATE INDEX idx_vm_dash_proc_dx_periodo_estado ON vm_dash_proc_dx (periodo, estado_medico);
