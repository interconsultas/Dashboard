-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 009_idx_fecha_emision.sql
-- Soporta el filtro por día del dashboard general (issue #4).
--
-- La columna que impulsa el filtro diario está centralizada como
-- COLUMNA_FECHA_DIARIA en dashboard/src/lib/dashboard-filters.ts
-- (hoy: fecha_emision — fecha_atencion se descartó porque ni el
-- archivo EPS ni el AJUSTADOS la traen de forma confiable). Si esa
-- constante cambia, este índice debe actualizarse junto con ella.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_autorizaciones_periodo_fecha_emision
    ON autorizaciones (periodo, fecha_emision);
