-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 012_periodos_detectados.sql
-- log_cargas.periodo_detectado es INT (un solo valor). Cuando un archivo
-- abarca mas de un periodo (ej. un corte semanal que cruza fin de mes),
-- solo quedaba registrado el primero, y el historial mostraba el mes
-- equivocado para el resto de las filas de ese archivo. Se agrega un
-- array con la lista completa; periodo_detectado se mantiene igual
-- (compatibilidad con el resto del codigo que ya lo usa).
-- ============================================================

ALTER TABLE log_cargas ADD COLUMN IF NOT EXISTS periodos_detectados INT[] NULL;
