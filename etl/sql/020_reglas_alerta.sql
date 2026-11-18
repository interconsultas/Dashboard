-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 020_reglas_alerta.sql
-- Inteligencia › Alertas (fase 3): reglas configurables que se evalúan
-- sobre el último periodo cargado de citas (v_citas_area).
--
--   - reglas_alerta(clave, ...): umbral como fracción (0.20 = 20 %),
--     periodos consecutivos y volumen mínimo; NULL = la regla no usa ese
--     parámetro (o, en el umbral de la proyección, usar la meta
--     institucional META_INASISTENCIA de dashboard/src/lib/productividad).
--   - Las claves y qué parámetros usa cada regla viven en
--     dashboard/src/lib/inteligencia/reglas.ts; la API valida antes de
--     escribir y registra quién y cuándo (actualizado_por/_en).
--   - Editar reglas exige 'editar' en la sección 'inteligencia' (admin lo
--     tiene siempre por código; no se cambia permisos_rol aquí).
--   - No crea vistas: no depende de las vistas que recrea 006.
--   - ON CONFLICT DO NOTHING: volver a ejecutar no pisa lo configurado.
--     Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS reglas_alerta (
    clave           VARCHAR(40) PRIMARY KEY,
    nombre          VARCHAR(120) NOT NULL,
    descripcion     TEXT NOT NULL,
    activa          BOOLEAN NOT NULL DEFAULT TRUE,
    umbral          NUMERIC(6,4)
                    CHECK (umbral IS NULL OR (umbral >= 0 AND umbral <= 1)),
    periodos        INTEGER
                    CHECK (periodos IS NULL OR periodos BETWEEN 1 AND 6),
    minimo          INTEGER
                    CHECK (minimo IS NULL OR minimo >= 0),
    gravedad        VARCHAR(10) NOT NULL
                    CHECK (gravedad IN ('alta', 'media')),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_por VARCHAR(255)
);

INSERT INTO reglas_alerta (clave, nombre, descripcion, activa, umbral, periodos, minimo, gravedad) VALUES
    ('inasistencia_servicio',
     'Inasistencia alta sostenida por servicio',
     'Servicio con % de inasistencia sobre el umbral en los últimos periodos consecutivos, con un mínimo de citas asignadas en cada uno.',
     TRUE, 0.2, 2, 30, 'alta'),
    ('disponibilidad_servicio',
     'Citas sin asignar por servicio',
     'Servicio con % de disponibilidad (ofertadas sin asignar) sobre el umbral en el último periodo, con un mínimo de citas ofertadas.',
     TRUE, 0.15, NULL, 30, 'media'),
    ('inasistencia_profesional',
     'Inasistencia alta por profesional',
     'Profesional con % de inasistencia sobre el umbral en el último periodo, con un mínimo de citas asignadas.',
     TRUE, 0.3, NULL, 50, 'media'),
    ('proyeccion_sobre_meta',
     'Proyección por encima de la meta',
     'Área cuya inasistencia proyectada para el siguiente periodo supera el umbral (vacío = la meta institucional) y viene en alza.',
     TRUE, NULL, NULL, NULL, 'alta')
ON CONFLICT (clave) DO NOTHING;
