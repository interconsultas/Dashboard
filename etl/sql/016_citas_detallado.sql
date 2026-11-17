-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 016_citas_detallado.sql
-- Citas por profesional y servicio desde el "INFORME GENERAL DE
-- CITAS DETALLADO POR PROFESIONAL" de Agenda Web (issues #37-#39).
--
--   - servicios_citas: catálogo de servicios por codigo_servicio.
--     Un código nuevo es una traza nueva: nunca se reutiliza ni se
--     fusiona con otro código.
--   - citas_profesional_servicio: una fila por profesional ×
--     servicio × plan agrupador × tiempo de servicio × rango de
--     fechas del informe. Las cargas mensuales y semanales conviven
--     (columna granularidad); recargar el mismo rango lo reemplaza.
--
-- Las cargas mensuales alimentan citas_atendidas (SUM de las
-- confirmadas por documento y periodo) desde etl_citas.py.
--
-- Solo crea objetos nuevos: no depende de las vistas de 006/013/015
-- ni las modifica, así que se puede ejecutar en cualquier orden
-- respecto a ellas. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS servicios_citas (
    codigo_servicio  VARCHAR(20)  PRIMARY KEY,
    nombre_servicio  VARCHAR(200) NOT NULL,
    primer_periodo   INT NOT NULL,   -- YYYYMM de la primera carga en que aparece
    ultimo_periodo   INT NOT NULL    -- YYYYMM de la carga más reciente; el nombre es el de ese periodo
);

CREATE TABLE IF NOT EXISTS citas_profesional_servicio (
    id                        BIGSERIAL    PRIMARY KEY,
    tipo_documento            VARCHAR(5)   NOT NULL,
    documento                 BIGINT NOT NULL,
    nombre_profesional        VARCHAR(150) NOT NULL,
    codigo_ips                VARCHAR(20)  NOT NULL,
    nombre_ips                VARCHAR(150),
    codigo_servicio           VARCHAR(20) NOT NULL REFERENCES servicios_citas (codigo_servicio),
    plan_agrupador            VARCHAR(50)  NOT NULL,
    tiempo_servicio           INT NOT NULL,
    creadas                   INT NOT NULL,
    bloqueadas                INT NOT NULL,
    ofertadas                 INT NOT NULL,
    disponibles               INT NOT NULL,
    asignadas                 INT NOT NULL,
    confirmadas               INT NOT NULL,
    confirmadas_sin_atencion  INT NOT NULL,
    inasistidas               INT NOT NULL,
    canceladas                INT NOT NULL,
    pendientes_por_asistir    INT NOT NULL,
    fecha_inicial             DATE NOT NULL,
    fecha_final               DATE NOT NULL,
    periodo                   INT NOT NULL,   -- YYYYMM de fecha_inicial
    granularidad              VARCHAR(10)  NOT NULL CHECK (granularidad IN ('mensual', 'semanal')),
    archivo_fuente            VARCHAR(255),
    cargado_en                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fecha_final >= fecha_inicial),
    UNIQUE (tipo_documento, documento, codigo_ips, codigo_servicio, plan_agrupador,
            tiempo_servicio, fecha_inicial, fecha_final)
);

CREATE INDEX IF NOT EXISTS idx_cps_periodo
    ON citas_profesional_servicio (periodo);
CREATE INDEX IF NOT EXISTS idx_cps_documento
    ON citas_profesional_servicio (documento);
CREATE INDEX IF NOT EXISTS idx_cps_codigo_servicio
    ON citas_profesional_servicio (codigo_servicio);
-- Reemplazo del rango y validación de solapamientos en cada carga
CREATE INDEX IF NOT EXISTS idx_cps_rango
    ON citas_profesional_servicio (granularidad, fecha_inicial, fecha_final);
