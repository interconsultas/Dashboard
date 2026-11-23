-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 017_areas_servicio.sql
-- Áreas de servicio para el tablero de productividad de citas.
--
--   - areas_servicio: catálogo de áreas con su orden de presentación.
--   - servicios_citas.area: área de cada servicio. La asigna la regla
--     clasificar_area_servicio() cuando el servicio aparece por primera
--     vez; un administrador puede cambiarla (area_editada = TRUE).
--     Las cargas nunca reclasifican un servicio existente.
--   - clasificar_area_servicio(nombre): ÚNICO lugar donde viven las
--     reglas por defecto (sin tildes ni mayúsculas, gana la primera).
--   - v_citas_area / v_citas_area_principal: vistas simples (no
--     materializadas: ~1.000 filas por mes) que consulta el tablero.
--
-- Depende solo de 016. No toca las vistas de 006/013/015, así que se
-- puede ejecutar en cualquier orden respecto a ellas. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS areas_servicio (
    nombre  VARCHAR(50) PRIMARY KEY,
    orden   INT NOT NULL
);

INSERT INTO areas_servicio (nombre, orden) VALUES
    ('Medicina general', 1),
    ('Salud oral', 2),
    ('Laboratorio y tamizajes', 3),
    ('Enfermería', 4),
    ('Especialistas', 5),
    ('Nutrición', 6),
    ('Vacunación', 7),
    ('Psicosocial', 8)
ON CONFLICT (nombre) DO UPDATE SET orden = EXCLUDED.orden;

-- Reglas por defecto. Los patrones empiezan en inicio de palabra (\m) y
-- DIU e INTERNA además terminan en fin de palabra (\M), para que no
-- coincidan dentro de otras palabras (INDIUM, INTERNACIONAL).
CREATE OR REPLACE FUNCTION clasificar_area_servicio(nombre TEXT) RETURNS TEXT AS $$
    SELECT CASE
        WHEN n ~ '\m(ODONTO|HIGIENE ORAL|HIGIENISTA|ENDODONCIA|CIRUGIA ORAL)' THEN 'Salud oral'
        WHEN n ~ '\mNUTRICI' THEN 'Nutrición'
        WHEN n ~ '\m(PSICOLOG|PSICOSOCIAL)' THEN 'Psicosocial'
        WHEN n ~ '\mVACUNA' THEN 'Vacunación'
        WHEN n ~ '\m(LABORATORIO|CITOLOGIA|ADN-PVH)' THEN 'Laboratorio y tamizajes'
        WHEN n ~ '\m(ENFERMER|ELECTROCARDIOGRAMA|PRESION ARTERIAL|DIU\M|JADELLE|IMPLANON|LACTANCIA|ACTIVIDAD EDUCATIVA)'
            THEN 'Enfermería'
        WHEN n ~ '\m(PEDIATRA|GINECO|OBSTETRA|INTERNA\M|DERMATO)' THEN 'Especialistas'
        ELSE 'Medicina general'
    END
    FROM (
        SELECT UPPER(TRANSLATE(COALESCE(nombre, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) AS n
    ) t
$$ LANGUAGE sql IMMUTABLE;

ALTER TABLE servicios_citas ADD COLUMN IF NOT EXISTS area VARCHAR(50);
ALTER TABLE servicios_citas ADD COLUMN IF NOT EXISTS area_editada BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_servicios_citas_area') THEN
        ALTER TABLE servicios_citas ADD CONSTRAINT fk_servicios_citas_area
            FOREIGN KEY (area) REFERENCES areas_servicio (nombre) ON UPDATE CASCADE;
    END IF;
END
$$;

-- Backfill: solo los servicios que aún no tienen área (no pisa ediciones)
UPDATE servicios_citas SET area = clasificar_area_servicio(nombre_servicio) WHERE area IS NULL;

ALTER TABLE servicios_citas ALTER COLUMN area SET NOT NULL;

-- Cada fila del informe detallado con el servicio y su área
CREATE OR REPLACE VIEW v_citas_area AS
SELECT c.id,
       c.tipo_documento,
       c.documento,
       c.nombre_profesional,
       c.codigo_ips,
       c.nombre_ips,
       c.codigo_servicio,
       s.nombre_servicio,
       s.area,
       a.orden AS area_orden,
       c.plan_agrupador,
       c.tiempo_servicio,
       c.creadas,
       c.bloqueadas,
       c.ofertadas,
       c.disponibles,
       c.asignadas,
       c.confirmadas,
       c.confirmadas_sin_atencion,
       c.inasistidas,
       c.canceladas,
       c.pendientes_por_asistir,
       c.fecha_inicial,
       c.fecha_final,
       c.periodo,
       c.granularidad
FROM citas_profesional_servicio c
JOIN servicios_citas s ON s.codigo_servicio = c.codigo_servicio
JOIN areas_servicio a ON a.nombre = s.area;

-- Área principal de cada profesional en cada carga (mes o semana): la de
-- más citas asignadas; en empate, la primera según areas_servicio.orden.
CREATE OR REPLACE VIEW v_citas_area_principal AS
SELECT DISTINCT ON (granularidad, fecha_inicial, fecha_final, tipo_documento, documento)
       granularidad,
       periodo,
       fecha_inicial,
       fecha_final,
       tipo_documento,
       documento,
       area AS area_principal,
       asignadas AS asignadas_area_principal
FROM (
    SELECT granularidad, periodo, fecha_inicial, fecha_final, tipo_documento, documento,
           area, area_orden, SUM(asignadas)::int AS asignadas
    FROM v_citas_area
    GROUP BY granularidad, periodo, fecha_inicial, fecha_final, tipo_documento, documento,
             area, area_orden
) por_area
ORDER BY granularidad, fecha_inicial, fecha_final, tipo_documento, documento,
         asignadas DESC, area_orden;
