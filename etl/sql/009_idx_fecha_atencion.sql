-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 009_idx_fecha_atencion.sql
-- Soporta el filtro por día del dashboard general (issue #4).
--
-- La columna que impulsa el filtro diario está centralizada como
-- COLUMNA_FECHA_DIARIA en dashboard/src/lib/dashboard-filters.ts
-- (hoy: fecha_atencion). Si esa constante cambia, este índice debe
-- actualizarse junto con ella.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_autorizaciones_periodo_fecha_atencion
    ON autorizaciones (periodo, fecha_atencion);
