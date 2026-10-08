-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 013_cumplimiento.sql
-- Infraestructura del módulo de cumplimiento: órdenes por médico
-- y periodo en 7 categorías, programa de cada médico y metas 2026.
-- Idempotente: se puede ejecutar varias veces sin efectos adversos.
--
-- IMPORTANTE: 006_create_subviews.sql elimina las subvistas
-- vm_dash_* con CASCADE, lo que también elimina vm_cumpl_ordenes.
-- Cada vez que se vuelva a ejecutar 006 hay que volver a ejecutar
-- este archivo.
-- ============================================================

-- ─────────────────────────────────────────────
-- VISTA: órdenes por categoría, periodo y médico
-- ─────────────────────────────────────────────
-- Hereda los filtros de las 7 subvistas vm_dash_* (fuente única de
-- verdad). La definición de cada categoría vive solo en 006: aquí no
-- se deben repetir sus condiciones WHERE.
-- Se conservan numero_remite (médico que ordena) y usuario_txt
-- (usuario que digita) para poder cambiar el criterio de atribución
-- sin reconstruir la vista.
DROP MATERIALIZED VIEW IF EXISTS vm_cumpl_ordenes;
CREATE MATERIALIZED VIEW vm_cumpl_ordenes AS
SELECT 'medicamentos' AS categoria, periodo, numero_remite, usuario_txt,
       SUM(total_autorizaciones)::bigint AS ordenes,
       SUM(total_cantidad)               AS cantidad
FROM vm_dash_medicamentos
GROUP BY periodo, numero_remite, usuario_txt
UNION ALL
SELECT 'laboratorios' AS categoria, periodo, numero_remite, usuario_txt,
       SUM(total_autorizaciones)::bigint AS ordenes,
       SUM(total_cantidad)               AS cantidad
FROM vm_dash_laboratorios
GROUP BY periodo, numero_remite, usuario_txt
UNION ALL
SELECT 'proc_dx' AS categoria, periodo, numero_remite, usuario_txt,
       SUM(total_autorizaciones)::bigint AS ordenes,
       SUM(total_cantidad)               AS cantidad
FROM vm_dash_proc_dx
GROUP BY periodo, numero_remite, usuario_txt
UNION ALL
SELECT 'rx' AS categoria, periodo, numero_remite, usuario_txt,
       SUM(total_autorizaciones)::bigint AS ordenes,
       SUM(total_cantidad)               AS cantidad
FROM vm_dash_rx
GROUP BY periodo, numero_remite, usuario_txt
UNION ALL
SELECT 'ecografias' AS categoria, periodo, numero_remite, usuario_txt,
       SUM(total_autorizaciones)::bigint AS ordenes,
       SUM(total_cantidad)               AS cantidad
FROM vm_dash_ecografias
GROUP BY periodo, numero_remite, usuario_txt
UNION ALL
SELECT 'remisiones_cap' AS categoria, periodo, numero_remite, usuario_txt,
       SUM(total_autorizaciones)::bigint AS ordenes,
       SUM(total_cantidad)               AS cantidad
FROM vm_dash_remisiones_cap
GROUP BY periodo, numero_remite, usuario_txt
UNION ALL
SELECT 'remisiones_ext' AS categoria, periodo, numero_remite, usuario_txt,
       SUM(total_autorizaciones)::bigint AS ordenes,
       SUM(total_cantidad)               AS cantidad
FROM vm_dash_remisiones_ext
GROUP BY periodo, numero_remite, usuario_txt;

-- Índice único requerido por REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_vm_cumpl_ordenes_uq ON vm_cumpl_ordenes (
    categoria, periodo, numero_remite, usuario_txt
) NULLS NOT DISTINCT;

CREATE INDEX idx_vm_cumpl_ordenes_periodo_remite ON vm_cumpl_ordenes (periodo, numero_remite);
CREATE INDEX idx_vm_cumpl_ordenes_periodo_usuario ON vm_cumpl_ordenes (periodo, usuario_txt);

-- ─────────────────────────────────────────────
-- PROGRAMA DE CADA MÉDICO
-- ─────────────────────────────────────────────
-- Programa por defecto con el que se eligen las metas del médico
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS programa_meta VARCHAR(80);

-- Programa vigente para ese médico en ese periodo
ALTER TABLE citas_atendidas ADD COLUMN IF NOT EXISTS programa VARCHAR(80);

-- ─────────────────────────────────────────────
-- SEED: metas 2026 por programa y categoría
-- ─────────────────────────────────────────────
-- tipo_prestacion usa la misma clave que vm_cumpl_ordenes.categoria.
-- escala 'ratio': órdenes por cita; 'x100': órdenes por cada 100 citas.
INSERT INTO metas (anio, programa, tipo_prestacion, valor_meta, escala) VALUES
    (2026, 'PROGRAMADA', 'medicamentos',    2.551437, 'ratio'),
    (2026, 'PROGRAMADA', 'laboratorios',    0.470820, 'ratio'),
    (2026, 'PROGRAMADA', 'proc_dx',        10.095598, 'x100'),
    (2026, 'PROGRAMADA', 'rx',              4.302063, 'x100'),
    (2026, 'PROGRAMADA', 'ecografias',      1.094292, 'x100'),
    (2026, 'PROGRAMADA', 'remisiones_cap',  4.303026, 'x100'),
    (2026, 'PROGRAMADA', 'remisiones_ext', 14.273934, 'x100'),

    (2026, 'NO PROGRAMADA', 'medicamentos',   0.648462, 'ratio'),
    (2026, 'NO PROGRAMADA', 'laboratorios',   0.099292, 'ratio'),
    (2026, 'NO PROGRAMADA', 'proc_dx',        0.988535, 'x100'),
    (2026, 'NO PROGRAMADA', 'rx',             1.759718, 'x100'),
    (2026, 'NO PROGRAMADA', 'ecografias',     0.265421, 'x100'),
    (2026, 'NO PROGRAMADA', 'remisiones_cap', 0.206903, 'x100'),
    (2026, 'NO PROGRAMADA', 'remisiones_ext', 1.920643, 'x100'),

    (2026, 'RCV', 'medicamentos',    5.746657, 'ratio'),
    (2026, 'RCV', 'laboratorios',    2.298329, 'ratio'),
    (2026, 'RCV', 'proc_dx',         4.758783, 'x100'),
    (2026, 'RCV', 'rx',              1.769336, 'x100'),
    (2026, 'RCV', 'ecografias',      0.166853, 'x100'),
    (2026, 'RCV', 'remisiones_cap',  1.418250, 'x100'),
    (2026, 'RCV', 'remisiones_ext', 10.530850, 'x100'),

    (2026, 'CyD-RIAS-PF-SALUD PÚBLICA', 'medicamentos',   0.482339, 'ratio'),
    (2026, 'CyD-RIAS-PF-SALUD PÚBLICA', 'laboratorios',   0.497836, 'ratio'),
    (2026, 'CyD-RIAS-PF-SALUD PÚBLICA', 'proc_dx',        3.467167, 'x100'),
    (2026, 'CyD-RIAS-PF-SALUD PÚBLICA', 'rx',             1.444653, 'x100'),
    (2026, 'CyD-RIAS-PF-SALUD PÚBLICA', 'ecografias',     0.376485, 'x100'),
    (2026, 'CyD-RIAS-PF-SALUD PÚBLICA', 'remisiones_cap', 0.516573, 'x100'),
    (2026, 'CyD-RIAS-PF-SALUD PÚBLICA', 'remisiones_ext', 5.165729, 'x100'),

    (2026, 'CPR', 'medicamentos',    0.630667, 'ratio'),
    (2026, 'CPR', 'laboratorios',    1.204476, 'ratio'),
    (2026, 'CPR', 'proc_dx',        12.677165, 'x100'),
    (2026, 'CPR', 'rx',              0.232076, 'x100'),
    (2026, 'CPR', 'ecografias',      8.412764, 'x100'),
    (2026, 'CPR', 'remisiones_cap',  4.979970, 'x100'),
    (2026, 'CPR', 'remisiones_ext',  1.411797, 'x100')
ON CONFLICT (anio, programa, tipo_prestacion) DO NOTHING;
