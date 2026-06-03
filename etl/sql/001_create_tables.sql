-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 001_create_tables.sql
-- Ejecutar con: psql -U ips_user -d interconsultas_dev -f 001_create_tables.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- EXTENSIONES
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- para gen_random_uuid()

-- ─────────────────────────────────────────────
-- CATÁLOGO: medicos
-- Fuente: BD profesionales TXT.xlsx
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medicos (
    usuario_txt           VARCHAR(20)   PRIMARY KEY,
    identificacion        BIGINT        UNIQUE NOT NULL,
    nombre                VARCHAR(150)  NOT NULL,
    estado                VARCHAR(20)   NOT NULL DEFAULT 'ACTIVO',
    programa_especialidad VARCHAR(100),
    area                  VARCHAR(50)
);

-- ─────────────────────────────────────────────
-- CATÁLOGO: usuarios del sistema (login)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
    id            BIGSERIAL    PRIMARY KEY,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre        VARCHAR(150) NOT NULL,
    rol           VARCHAR(30)  NOT NULL CHECK (rol IN ('admin','direccion_medica','coordinador')),
    regional      VARCHAR(60)  NULL,   -- solo para coordinador
    activo        BOOLEAN      DEFAULT TRUE,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    last_login    TIMESTAMPTZ  NULL
);

-- ─────────────────────────────────────────────
-- CATÁLOGO: metas de tasas por ordenamiento 2026
-- Fuente: METAS 2026 v4.xlsx — hoja "METAS 2026"
-- Editable desde el frontend (UPDATE por anio+programa+tipo_prestacion)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metas (
    id               BIGSERIAL     PRIMARY KEY,
    anio             SMALLINT      NOT NULL,
    programa         VARCHAR(80)   NOT NULL,
    tipo_prestacion  VARCHAR(80)   NOT NULL,
    valor_meta       NUMERIC(12,6) NOT NULL,
    escala           VARCHAR(10)   NOT NULL DEFAULT 'ratio'
                     CHECK (escala IN ('ratio','x100')),
    descripcion      VARCHAR(200)  NULL,
    activo           BOOLEAN       DEFAULT TRUE,
    actualizado_en   TIMESTAMPTZ   DEFAULT NOW(),
    UNIQUE (anio, programa, tipo_prestacion)
);

-- ─────────────────────────────────────────────
-- CONTROL: registro de cada carga de archivo
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS log_cargas (
    id                       BIGSERIAL    PRIMARY KEY,
    job_id                   UUID         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    nombre_archivo           VARCHAR(255) NOT NULL,
    hash_archivo             CHAR(64),              -- SHA-256 del binario (indexado, no unique para permitir --force)
    periodo_detectado        INT          NULL,
    filas_en_archivo         INT          DEFAULT 0,
    filas_validas            INT          DEFAULT 0,
    filas_insertadas         INT          DEFAULT 0,
    filas_duplicadas         INT          DEFAULT 0,
    filas_con_error          INT          DEFAULT 0,
    fechas_invalidas         INT          DEFAULT 0,
    valores_invalidos        INT          DEFAULT 0,
    medicos_no_encontrados   JSONB        DEFAULT '[]',
    columnas_faltantes       JSONB        DEFAULT '[]',
    distribucion_estados     JSONB        NULL,     -- {"GENERADA": 22.6, "POR CONVENIO": 64.4, ...}
    suma_valor_autorizado    NUMERIC(18,2) NULL,
    estado                   VARCHAR(30)  NOT NULL DEFAULT 'procesando'
                             CHECK (estado IN ('procesando','previsualizando','esperando_confirmacion','cargando','exitoso','exitoso_con_advertencias','cancelado','error_fatal','ya_procesado')),
    error_mensaje            TEXT         NULL,
    cargado_por              VARCHAR(150) NULL,
    tiempo_segundos          NUMERIC(8,1) NULL,
    cargado_en               TIMESTAMPTZ  DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- STAGING: área de previsualización antes de confirmar carga
-- Misma estructura que autorizaciones, sin restricciones UNIQUE
-- Se limpia al confirmar o cancelar
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staging_autorizaciones (
    id                              BIGSERIAL,
    job_id                          UUID         NOT NULL,  -- FK lógica a log_cargas.job_id

    -- Afiliado
    afiliado_id                     BIGINT,
    codigo_tipo_documento           VARCHAR(5),
    numero_documento                BIGINT,
    fecha_nacimiento                DATE,
    edad                            SMALLINT,
    primer_apellido                 VARCHAR(60),
    segundo_apellido                VARCHAR(60),
    primer_nombre                   VARCHAR(60),
    segundo_nombre                  VARCHAR(60),
    cod_regional_afiliado           SMALLINT,
    desc_regional_afiliado          VARCHAR(60),
    ciudad_afiliado                 VARCHAR(60),
    sexo                            CHAR(1),
    ind_cotizante                   CHAR(1),
    codigo_nivel_ingreso            VARCHAR(30),
    codigo_sucursal_afiliado        INT,
    descripcion_sucursal_afiliado   VARCHAR(100),
    cod_regional_ips_afiliado       SMALLINT,
    desc_regional_ips_afiliado      VARCHAR(60),

    -- Orden / Autorización
    numero_consec_orden_serie       VARCHAR(30),
    numero_consec_evento            INT,

    -- Prestación
    codigo_prestacion               VARCHAR(20),
    descripcion_prestacion          VARCHAR(200),
    agrup_salud_prest_desc          VARCHAR(100),
    orden_agrup_prest_desc          VARCHAR(100),

    -- Fechas
    periodo                         INT          NOT NULL,
    fecha_digitacion                DATE,
    fecha_emision                   DATE,
    fecha_atencion_ivr              TIMESTAMPTZ  NULL,
    fecha_programacion              DATE         NULL,
    fecha_atencion                  DATE         NULL,

    -- Diagnóstico
    codigo_diagnostico              VARCHAR(10),
    diagnostico_desc                VARCHAR(200),

    -- Sucursal que emite
    codigo_sucursal_emite           INT,
    descripcion_sucursal_emite      VARCHAR(100),

    -- Médico ordenador
    tipo_remite                     VARCHAR(5),
    numero_remite                   BIGINT,
    prestador_remite                VARCHAR(150),
    codigo_especialidad_remite      VARCHAR(20)  NULL,
    especialidad_desc_remite        VARCHAR(100) NULL,
    usuario_txt                     VARCHAR(20)  NULL,

    -- Datos del médico (enriquecidos desde BD profesionales)
    nombre_medico                   VARCHAR(150) NULL,
    estado_medico                   VARCHAR(20)  NULL,
    programa_especialidad           VARCHAR(100) NULL,
    area_medico                     VARCHAR(50)  NULL,

    -- Prestador que atiende
    codigo_sucursal_atiende         INT,
    descripcion_sucursal_atiende    VARCHAR(100),
    codigo_tipo_ident_atiende       VARCHAR(5),
    num_ident_prestador_atiende     BIGINT,
    descripcion_prestador_atiende   VARCHAR(150),

    -- Catálogos (solo descripciones)
    tipo_prestacion_desc            VARCHAR(100),
    origen_servicio_desc            VARCHAR(100),
    producto_pac_eps_desc           VARCHAR(100),
    estado_autorizacion_desc        VARCHAR(60),
    tipo_convenio_desc              VARCHAR(100),
    origen_autorizacion_desc        VARCHAR(100),
    tipo_evento_desc                VARCHAR(100),
    tipo_cobro_desc                 VARCHAR(100),

    -- Cantidad y valores
    cantidad_autorizada             SMALLINT,
    valor_autorizado_prestacion     NUMERIC(15,2) NULL,
    valor_provision                 NUMERIC(15,2) NULL,

    hash_fila                       VARCHAR(64)  NULL,

    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_staging_job_id ON staging_autorizaciones (job_id);

-- ─────────────────────────────────────────────
-- HECHOS: autorizaciones (PARTICIONADA POR PERIODO)
-- Fuente: DETALLADOS EPS → normalización → carga
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autorizaciones (
    id                              BIGSERIAL,

    -- Afiliado
    afiliado_id                     BIGINT,
    codigo_tipo_documento           VARCHAR(5),
    numero_documento                BIGINT,
    fecha_nacimiento                DATE,
    edad                            SMALLINT,
    primer_apellido                 VARCHAR(60),
    segundo_apellido                VARCHAR(60),
    primer_nombre                   VARCHAR(60),
    segundo_nombre                  VARCHAR(60),
    cod_regional_afiliado           SMALLINT,
    desc_regional_afiliado          VARCHAR(60),
    ciudad_afiliado                 VARCHAR(60),
    sexo                            CHAR(1),
    ind_cotizante                   CHAR(1),
    codigo_nivel_ingreso            VARCHAR(30),
    codigo_sucursal_afiliado        INT,
    descripcion_sucursal_afiliado   VARCHAR(100),
    cod_regional_ips_afiliado       SMALLINT,
    desc_regional_ips_afiliado      VARCHAR(60),

    -- Orden / Autorización
    numero_consec_orden_serie       VARCHAR(30),
    numero_consec_evento            INT,

    -- Prestación
    codigo_prestacion               VARCHAR(20),
    descripcion_prestacion          VARCHAR(200),
    agrup_salud_prest_desc          VARCHAR(100),
    orden_agrup_prest_desc          VARCHAR(100),

    -- Fechas
    periodo                         INT          NOT NULL,  -- CLAVE DE PARTICIÓN
    fecha_digitacion                DATE,
    fecha_emision                   DATE,
    fecha_atencion_ivr              TIMESTAMPTZ  NULL,
    fecha_programacion              DATE         NULL,
    fecha_atencion                  DATE         NULL,

    -- Diagnóstico
    codigo_diagnostico              VARCHAR(10),
    diagnostico_desc                VARCHAR(200),

    -- Sucursal que emite
    codigo_sucursal_emite           INT,
    descripcion_sucursal_emite      VARCHAR(100),

    -- Médico ordenador
    tipo_remite                     VARCHAR(5),
    numero_remite                   BIGINT,
    prestador_remite                VARCHAR(150),
    codigo_especialidad_remite      VARCHAR(20)  NULL,
    especialidad_desc_remite        VARCHAR(100) NULL,
    usuario_txt                     VARCHAR(20)  NULL,

    -- Datos del médico (enriquecidos desde BD profesionales)
    nombre_medico                   VARCHAR(150) NULL,
    estado_medico                   VARCHAR(20)  NULL,
    programa_especialidad           VARCHAR(100) NULL,
    area_medico                     VARCHAR(50)  NULL,

    -- Prestador que atiende
    codigo_sucursal_atiende         INT,
    descripcion_sucursal_atiende    VARCHAR(100),
    codigo_tipo_ident_atiende       VARCHAR(5),
    num_ident_prestador_atiende     BIGINT,
    descripcion_prestador_atiende   VARCHAR(150),

    -- Catálogos
    tipo_prestacion_desc            VARCHAR(100),
    origen_servicio_desc            VARCHAR(100),
    producto_pac_eps_desc           VARCHAR(100),
    estado_autorizacion_desc        VARCHAR(60),
    tipo_convenio_desc              VARCHAR(100),
    origen_autorizacion_desc        VARCHAR(100),
    tipo_evento_desc                VARCHAR(100),
    tipo_cobro_desc                 VARCHAR(100),

    -- Cantidad y valores
    cantidad_autorizada             SMALLINT,
    valor_autorizado_prestacion     NUMERIC(15,2) NULL,
    valor_provision                 NUMERIC(15,2) NULL,

    -- Auditoría
    archivo_fuente                  VARCHAR(255) NOT NULL,
    cargado_en                      TIMESTAMPTZ  DEFAULT NOW(),
    hash_fila                       CHAR(64)     NOT NULL,

    PRIMARY KEY (id, periodo)

) PARTITION BY RANGE (periodo);

-- Índice de deduplicación (por partición, incluye periodo para cumplir restricción de particionado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_autorizaciones_hash
    ON autorizaciones (hash_fila, periodo);

-- ─────────────────────────────────────────────
-- HECHOS: citas atendidas por médico/mes
-- Fuente: INFORME DE CITAS CONFIRMADAS POR MEDICO 2026.xlsx
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citas_atendidas (
    id              BIGSERIAL    PRIMARY KEY,
    documento       BIGINT       NOT NULL,
    nombre_medico   VARCHAR(150),
    tipo_medico     VARCHAR(30),
    especialidad    VARCHAR(100) NULL,
    periodo         INT          NOT NULL,
    cantidad_citas  INT          NOT NULL DEFAULT 0,
    UNIQUE (documento, periodo)
);

-- ─────────────────────────────────────────────
-- FUNCIÓN HELPER: crear partición de un periodo
-- Uso: SELECT crear_particion_autorizaciones(202602);
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_particion_autorizaciones(p_periodo INT)
RETURNS VOID AS $$
DECLARE
    v_nombre     TEXT;
    v_desde      INT;
    v_hasta      INT;
    v_anio       INT;
    v_mes        INT;
BEGIN
    v_nombre := 'autorizaciones_' || p_periodo::TEXT;
    v_desde  := p_periodo;
    -- calcular el periodo siguiente (mes siguiente)
    v_anio   := p_periodo / 100;
    v_mes    := p_periodo % 100;
    IF v_mes = 12 THEN
        v_hasta := (v_anio + 1) * 100 + 1;
    ELSE
        v_hasta := v_anio * 100 + (v_mes + 1);
    END IF;

    -- Solo crear si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = v_nombre AND n.nspname = 'public'
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF autorizaciones FOR VALUES FROM (%L) TO (%L)',
            v_nombre, v_desde, v_hasta
        );
        RAISE NOTICE 'Particion creada: %', v_nombre;
    ELSE
        RAISE NOTICE 'Particion ya existe: %', v_nombre;
    END IF;
END;
$$ LANGUAGE plpgsql;
