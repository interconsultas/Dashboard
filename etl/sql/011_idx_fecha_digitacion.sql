-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 011_idx_fecha_digitacion.sql
-- El filtro por dia del dashboard (issue #4) paso de fecha_emision a
-- fecha_digitacion: esta ultima queda acotada al mes de periodo, a
-- diferencia de fecha_emision que puede venir de meses anteriores por
-- atraso administrativo (ver PR #12). El indice de 009_idx_fecha_emision.sql
-- no se toca (ya mergeado en produccion); queda sin uso, no hace falta borrarlo.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_autorizaciones_periodo_fecha_digitacion
    ON autorizaciones (periodo, fecha_digitacion);
