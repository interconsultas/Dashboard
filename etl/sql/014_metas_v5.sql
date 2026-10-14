-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 014_metas_v5.sql
-- Metas v5: el programa de metas de cada profesional se resuelve
-- desde medicos.programa_especialidad con una tabla de mapeo
-- editable, se siembra la fila informativa TOTAL MGI de 2026 y se
-- eliminan medicos.programa_meta y citas_atendidas.programa.
-- Idempotente: se puede ejecutar varias veces sin efectos adversos.
-- Se ejecuta después de 013_cumplimiento.sql.
-- ============================================================

-- ─────────────────────────────────────────────
-- MAPEO: especialidad del profesional → programa de metas
-- ─────────────────────────────────────────────
-- programa_especialidad se guarda normalizado (UPPER(TRIM())) y se cruza
-- con UPPER(TRIM(medicos.programa_especialidad)).
-- programa NULL (o especialidad sin fila) = sin meta: el profesional no
-- tiene porcentaje y no afecta el ranking ni el global.
CREATE TABLE IF NOT EXISTS programa_meta_mapeo (
    programa_especialidad VARCHAR(100) PRIMARY KEY,
    programa              VARCHAR(80)  NULL,
    actualizado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Mapeo inicial acordado con el cliente; las ediciones posteriores se conservan
INSERT INTO programa_meta_mapeo (programa_especialidad, programa) VALUES
    ('MÉDICO GENERAL INTEGRADOR', 'PROGRAMADA'),
    ('SUPERNUMERARIO',            'PROGRAMADA'),
    ('DIRECCIÓN MÉDICA',          'PROGRAMADA'),
    ('TELEMEDICINA',              'PROGRAMADA'),
    ('NO PROGRAMADA',             'NO PROGRAMADA'),
    ('RCV',                       'RCV'),
    ('PROGRAMAS PYM',             'CyD-RIAS-PF-SALUD PÚBLICA'),
    ('RIAS',                      'CyD-RIAS-PF-SALUD PÚBLICA'),
    ('SSR',                       'CyD-RIAS-PF-SALUD PÚBLICA'),
    ('SALUD PÚBLICA',             'CyD-RIAS-PF-SALUD PÚBLICA'),
    ('MATERNO INFANTIL',          'CPR'),
    ('DERMATOLOGÍA',              'DERMATOLOGÍA'),
    ('MEDICINA INTERNA',          'MEDICINA INTERNA'),
    ('GINECOLOGÍA Y OBSTETRICIA', 'GINECOLOGÍA Y OBSTETRICIA'),
    ('PEDIATRÍA',                 'PEDIATRÍA')
ON CONFLICT (programa_especialidad) DO NOTHING;

-- ─────────────────────────────────────────────
-- SEED: fila informativa TOTAL MÉDICOS GENERALES INTEGRADORES 2026
-- ─────────────────────────────────────────────
-- Editable en Metas, pero no se asigna a profesionales ni entra en
-- ningún cálculo. Las especialidades (DERMATOLOGÍA, MEDICINA INTERNA,
-- GINECOLOGÍA Y OBSTETRICIA, PEDIATRÍA) no tienen metas sembradas.
INSERT INTO metas (anio, programa, tipo_prestacion, valor_meta, escala) VALUES
    (2026, 'TOTAL MGI', 'medicamentos',    2.698630, 'ratio'),
    (2026, 'TOTAL MGI', 'laboratorios',    0.755312, 'ratio'),
    (2026, 'TOTAL MGI', 'proc_dx',         7.733049, 'x100'),
    (2026, 'TOTAL MGI', 'rx',              3.280461, 'x100'),
    (2026, 'TOTAL MGI', 'ecografias',      1.018033, 'x100'),
    (2026, 'TOTAL MGI', 'remisiones_cap',  3.113825, 'x100'),
    (2026, 'TOTAL MGI', 'remisiones_ext', 11.162229, 'x100')
ON CONFLICT (anio, programa, tipo_prestacion) DO NOTHING;

-- ─────────────────────────────────────────────
-- El programa sale solo del catálogo de profesionales vía el mapeo
-- ─────────────────────────────────────────────
-- Se eliminan el programa por profesional y el programa por periodo.
ALTER TABLE medicos DROP COLUMN IF EXISTS programa_meta;
ALTER TABLE citas_atendidas DROP COLUMN IF EXISTS programa;
