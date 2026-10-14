-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 015_filtros_remisiones.sql
-- Ajuste de filtros acordado con el cliente (issue #35):
--   - vm_dash_remisiones_cap: además de los filtros existentes, solo
--     cuenta las 18 prestaciones de pediatría, medicina interna,
--     ginecología y dermatología (descripcion_prestacion).
--   - vm_dash_remisiones_ext: solo convenio ACTIVIDAD.
-- Recrea ambas vistas con la misma estructura e índices de
-- 006_create_subviews.sql, que ya contiene la definición nueva.
-- Idempotente: se puede ejecutar varias veces sin efectos adversos.
--
-- IMPORTANTE: el DROP ... CASCADE también elimina vm_cumpl_ordenes
-- (depende de estas vistas). Inmediatamente después de este archivo
-- hay que volver a ejecutar 013_cumplimiento.sql.
-- ============================================================

-- ═══════════════════════════════════════════════
-- REMISIONES CAPITADAS
-- ═══════════════════════════════════════════════
DROP MATERIALIZED VIEW IF EXISTS vm_dash_remisiones_cap CASCADE;
CREATE MATERIALIZED VIEW vm_dash_remisiones_cap AS
SELECT
    periodo, estado_medico, nombre_medico, programa_especialidad,
    tipo_convenio_desc, orden_agrup_prest_desc, agrup_salud_prest_desc,
    diagnostico_desc, descripcion_prestacion,
    estado_autorizacion_desc, desc_regional_afiliado, usuario_txt,
    numero_remite,
    COUNT(*)                         AS total_autorizaciones,
    SUM(valor_autorizado_prestacion) AS valor_total,
    SUM(cantidad_autorizada)         AS total_cantidad
FROM autorizaciones
WHERE tipo_convenio_desc = 'CAPITADO'
  AND orden_agrup_prest_desc IN ('CONSULTA ESP BASICAS', 'CONSULTA MEDICO GENERAL', 'CONSULTA OTRAS ESP.', 'PROMOCION Y PREVENCION', 'SALUD EN CASA')
  AND agrup_salud_prest_desc IN ('CONSULTAS MEDICAS', 'NIVEL BASICO Y ATENCION DOMICIALIARIA')
  -- Los dobles espacios ('CONTROL  EN ...') son intencionales: así vienen
  -- en los datos de origen y la comparación es exacta.
  AND descripcion_prestacion IN (
      'CONTROL  EN PEDIATRIA',
      'CONSULTA  EN PEDIATRIA',
      'CONTROL PEDIATRA',
      'CONSULTA PEDIATRA',
      'CONTROL  EN MEDICINA INTERNA',
      'CONSULTA  EN MEDICINA INTERNA',
      'CONTROL MEDICINA INTERNA (NO VIGENTE, USAR CODIGO 890366)',
      'CONTROL MEDICINA INTERNA',
      'CONSULTA MEDICINA INTERNA',
      'CONTROL GINECOLOGIA',
      'CONSULTA GINECOLOGIA',
      'CONTROL GINECOLOGO (A) (NO VIGENTE, USAR CODIGO 890350)',
      'CONTROL GINECOLOGO (A)',
      'CONSULTA GINECOLOGO',
      'CONTROL  EN DERMATOLOGIA',
      'CONSULTA  EN DERMATOLOGIA',
      'CONTROL DERMATOLOGO (A)',
      'CONSULTA DERMATOLOGIA'
  )
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13;

CREATE UNIQUE INDEX idx_vm_dash_remisiones_cap_uq ON vm_dash_remisiones_cap (
    periodo, usuario_txt, tipo_convenio_desc, orden_agrup_prest_desc,
    agrup_salud_prest_desc, programa_especialidad, desc_regional_afiliado,
    estado_autorizacion_desc, estado_medico, nombre_medico,
    diagnostico_desc, descripcion_prestacion, numero_remite
) NULLS NOT DISTINCT;

CREATE INDEX idx_vm_dash_remisiones_cap_periodo ON vm_dash_remisiones_cap (periodo);
CREATE INDEX idx_vm_dash_remisiones_cap_periodo_estado ON vm_dash_remisiones_cap (periodo, estado_medico);

-- ═══════════════════════════════════════════════
-- REMISIONES RED EXTERNA
-- ═══════════════════════════════════════════════
DROP MATERIALIZED VIEW IF EXISTS vm_dash_remisiones_ext CASCADE;
CREATE MATERIALIZED VIEW vm_dash_remisiones_ext AS
SELECT
    periodo, estado_medico, nombre_medico, programa_especialidad,
    tipo_convenio_desc, orden_agrup_prest_desc, agrup_salud_prest_desc,
    diagnostico_desc, descripcion_prestacion,
    estado_autorizacion_desc, desc_regional_afiliado, usuario_txt,
    numero_remite,
    COUNT(*)                         AS total_autorizaciones,
    SUM(valor_autorizado_prestacion) AS valor_total,
    SUM(cantidad_autorizada)         AS total_cantidad
FROM autorizaciones
WHERE tipo_convenio_desc IN ('ACTIVIDAD')
  AND orden_agrup_prest_desc IN ('CONSULTA ESP BASICAS', 'CONSULTA MEDICA URGENTE', 'CONSULTA MEDICO GENERAL', 'CONSULTA OTRAS ESP.')
  AND agrup_salud_prest_desc IN ('CONSULTAS MEDICAS', 'NIVEL BASICO Y ATENCION DOMICIALIARIA')
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13;

CREATE UNIQUE INDEX idx_vm_dash_remisiones_ext_uq ON vm_dash_remisiones_ext (
    periodo, usuario_txt, tipo_convenio_desc, orden_agrup_prest_desc,
    agrup_salud_prest_desc, programa_especialidad, desc_regional_afiliado,
    estado_autorizacion_desc, estado_medico, nombre_medico,
    diagnostico_desc, descripcion_prestacion, numero_remite
) NULLS NOT DISTINCT;

CREATE INDEX idx_vm_dash_remisiones_ext_periodo ON vm_dash_remisiones_ext (periodo);
CREATE INDEX idx_vm_dash_remisiones_ext_periodo_estado ON vm_dash_remisiones_ext (periodo, estado_medico);
