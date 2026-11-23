-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 019_inteligencia.sql
-- Sección Inteligencia (fase 3): mapa de relaciones entre servicios,
-- profesionales, programas de metas y autorizaciones.
--
--   - Solo siembra permisos_rol para la nueva sección 'inteligencia'
--     (solo consulta: la sección no tiene acciones de escritura).
--   - El grafo se calcula en cada consulta sobre las vistas existentes
--     (v_citas_area, vm_cumpl_ordenes, vm_dash_*): no crea vistas ni
--     tablas, así que no entra en la cadena de 006 ... CASCADE.
--   - Depende de 018. ON CONFLICT DO NOTHING: volver a ejecutar no pisa
--     lo configurado en Administración › Usuarios. Idempotente.
-- ============================================================

INSERT INTO permisos_rol (rol, seccion, nivel) VALUES
    ('admin',            'inteligencia', 'editar'),
    ('direccion_medica', 'inteligencia', 'ver'),
    ('coordinador',      'inteligencia', 'ninguno')
ON CONFLICT (rol, seccion) DO NOTHING;
