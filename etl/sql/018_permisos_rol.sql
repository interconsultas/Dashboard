-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 018_permisos_rol.sql
-- Permisos por rol, configurables desde Administración › Usuarios.
--
--   - permisos_rol(rol, seccion, nivel): nivel de acceso de cada rol a
--     cada sección del dashboard ('ninguno', 'ver' o 'editar').
--   - Las claves de sección y qué secciones admiten 'editar' viven en
--     dashboard/src/lib/acceso.ts (SECCIONES); la API valida antes de
--     escribir.
--   - admin siempre tiene acceso total y 'usuarios' es solo de admin:
--     el código lo impone sin importar lo que diga esta tabla. Sus filas
--     se siembran solo como referencia.
--   - La semilla reproduce el acceso fijo anterior. ON CONFLICT DO
--     NOTHING: volver a ejecutar no pisa lo configurado. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS permisos_rol (
    rol         VARCHAR(30) NOT NULL
                CHECK (rol IN ('admin', 'direccion_medica', 'coordinador')),
    seccion     VARCHAR(30) NOT NULL,
    nivel       VARCHAR(10) NOT NULL
                CHECK (nivel IN ('ninguno', 'ver', 'editar')),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (rol, seccion)
);

INSERT INTO permisos_rol (rol, seccion, nivel) VALUES
    ('admin', 'dashboard',     'editar'),
    ('admin', 'cumplimiento',  'editar'),
    ('admin', 'productividad', 'editar'),
    ('admin', 'carga',         'editar'),
    ('admin', 'profesionales', 'editar'),
    ('admin', 'metas',         'editar'),
    ('admin', 'citas',         'editar'),
    ('admin', 'usuarios',      'editar'),

    ('direccion_medica', 'dashboard',     'ver'),
    ('direccion_medica', 'cumplimiento',  'ver'),
    ('direccion_medica', 'productividad', 'ver'),
    ('direccion_medica', 'carga',         'ninguno'),
    ('direccion_medica', 'profesionales', 'ninguno'),
    ('direccion_medica', 'metas',         'ver'),
    ('direccion_medica', 'citas',         'ninguno'),
    ('direccion_medica', 'usuarios',      'ninguno'),

    ('coordinador', 'dashboard',     'ver'),
    ('coordinador', 'cumplimiento',  'ninguno'),
    ('coordinador', 'productividad', 'ninguno'),
    ('coordinador', 'carga',         'ninguno'),
    ('coordinador', 'profesionales', 'ninguno'),
    ('coordinador', 'metas',         'ninguno'),
    ('coordinador', 'citas',         'ninguno'),
    ('coordinador', 'usuarios',      'ninguno')
ON CONFLICT (rol, seccion) DO NOTHING;
