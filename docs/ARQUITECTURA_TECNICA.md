# Documentacion Tecnica — Sistema de Interconsultas IPS

**Version:** 1.0
**Fecha:** 2026-05-28
**Clasificacion:** Documento interno — Uso tecnico

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
   - 2.1 [Diagrama de Arquitectura](#21-diagrama-de-arquitectura)
   - 2.2 [Stack Tecnologico](#22-stack-tecnologico)
   - 2.3 [Estructura del Repositorio](#23-estructura-del-repositorio)
3. [Base de Datos](#3-base-de-datos)
   - 3.1 [Modelo Entidad-Relacion](#31-modelo-entidad-relacion)
   - 3.2 [Tablas Principales](#32-tablas-principales)
   - 3.3 [Particionamiento](#33-particionamiento)
   - 3.4 [Estrategia de Indexacion](#34-estrategia-de-indexacion)
   - 3.5 [Vistas Materializadas](#35-vistas-materializadas)
4. [Pipeline ETL](#4-pipeline-etl)
   - 4.1 [Flujo General](#41-flujo-general)
   - 4.2 [Etapas del Procesamiento](#42-etapas-del-procesamiento)
   - 4.3 [Estrategia de Deduplicacion](#43-estrategia-de-deduplicacion)
   - 4.4 [Cruce de Medicos](#44-cruce-de-medicos)
   - 4.5 [Interfaz CLI](#45-interfaz-cli)
5. [Dashboard Web](#5-dashboard-web)
   - 5.1 [Arquitectura Frontend](#51-arquitectura-frontend)
   - 5.2 [Sistema de Autenticacion](#52-sistema-de-autenticacion)
   - 5.3 [Sistema de Roles y Aislamiento Regional](#53-sistema-de-roles-y-aislamiento-regional)
   - 5.4 [API REST](#54-api-rest)
   - 5.5 [Modulo de Dashboard Analitico](#55-modulo-de-dashboard-analitico)
   - 5.6 [Modulo de Carga de Archivos](#56-modulo-de-carga-de-archivos)
   - 5.7 [Modulo de Administracion](#57-modulo-de-administracion)
   - 5.8 [Componentes de UI](#58-componentes-de-ui)
6. [Estrategia de Rendimiento](#6-estrategia-de-rendimiento)
   - 6.1 [Optimizacion de Consultas](#61-optimizacion-de-consultas)
   - 6.2 [Cache Multinivel](#62-cache-multinivel)
   - 6.3 [Filtros en Cascada](#63-filtros-en-cascada)
   - 6.4 [Pool de Conexiones](#64-pool-de-conexiones)
7. [Infraestructura y Despliegue](#7-infraestructura-y-despliegue)
   - 7.1 [Arquitectura Docker](#71-arquitectura-docker)
   - 7.2 [Dockerfile Multi-Stage](#72-dockerfile-multi-stage)
   - 7.3 [Orquestacion con Docker Compose](#73-orquestacion-con-docker-compose)
   - 7.4 [Inicializacion Automatica de BD](#74-inicializacion-automatica-de-bd)
   - 7.5 [Health Checks](#75-health-checks)
   - 7.6 [Volumenes y Persistencia](#76-volumenes-y-persistencia)
   - 7.7 [Entorno de Produccion](#77-entorno-de-produccion)
8. [Seguridad](#8-seguridad)
   - 8.1 [Autenticacion](#81-autenticacion)
   - 8.2 [Autorizacion por Roles](#82-autorizacion-por-roles)
   - 8.3 [Proteccion contra Inyeccion SQL](#83-proteccion-contra-inyeccion-sql)
   - 8.4 [Validacion de Entradas](#84-validacion-de-entradas)
   - 8.5 [Gestion de Secretos](#85-gestion-de-secretos)
9. [Testing](#9-testing)
   - 9.1 [Tests del ETL (Python)](#91-tests-del-etl-python)
   - 9.2 [Tests del Dashboard (TypeScript)](#92-tests-del-dashboard-typescript)
10. [Monitoreo y Observabilidad](#10-monitoreo-y-observabilidad)
11. [Guia de Despliegue en DigitalOcean](#11-guia-de-despliegue-en-digitalocean)
12. [Glosario](#12-glosario)

---

## 1. Resumen Ejecutivo

El Sistema de Interconsultas es una plataforma de gestion y analisis de autorizaciones medicas desarrollada para IPS Manizales. Permite la carga masiva de archivos Excel provenientes de la EPS, su procesamiento automatizado mediante un pipeline ETL, y la visualizacion analitica en tiempo real a traves de un dashboard web interactivo.

**Capacidades principales:**

- Carga y validacion automatizada de archivos de autorizaciones (Excel .xlsx)
- Deduplicacion inteligente a nivel de archivo y registro individual
- Enriquecimiento de datos con catalogo de profesionales medicos
- Dashboard analitico con filtros multidimensionales en cascada
- Vistas especializadas por tipo de prestacion (laboratorios, RX, ecografias, medicamentos, remisiones, procedimientos)
- Exportacion de datos filtrados a CSV
- Gestion de usuarios con control de acceso basado en roles (RBAC)
- Aislamiento de datos por regional para coordinadores

**Metricas del sistema:**

| Metrica | Valor |
|---------|-------|
| Tabla principal (autorizaciones) | Particionada por periodo (YYYYMM) |
| Vistas materializadas | 8 (1 general + 7 por tipo de prestacion) |
| Indices en tabla de hechos | 10 compuestos + deduplicacion |
| Columnas por registro | 68 campos normalizados |
| Tests automatizados (ETL) | 101 |
| Tests automatizados (Dashboard) | 101 |
| Endpoints API | 14 |

---

## 2. Arquitectura del Sistema

### 2.1 Diagrama de Arquitectura

```
                    +--------------------------------------------------+
                    |              DROPLET DIGITALOCEAN                 |
                    |              Docker Compose                       |
                    |                                                  |
  Usuario Web      |  +-------------------+    +-------------------+  |
  (Navegador)  <----->|    Dashboard       |    |   PostgreSQL 16   |  |
       |           |  |    (Next.js 14)    |--->|                   |  |
       |           |  |    + Python 3.12   |    |  - autorizaciones |  |
       |           |  |                    |    |    (particionada) |  |
  .xlsx upload     |  |  Puerto 3000       |    |  - 8 mat. views  |  |
       |           |  |                    |    |  - 10+ indices    |  |
       v           |  +--------+-----------+    +-------------------+  |
  +----------+     |           |                        ^              |
  | Archivo  |---->|     child_process.spawn()          |              |
  | Excel    |     |           |                        |              |
  +----------+     |           v                        |              |
                    |  +-------------------+            |              |
                    |  |   ETL Python      |------------+              |
                    |  |   (pandas + psycopg2)                        |
                    |  |                    |                          |
                    |  +-------------------+                          |
                    +--------------------------------------------------+

                    Volumenes Docker:
                    - pgdata    (datos PostgreSQL)
                    - uploads   (archivos temporales)
                    - logs      (logs del ETL)
```

**Flujo de datos:**

1. El usuario sube un archivo `.xlsx` a traves del dashboard web
2. El servidor Next.js guarda el archivo en disco y lanza el ETL Python como proceso hijo (`child_process.spawn`)
3. El ETL lee el Excel, valida, normaliza, deduplica y carga los datos en PostgreSQL
4. Las vistas materializadas se refrescan para reflejar los nuevos datos
5. El dashboard consulta las vistas materializadas para renderizar graficas y metricas

### 2.2 Stack Tecnologico

| Capa | Tecnologia | Version | Proposito |
|------|-----------|---------|-----------|
| **Frontend** | Next.js (App Router) | 14.2.x | Framework React con SSR/CSR |
| **Estilos** | Tailwind CSS | 3.4.x | Sistema de utilidades CSS |
| **Graficas** | Recharts | 3.8.x | Libreria de visualizacion |
| **Fetching** | SWR | 2.4.x | Cache y revalidacion cliente |
| **Autenticacion** | NextAuth.js v5 beta | 5.0.0-beta.31 | Sesiones JWT, Credentials provider |
| **Hashing** | bcryptjs | 3.0.x | Hash de contrasenas (cost 12) |
| **Base de datos** | PostgreSQL | 16 (Alpine) | Motor relacional con particionamiento |
| **Driver BD (Node)** | pg | 8.20.x | Pool de conexiones Node.js |
| **ETL** | Python | 3.12 | Pipeline de procesamiento |
| **DataFrames** | pandas | 3.0.2 | Manipulacion tabular |
| **Excel** | openpyxl + calamine | 3.1.5 / 0.6.2 | Lectura de archivos .xlsx |
| **Driver BD (Python)** | psycopg2-binary | 2.9.12 | Conexion PostgreSQL |
| **Hashing (Python)** | hashlib (stdlib) | - | SHA-256 para deduplicacion |
| **Contenedores** | Docker + Compose | - | Empaquetado y orquestacion |
| **Runtime** | Node.js | 20 (Alpine) | Servidor de aplicacion |
| **Tests (Python)** | pytest | 9.0.3 | Suite de pruebas unitarias |
| **Tests (JS)** | Jest + Testing Library | 30.x | Suite de pruebas frontend |

### 2.3 Estructura del Repositorio

```
interconsultas/
|
|-- dashboard/                    # Aplicacion web Next.js
|   |-- src/
|   |   |-- app/                  # App Router (paginas y API routes)
|   |   |   |-- api/              # 14 endpoints REST
|   |   |   |   |-- auth/         # NextAuth callbacks
|   |   |   |   |-- health/       # Health check
|   |   |   |   |-- dashboard/    # Filtros y exportacion
|   |   |   |   |-- carga/        # Upload, validacion, confirmacion
|   |   |   |   |-- admin/        # CRUD usuarios y medicos
|   |   |   |-- dashboard/        # Paginas del dashboard analitico
|   |   |   |   |-- tipo/[slug]/  # Vistas por tipo de prestacion
|   |   |   |-- admin/            # Paginas de administracion
|   |   |   |-- login/            # Pagina de inicio de sesion
|   |   |-- components/           # Componentes React reutilizables
|   |   |   |-- layout/           # AppShell, Sidebar
|   |   |   |-- dashboard/        # DashboardView, TendenciaMensual, TopProfesionales
|   |   |   |-- carga/            # DropzoneArchivo, InformeValidacion, ListaArchivos
|   |   |   |-- ui/               # Badge, Spinner, Semaforo, CheckDropdown, SkeletonCard
|   |   |-- lib/                  # Utilidades del servidor
|   |   |   |-- db.ts             # Pool de conexiones PostgreSQL
|   |   |   |-- auth.ts           # Configuracion NextAuth (Node runtime)
|   |   |   |-- auth.config.ts    # Configuracion auth (Edge runtime)
|   |   |   |-- cache.ts          # Cache en memoria con TTL
|   |   |   |-- dashboard-filters.ts  # Query builder parametrizado
|   |   |   |-- view-registry.ts  # Registro de vistas y filtros default
|   |   |   |-- middleware-roles.ts   # Middleware de roles y regional
|   |   |   |-- etl-spawn.ts      # Lanzador de procesos ETL
|   |   |   |-- fetcher.ts        # Fetcher para SWR
|   |   |   |-- estado.ts         # Helper de etiquetas de estado
|   |   |-- hooks/                # Custom hooks
|   |   |   |-- useDebouncedValue.ts
|   |   |-- types/                # Definiciones TypeScript
|   |   |   |-- carga.ts          # Tipos del modulo de carga
|   |   |-- middleware.ts         # Middleware de autenticacion (Edge)
|   |   |-- __tests__/            # Tests unitarios
|   |-- next.config.mjs           # Configuracion Next.js (standalone)
|   |-- tailwind.config.ts        # Configuracion Tailwind
|   |-- jest.config.ts            # Configuracion Jest
|   |-- package.json
|
|-- etl/                          # Pipeline ETL en Python
|   |-- etl_autorizaciones.py     # Script principal (1,136 lineas)
|   |-- config.py                 # Configuracion de BD
|   |-- utils/
|   |   |-- validators.py         # Validacion de columnas Excel
|   |   |-- dedup.py              # Hashing SHA-256 (archivo + filas)
|   |   |-- reporters.py          # Generacion de informes JSON
|   |-- sql/                      # Migraciones SQL
|   |   |-- 001_create_tables.sql
|   |   |-- 002_create_indexes.sql
|   |   |-- 003_create_views.sql
|   |   |-- 004_seed_usuarios.sql
|   |   |-- 005_estado_medico_null_to_externo.sql
|   |   |-- 006_create_subviews.sql
|   |   |-- 007_refresh_views.sql
|   |-- tests/                    # Tests pytest
|   |-- requirements.txt
|   |-- .env.example
|
|-- docker/
|   |-- init-db.sh                # Script de inicializacion de BD
|
|-- Dockerfile                    # Build multi-stage (Node + Python)
|-- docker-compose.yml            # Orquestacion de servicios
|-- .env.production.example       # Template de variables de produccion
|-- .gitignore
|-- .dockerignore
|-- CLAUDE.md                     # Contexto para desarrollo asistido
```

---

## 3. Base de Datos

### 3.1 Modelo Entidad-Relacion

```
+------------------+     +-------------------+     +---------------------+
|    usuarios      |     |     medicos       |     |   citas_atendidas   |
|------------------|     |-------------------|     |---------------------|
| id (PK)          |     | usuario_txt (PK)  |<----| documento           |
| email (UQ)       |     | identificacion(UQ)|     | nombre_medico       |
| password_hash    |     | nombre            |     | tipo_medico         |
| nombre           |     | estado            |     | especialidad        |
| rol              |     | programa_esp.     |     | periodo             |
| regional         |     | area              |     | cantidad_citas      |
| activo           |     +-------------------+     +---------------------+
| last_login       |             |
+------------------+             | (enriquecimiento ETL)
                                 v
+------------------+     +-------------------------------+
|   log_cargas     |     |       autorizaciones          |
|------------------|     |     (PARTITIONED BY RANGE)     |
| id (PK)          |     |-------------------------------|
| job_id (UQ, UUID)|---->| id                            |
| nombre_archivo   |     | periodo (partition key)       |
| hash_archivo     |     | -- 15 campos afiliado --      |
| periodo_detectado|     | -- 4 campos orden --          |
| filas_en_archivo |     | -- 6 campos fecha --          |
| filas_validas    |     | -- 6 campos medico --         |
| filas_insertadas |     | -- 5 campos prestador --      |
| filas_duplicadas |     | -- 8 campos catalogo --       |
| filas_con_error  |     | -- 3 campos valores --        |
| medicos_no_enc.  |     | archivo_fuente                |
| distribucion_est.|     | hash_fila (UQ con periodo)    |
| estado           |     | cargado_en                    |
| error_mensaje    |     +-------------------------------+
| cargado_por      |             |
| tiempo_segundos  |             | (particiones automaticas)
+------------------+             v
                         +--------------------+
        +----------------| autorizaciones_    |
        |                | 202601             |
        |                +--------------------+
        |                +--------------------+
        +----------------| autorizaciones_    |
        |                | 202602             |
        |                +--------------------+
        |                +--------------------+
        +----------------| autorizaciones_    |
                         | ...YYYYMM         |
                         +--------------------+

+------------------+
|     metas        |
|------------------|      +-------------------------------+
| id (PK)          |      | staging_autorizaciones        |
| anio             |      |-------------------------------|
| programa         |      | (misma estructura que         |
| tipo_prestacion  |      |  autorizaciones, sin UQ)      |
| valor_meta       |      | + job_id (FK logica)          |
| escala           |      +-------------------------------+
| activo           |
+------------------+
```

### 3.2 Tablas Principales

#### `autorizaciones` — Tabla de Hechos (Particionada)

Tabla central del sistema. Almacena cada registro de autorizacion medica procesado por el ETL. Contiene **68 columnas** organizadas en bloques semanticos:

| Bloque | Columnas | Descripcion |
|--------|----------|-------------|
| Afiliado | 18 | Datos del paciente: documento, nombre, edad, regional, sexo, nivel de ingreso, sucursal |
| Orden | 2 | Numero de serie y evento de la autorizacion |
| Prestacion | 4 | Codigo, descripcion, agrupacion de salud, orden de agrupacion |
| Fechas | 6 | Periodo (clave de particion), digitacion, emision, atencion IVR, programacion, atencion |
| Diagnostico | 2 | Codigo CIE-10 y descripcion |
| Sucursal emisora | 2 | Codigo y descripcion de la sucursal que emite |
| Medico ordenador | 6 | Tipo, numero, nombre prestador, especialidad, usuario_txt |
| Datos del medico | 4 | Nombre, estado, programa/especialidad, area (enriquecidos desde catalogo) |
| Prestador atendido | 5 | Codigo, descripcion, tipo de identificacion del prestador que atiende |
| Catalogos | 8 | Tipo prestacion, origen servicio, producto, estado autorizacion, tipo convenio, origen autorizacion, tipo evento, tipo cobro |
| Valores | 3 | Cantidad autorizada, valor autorizado, valor provision |
| Auditoria | 3 | Archivo fuente, fecha de carga, hash de fila |

**Restricciones:**
- `PRIMARY KEY (id, periodo)` — necesario para particionamiento
- `UNIQUE INDEX (hash_fila, periodo)` — deduplicacion a nivel de fila

#### `medicos` — Catalogo de Profesionales

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| usuario_txt | VARCHAR(20) PK | Identificador en sistema de turnos |
| identificacion | BIGINT UQ | Cedula del profesional |
| nombre | VARCHAR(150) | Nombre completo |
| estado | VARCHAR(20) | ACTIVO / INACTIVO |
| programa_especialidad | VARCHAR(100) | Especialidad o programa asignado |
| area | VARCHAR(50) | Area funcional (MEDICINA, SALUD ORAL, etc.) |

#### `usuarios` — Usuarios del Dashboard

| Columna | Tipo | Restriccion |
|---------|------|------------|
| id | BIGSERIAL | PK |
| email | VARCHAR(150) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | bcrypt cost 12 |
| rol | VARCHAR(30) | CHECK: admin, direccion_medica, coordinador |
| regional | VARCHAR(60) | Solo para coordinadores |
| activo | BOOLEAN | Soft delete |
| last_login | TIMESTAMPTZ | Se actualiza en cada login exitoso |

#### `log_cargas` — Registro de Procesamiento ETL

Tabla de auditoria que registra cada ejecucion del ETL. Contiene campos JSONB para datos estructurados:

| Campo clave | Tipo | Contenido |
|-------------|------|-----------|
| job_id | UUID | Identificador unico de la carga |
| hash_archivo | CHAR(64) | SHA-256 del binario del archivo |
| medicos_no_encontrados | JSONB | Lista de prestadores sin match en catalogo |
| distribucion_estados | JSONB | Distribucion porcentual por estado |
| columnas_faltantes | JSONB | Columnas que no estaban en el archivo |
| estado | VARCHAR(30) | Estado actual del job (maquina de estados) |

**Maquina de estados del job:**

```
procesando --> previsualizando --> esperando_confirmacion --> cargando --> exitoso
                                                                     --> exitoso_con_advertencias
                                       --> cancelado
         --> error_fatal
         --> ya_procesado (archivo duplicado)
```

#### `staging_autorizaciones` — Area de Previsualizacion

Replica la estructura de `autorizaciones` sin restricciones UNIQUE. Se usa como buffer temporal:
- El ETL carga aqui los datos validados durante la fase de preview
- El usuario revisa el informe de validacion en el dashboard
- Al confirmar, los registros migran a `autorizaciones`
- Al cancelar, se eliminan

#### `metas` — Tasas Objetivo por Programa

Almacena las metas de tasas de uso de servicios definidas por la direccion medica. Editables desde el frontend.

### 3.3 Particionamiento

La tabla `autorizaciones` usa **particionamiento declarativo por rango** sobre la columna `periodo` (formato YYYYMM):

```sql
CREATE TABLE autorizaciones (
    ...
    periodo INT NOT NULL,
    ...
    PRIMARY KEY (id, periodo)
) PARTITION BY RANGE (periodo);
```

**Creacion automatica de particiones:**

La funcion PL/pgSQL `crear_particion_autorizaciones(p_periodo)` crea particiones bajo demanda durante la carga ETL:

```sql
-- Ejemplo: crea autorizaciones_202603 para [202603, 202604)
SELECT crear_particion_autorizaciones(202603);
```

**Beneficios para el rendimiento:**

| Beneficio | Impacto |
|-----------|---------|
| **Partition pruning** | Las consultas con filtro `WHERE periodo BETWEEN x AND y` solo escanean las particiones relevantes |
| **Indices locales** | Cada particion tiene sus propios indices, mas pequenos y eficientes |
| **Mantenimiento** | Se pueden eliminar periodos antiguos con `DROP TABLE autorizaciones_YYYYMM` sin bloquear la tabla completa |
| **Vacuum** | El autovacuum opera por particion, reduciendo el impacto en concurrencia |
| **Carga paralela** | Multiples periodos pueden cargarse simultaneamente sin contencion de locks |

### 3.4 Estrategia de Indexacion

Se implementaron **14 indices** optimizados para los patrones de consulta del dashboard:

#### Indices sobre `autorizaciones` (propagados a particiones)

| # | Indice | Columnas | Patron de consulta |
|---|--------|----------|-------------------|
| 1 | idx_medico_periodo | (usuario_txt, periodo) | Filtro principal: autorizaciones por medico y periodo |
| 2 | idx_periodo_tipo | (periodo, tipo_prestacion_desc) | Distribucion por tipo de prestacion |
| 3 | idx_ips_atiende_periodo | (descripcion_prestador_atiende, periodo) | Analisis por IPS prestadora |
| 4 | idx_diagnostico_periodo | (codigo_diagnostico, periodo) | Analisis por diagnostico CIE-10 |
| 5 | idx_regional_periodo_tipo | (desc_regional_afiliado, periodo, tipo_prestacion_desc) | Vista ejecutiva regional (3 columnas) |
| 6 | idx_estado_periodo | (estado_autorizacion_desc, periodo) | Seguimiento por estado de autorizacion |
| 7 | idx_programa_periodo | (programa_especialidad, periodo) | Analisis por programa/especialidad |
| 8 | idx_tipo_convenio_agrup | (tipo_convenio_desc, agrup_salud_prest_desc, orden_agrup_prest_desc) | Filtros de negocio combinados (3 columnas) |
| 9 | idx_orden_agrup_periodo | (orden_agrup_prest_desc, periodo) | Filtro por orden de agrupacion |
| 10 | idx_agrup_salud_periodo | (agrup_salud_prest_desc, periodo) | Filtro por agrupacion de salud |

#### Indice de deduplicacion

```sql
CREATE UNIQUE INDEX idx_autorizaciones_hash
    ON autorizaciones (hash_fila, periodo);
```

Garantiza que no existan registros duplicados dentro del mismo periodo. El hash SHA-256 se calcula sobre 4 columnas clave: `Numero_Consec_Orden_Serie`, `Numero_Consec_Evento`, `CODIGO_PRESTACION_OP`, `PERIODO`.

#### Indices auxiliares

- `idx_citas_documento_periodo` / `idx_citas_periodo` en `citas_atendidas`
- `idx_log_cargas_job_id` / `idx_log_cargas_estado` en `log_cargas`
- `idx_staging_job_id` en `staging_autorizaciones`

### 3.5 Vistas Materializadas

Las vistas materializadas son el pilar fundamental de la estrategia de rendimiento. Pre-agregan los datos de la tabla `autorizaciones` para que las consultas del dashboard operen sobre conjuntos reducidos.

#### Vista general: `vm_filtros_dashboard`

Pre-agrega TODAS las dimensiones de filtro con 3 metricas:

```
SELECT
    periodo, estado_medico, nombre_medico, programa_especialidad,
    tipo_convenio_desc, orden_agrup_prest_desc, agrup_salud_prest_desc,
    diagnostico_desc, descripcion_prestacion, estado_autorizacion_desc,
    desc_regional_afiliado, usuario_txt,
    COUNT(*)                         AS total_autorizaciones,
    SUM(valor_autorizado_prestacion) AS valor_total,
    SUM(cantidad_autorizada)         AS total_cantidad
FROM autorizaciones
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12
```

**Indices sobre la vista:**

| Indice | Columnas | Proposito |
|--------|----------|-----------|
| idx_vm_filtros_uq (UNIQUE) | 12 columnas | Requerido por `REFRESH CONCURRENTLY` |
| idx_vm_filtros_periodo | periodo | Filtro rapido por rango temporal |
| idx_vm_filtros_estado_medico | estado_medico | Filtro por estado del profesional |
| idx_vm_filtros_nombre_medico | nombre_medico | Busqueda por nombre |
| idx_vm_filtros_programa | programa_especialidad | Filtro por especialidad |
| idx_vm_filtros_tipo_convenio | tipo_convenio_desc | Filtro por tipo de convenio |
| idx_vm_filtros_diagnostico | diagnostico_desc | Filtro por diagnostico |
| idx_vm_filtros_prestacion | descripcion_prestacion | Filtro por prestacion |
| idx_vm_filtros_regional | desc_regional_afiliado | Filtro por regional |
| idx_vm_filtros_periodo_estado | (periodo, estado_medico) | Filtro combinado |
| idx_vm_filtros_periodo_diag | (periodo, diagnostico_desc) | Filtro combinado |
| idx_vm_filtros_periodo_nombre | (periodo, nombre_medico) | Filtro combinado |
| idx_vm_filtros_regional_periodo | (desc_regional_afiliado, periodo) | Filtro combinado |

#### 7 Subvistas por tipo de prestacion

Cada subvista aplica las condiciones fijas del tipo de prestacion directamente en el WHERE, reduciendo drasticamente el volumen de datos:

| Vista | Condicion de filtro | Caso de uso |
|-------|-------------------|-------------|
| `vm_dash_laboratorios` | CAPITADO + (LABORATORIO CLINICO o ACT Y PROCEDIMIENTOS OTROS POS) + PROCEDIMIENTOS DIAGNOSTICOS | Dashboard de laboratorios |
| `vm_dash_rx` | RADIOLOGIA + PROCEDIMIENTOS DIAGNOSTICOS | Dashboard de radiologia |
| `vm_dash_ecografias` | CAPITADO + ECOGRAFIA + PROCEDIMIENTOS DIAGNOSTICOS | Dashboard de ecografias |
| `vm_dash_remisiones_cap` | CAPITADO + 8 tipos de consulta + 2 agrupaciones | Dashboard de remisiones capitadas |
| `vm_dash_medicamentos` | Excluye PROGRAMAS ESPECIALES + 2 agrupaciones de medicamentos | Dashboard de medicamentos |
| `vm_dash_remisiones_ext` | 8 tipos de consulta + 2 agrupaciones (sin filtro de convenio) | Dashboard de red externa |
| `vm_dash_proc_dx` | ACTIVIDAD/VALOR AGREGADO/COMPRAS POR VOLUMEN + 3 agrupaciones diagnosticas | Dashboard de procedimientos Dx |

Cada subvista tiene 3 indices:
1. **UNIQUE** (12 columnas) — para `REFRESH CONCURRENTLY`
2. **periodo** — para filtro temporal
3. **(periodo, estado_medico)** — para filtro combinado mas frecuente

#### Refresco de vistas

Las vistas se refrescan con `REFRESH MATERIALIZED VIEW CONCURRENTLY` despues de cada carga exitosa. La opcion `CONCURRENTLY` permite que el dashboard siga consultando la version anterior mientras se actualiza.

```sql
-- Ejecutado automaticamente por el ETL al confirmar una carga
REFRESH MATERIALIZED VIEW CONCURRENTLY vm_filtros_dashboard;
REFRESH MATERIALIZED VIEW CONCURRENTLY vm_dash_laboratorios;
-- ... (8 vistas en total)
```

---

## 4. Pipeline ETL

### 4.1 Flujo General

```
+----------+     +-----------+     +-----------+     +----------+     +------------+
| Recibir  |---->| Validar   |---->| Limpiar y |---->| Cruzar   |---->| Cargar en  |
| archivo  |     | estructura|     | normalizar|     | medicos  |     | staging    |
| .xlsx    |     | columnas  |     | datos     |     |          |     |            |
+----------+     +-----------+     +-----------+     +----------+     +-----+------+
                                                                            |
                      +------------+     +-----------+     +----------+     |
                      | Refrescar  |<----| Mover a   |<----| Usuario  |<----+
                      | vistas     |     | autori-   |     | confirma |
                      | material.  |     | zaciones  |     | en UI    |
                      +------------+     +-----------+     +----------+
```

### 4.2 Etapas del Procesamiento

#### Etapa 1: Recepcion y validacion

| Paso | Accion | Detalle |
|------|--------|---------|
| 1.1 | Detectar periodo | Extrae YYYYMM del nombre del archivo via regex |
| 1.2 | Hash del archivo | SHA-256 del binario completo (bloques de 64KB) |
| 1.3 | Verificar duplicado | Compara hash contra `log_cargas.hash_archivo` |
| 1.4 | Validar columnas | Verifica presencia de 56 columnas requeridas |
| 1.5 | Eliminar columnas sobrantes | Descarta 23 columnas de metadata innecesarias |

**56 columnas requeridas:** Afiliado_Id, NUMERO_DE_DOCUMENTO, Fecha_Emision, PERIODO, USUARIO_TXT, Numero_Consec_Orden_Serie, CODIGO_PRESTACION_OP, entre otras.

**23 columnas eliminadas:** Codigos redundantes con sus descripciones (CODIGO_TIPO_PRESTACION cuando ya existe Tipo_Prestacion_Desc, etc.).

#### Etapa 2: Limpieza y normalizacion

| Paso | Accion | Detalle |
|------|--------|---------|
| 2.1 | Filtrar sucursal | Solo conserva registros de sucursal 1712 (IPS Manizales) |
| 2.2 | Normalizar texto | `.str.strip().str.upper()` en campos de texto |
| 2.3 | Parsear fechas | Funcion robusta que soporta: seriales Excel, ISO 8601, DD/MM/YYYY |
| 2.4 | Parsear valores | Conversion de float/int con soporte de locale |
| 2.5 | Calcular hash de filas | SHA-256 de (orden_serie + evento + prestacion + periodo) |

**Parser de fechas robusto:**

La funcion `_parsear_fecha()` maneja tres formatos de entrada:
- **Seriales Excel** (ej: 45731 = 2025-03-15): Conversion desde epoch de Excel (1899-12-30)
- **ISO 8601** (ej: 2025-03-15T00:00:00): Parse directo con `pd.to_datetime`
- **DD/MM/YYYY** (ej: 15/03/2025): Parse con `dayfirst=True`

Incluye validacion de rango: rechaza fechas anteriores a 1900 o posteriores a 2100.

#### Etapa 3: Cruce con catalogo de medicos

Enriquece cada registro con datos del profesional que ordeno la autorizacion:

1. Carga el catalogo `medicos` en dos diccionarios en memoria:
   - `catalogo_nombre`: indexado por nombre normalizado (UPPER + STRIP)
   - `catalogo_usuario`: indexado por `usuario_txt`
2. Resuelve el medico: primero intenta por `USUARIO_TXT`, luego por `PRESTADOR_REMITE`
3. Agrega 4 columnas: `nombre_medico`, `estado_medico`, `programa_especialidad`, `area_medico`
4. Registra medicos no encontrados (excluye usuarios especiales: AUTNOPOS, MASIVO)
5. Asigna `EXTERNO` a registros sin match

#### Etapa 4: Carga en staging

- Renombra 131 columnas del formato EPS al formato snake_case de la BD
- Inserta en lotes de 5,000 filas usando `psycopg2.extras.execute_values`
- Registra el job en `log_cargas` con estado `esperando_confirmacion`

#### Etapa 5: Confirmacion y carga definitiva

Al recibir confirmacion del usuario:
1. Verifica que el job existe y esta en estado `esperando_confirmacion`
2. Crea particion(es) para el periodo detectado
3. Mueve registros de staging a autorizaciones con `ON CONFLICT (hash_fila, periodo) DO NOTHING`
4. Contabiliza insertados vs. duplicados
5. Limpia staging
6. Refresca las 8 vistas materializadas
7. Actualiza `log_cargas` con metricas finales

### 4.3 Estrategia de Deduplicacion

El sistema implementa deduplicacion en dos niveles:

**Nivel 1 — Archivo completo:**

```python
hash_archivo(ruta)  # SHA-256 del binario, bloques de 64KB
```

Si el hash ya existe en `log_cargas.hash_archivo`, el archivo se rechaza como `ya_procesado` (salvo que se use `--force`).

**Nivel 2 — Registro individual:**

```python
calcular_hash_filas(df)  # SHA-256 por fila
# Columnas hasheadas: Numero_Consec_Orden_Serie | Numero_Consec_Evento |
#                     CODIGO_PRESTACION_OP | PERIODO
```

El hash de fila se almacena en `autorizaciones.hash_fila` con restriccion UNIQUE por periodo. Al insertar, `ON CONFLICT DO NOTHING` descarta silenciosamente duplicados.

**Optimizacion:** El calculo de hashes usa operaciones vectorizadas de numpy (~3x mas rapido que `df.apply()` fila por fila).

### 4.4 Cruce de Medicos

```
Archivo Excel                  Catalogo medicos (en memoria)
+-----------------+            +-------------------+
| USUARIO_TXT     |---match--->| catalogo_usuario  |
| PRESTADOR_REMITE|            | (dict por usr_txt)|
+-----------------+            +-------------------+
        |                              |
        | (fallback si no hay match)   |
        v                              v
+-----------------+            +-------------------+
| PRESTADOR_REMITE|---match--->| catalogo_nombre   |
| (normalizado)   |            | (dict por nombre) |
+-----------------+            +-------------------+
        |
        v
  Si match encontrado:
    estado_medico = catalogo.estado
    programa_especialidad = catalogo.programa
    area_medico = catalogo.area

  Si NO match y NO es especial (AUTNOPOS, MASIVO):
    estado_medico = "EXTERNO"
    -> Se registra en medicos_no_encontrados
```

### 4.5 Interfaz CLI

```bash
# Modo preview: valida y carga en staging
python etl_autorizaciones.py \
    --preview \
    --archivo "ruta/al/archivo.xlsx" \
    [--periodo 202603] \
    [--force] \
    [--usuario usuario@dominio.com] \
    [--job-id UUID]

# Modo confirmacion: mueve staging a produccion
python etl_autorizaciones.py --confirm <job_id>

# Modo directo: preview + confirm atomico (CLI)
python etl_autorizaciones.py \
    --directo \
    --archivo "ruta/al/archivo.xlsx" \
    [--periodo 202603] \
    [--force]
```

| Flag | Descripcion |
|------|-------------|
| `--preview` | Ejecuta validacion y carga en staging sin confirmar |
| `--confirm` | Confirma un job existente y mueve datos a produccion |
| `--directo` | Ejecuta preview + confirm de forma atomica |
| `--archivo` | Ruta al archivo .xlsx a procesar |
| `--periodo` | Fuerza un periodo especifico (YYYYMM) |
| `--force` | Ignora la verificacion de archivo duplicado |
| `--usuario` | Email del usuario que realiza la carga (auditoria) |
| `--job-id` | UUID pre-asignado por el dashboard |

---

## 5. Dashboard Web

### 5.1 Arquitectura Frontend

El dashboard esta construido con **Next.js 14 App Router**, combinando componentes de servidor (layouts, paginas iniciales) con componentes de cliente (interactividad, SWR, estado).

**Patron de renderizado:**

| Componente | Tipo | Razon |
|------------|------|-------|
| Layouts (root, admin, dashboard) | Server Component | No requieren interactividad |
| Login page | Client Component | Formulario con estado |
| Dashboard pages | Client Component | Filtros interactivos, SWR |
| Admin pages | Client Component | CRUD con formularios |
| API routes | Server-side (Node) | Acceso a BD y procesos |

**Flujo de datos cliente:**

```
Componente                SWR                 API Route           PostgreSQL
+-------------+     +-----------+     +----------------+     +-----------+
| DashboardView|---->| useSWR    |---->| POST /api/     |---->| Vistas    |
| (estado local|     | (cache +  |     | dashboard/     |     | material. |
|  useReducer) |     |  revalid) |     | filtros        |     |           |
+-------------+     +-----------+     +----------------+     +-----------+
                          |
                    Cache SWR (cliente)
                    + Cache in-memory (servidor, 5min TTL)
                    + Cache HTTP (max-age=60, stale-while-revalidate=120)
```

### 5.2 Sistema de Autenticacion

**Tecnologia:** NextAuth.js v5 beta con Credentials provider y sesiones JWT.

**Flujo de login:**

```
1. GET /login
   |
2. Usuario envia email + password
   |
3. NextAuth.authorize()
   |-- Rate limiting: 5 intentos / 15 min por email (Map en memoria)
   |-- Query: SELECT * FROM usuarios WHERE email = $1 AND activo = true
   |-- bcrypt.compare(password, password_hash) con cost factor 12
   |-- Si exitoso: limpia rate limit, UPDATE last_login
   |
4. JWT creado con: { id, email, name, rol, regional }
   |
5. Cookie de sesion establecida
   |
6. Redirect a /admin/carga
```

**Separacion Edge / Node:**

- `auth.config.ts` — Configuracion compatible con Edge Runtime (sin crypto de Node.js). Se usa en el middleware para validar sesiones.
- `auth.ts` — Configuracion completa con bcryptjs (requiere Node.js runtime). Se usa en los API routes para login y verificacion de password.

### 5.3 Sistema de Roles y Aislamiento Regional

**3 roles con permisos diferenciados:**

| Permiso | admin | direccion_medica | coordinador |
|---------|:-----:|:----------------:|:-----------:|
| Ver dashboard | Si | Si | Si (filtrado) |
| Exportar CSV | Si | Si | Si (filtrado) |
| Cargar archivos | Si | No | No |
| Gestionar usuarios | Si | No | No |
| Ver profesionales | Si | Si | No |
| Gestionar profesionales | Si | No | No |

**Aislamiento regional para coordinadores:**

Los coordinadores solo ven datos de su regional asignada. Esto se implementa como un filtro transparente inyectado en todas las consultas:

```typescript
// middleware-roles.ts
export function regionalClause(user, paramIndex, tableAlias) {
    if (user.rol === "coordinador" && user.regional) {
        return {
            clause: `AND ${tableAlias}.desc_regional_afiliado = $${paramIndex}`,
            params: [user.regional]
        };
    }
    return { clause: "", params: [] };
}
```

**Regionales disponibles:** MANIZALES, VILLAMARIA, CHINCHINA, PALESTINA, NEIRA, LA DORADA.

### 5.4 API REST

#### Endpoints del Dashboard

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| POST | `/api/dashboard/filtros` | admin, direccion_medica, coordinador | Obtener datos filtrados del dashboard (KPIs, series, top 10, opciones) |
| POST | `/api/dashboard/export` | admin, direccion_medica, coordinador | Exportar datos filtrados como CSV (max 500K filas) |

#### Endpoints de Carga

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| POST | `/api/carga/upload` | admin | Subir archivo .xlsx e iniciar ETL preview |
| GET | `/api/carga/validacion/[jobId]` | admin | Consultar estado y reporte de validacion |
| POST | `/api/carga/confirm/[jobId]` | admin | Confirmar carga definitiva |
| POST | `/api/carga/cancel/[jobId]` | admin | Cancelar carga en proceso |
| GET | `/api/carga/historial` | admin | Listar ultimas 50 cargas |

#### Endpoints de Administracion

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/api/admin/usuarios` | admin | Listar usuarios |
| POST | `/api/admin/usuarios` | admin | Crear usuario |
| PATCH | `/api/admin/usuarios/[id]` | admin | Editar usuario |
| DELETE | `/api/admin/usuarios/[id]` | admin | Desactivar usuario (soft delete) |
| GET | `/api/admin/medicos` | admin, direccion_medica | Listar profesionales |
| POST | `/api/admin/medicos` | admin | Crear profesional |
| PATCH | `/api/admin/medicos/[id]` | admin | Editar profesional |
| DELETE | `/api/admin/medicos/[id]` | admin | Eliminar profesional |

#### Endpoints de Sistema

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check (SELECT 1 a PostgreSQL) |
| * | `/api/auth/[...nextauth]` | No | Callbacks de NextAuth.js |

### 5.5 Modulo de Dashboard Analitico

El modulo de dashboard es el componente principal de visualizacion. Se accede desde `/dashboard` (vista general) o `/dashboard/tipo/[slug]` (vista por tipo de prestacion).

**8 vistas disponibles:**

| Slug | Vista BD | Titulo |
|------|----------|--------|
| (raiz) | vm_filtros_dashboard | Dashboard General |
| laboratorios | vm_dash_laboratorios | Laboratorios |
| rx | vm_dash_rx | RX |
| ecografias-capitadas | vm_dash_ecografias | Ecografias Capitadas |
| remisiones-capitadas | vm_dash_remisiones_cap | Remisiones Capitadas |
| medicamentos | vm_dash_medicamentos | Medicamentos |
| remisiones-red-externa | vm_dash_remisiones_ext | Remisiones Red Externa |
| procedimientos-dx-no-capitados | vm_dash_proc_dx | Procedimientos Dx No Capitados |

**Componente `DashboardView`:**

Componente principal que maneja toda la interaccion del dashboard:

- **Estado:** `useReducer` con acciones SET_PERIODO, TOGGLE, SET_ALL, DEFAULTS, RESET
- **Datos:** SWR con `POST /api/dashboard/filtros`
- **Filtros disponibles:**
  - Periodo (desde/hasta con selectores de mes)
  - Estado del medico (ACTIVO, EXTERNO, INACTIVO)
  - Profesional (nombre del medico)
  - Programa/especialidad
  - Tipo de convenio
  - Orden de agrupacion
  - Agrupacion de salud
  - Diagnostico
  - Prestacion
- **Visualizaciones:**
  - 4 tarjetas KPI (total autorizaciones, promedio mensual, profesionales, promedio por profesional)
  - Grafica de tendencia mensual (anio actual vs anterior)
  - Top 10 profesionales con porcentaje
  - Top 10 prestaciones con porcentaje
  - Top 10 diagnosticos con porcentaje
- **Exportacion:** Descarga CSV con hasta 500,000 registros filtrados

**Respuesta del endpoint `/api/dashboard/filtros`:**

```typescript
{
    periodos: number[],              // Periodos disponibles
    opciones: {                       // Opciones para cada dropdown
        estados: string[],
        profesionales: string[],
        programas: string[],
        tipo_convenio: string[],
        orden_agrup: string[],
        agrup_salud: string[],
        diagnosticos: string[],
        prestaciones: string[]
    },
    kpis: {
        total_autorizaciones: number,
        valor_total: number,
        total_profesionales: number,
        rango_fechas: { desde: number, hasta: number }
    },
    serie_actual: { periodo: number, total: number, valor: number }[],
    serie_anterior: { periodo: number, total: number, valor: number }[],
    top_profesionales: { nombre: string, total: number, porcentaje: number }[],
    top_prestaciones: { nombre: string, total: number, porcentaje: number }[],
    top_diagnosticos: { nombre: string, total: number, porcentaje: number }[],
    defaults_applied?: { desde: number, hasta: number, estados: string[] }
}
```

### 5.6 Modulo de Carga de Archivos

Accesible desde `/admin/carga`. Solo para usuarios con rol `admin`.

**Flujo completo:**

```
1. Drag & drop de .xlsx
   |
2. POST /api/carga/upload (FormData)
   |-- Validacion: extension .xlsx, tamano <= 150MB
   |-- Genera UUID job_id
   |-- Guarda archivo en UPLOADS_DIR/{jobId}_{filename}
   |-- Registra en log_cargas (estado: procesando)
   |-- Spawn: python etl_autorizaciones.py --preview --archivo ... --job-id ...
   |-- Retorna 202 { job_id }
   |
3. Polling: GET /api/carga/validacion/{jobId} cada 5s
   |-- Retorna estado actual + metricas de validacion
   |
4. Cuando estado = "esperando_confirmacion":
   |-- Muestra informe: filas validas, errores, medicos no encontrados
   |-- Boton "Confirmar" / "Cancelar"
   |
5a. Confirmar: POST /api/carga/confirm/{jobId}
   |-- Spawn: python etl_autorizaciones.py --confirm {jobId}
   |-- Datos migran de staging a autorizaciones
   |-- Vistas materializadas se refrescan
   |
5b. Cancelar: POST /api/carga/cancel/{jobId}
   |-- Marca como cancelado, limpia staging
```

**Informe de validacion mostrado:**

- Total filas en archivo
- Filas validas / con error
- Fechas invalidas detectadas
- Valores invalidos detectados
- Medicos no encontrados (lista con nombres)
- Columnas faltantes (si las hay)
- Distribucion de estados de autorizacion

### 5.7 Modulo de Administracion

#### Gestion de Usuarios (`/admin/usuarios`)

CRUD completo para usuarios del dashboard:
- Formulario: email, nombre, password, rol, regional (si coordinador)
- Tabla con: email, rol, regional, ultimo login, estado activo
- Acciones: editar, desactivar/activar
- Protecciones: el admin no puede desactivarse a si mismo ni cambiar su propio rol

#### Gestion de Profesionales (`/admin/medicos`)

CRUD completo para el catalogo de medicos:
- Formulario: usuario_txt, identificacion, nombre, estado, programa, area
- Busqueda en vivo (filtro local)
- 11 programas/especialidades predefinidos
- 4 areas: MEDICINA, SALUD ORAL, ENFERMERIA, INTERCONSULTAS
- usuario_txt es inmutable despues de la creacion (clave primaria)

### 5.8 Componentes de UI

| Componente | Ubicacion | Descripcion |
|------------|-----------|-------------|
| **AppShell** | layout/AppShell.tsx | Layout principal con sidebar responsive + drawer movil |
| **Sidebar** | layout/Sidebar.tsx | Navegacion lateral con submenu colapsable para dashboard |
| **DashboardView** | dashboard/DashboardView.tsx | Contenedor principal del dashboard con filtros, KPIs y graficas |
| **TendenciaMensual** | dashboard/TendenciaMensual.tsx | Grafica de lineas: tendencia mensual actual vs anterior |
| **TopProfesionales** | dashboard/TopProfesionales.tsx | Rankings top 10 (profesionales, prestaciones, diagnosticos) |
| **DropzoneArchivo** | carga/DropzoneArchivo.tsx | Zona drag & drop para subir archivos .xlsx |
| **InformeValidacion** | carga/InformeValidacion.tsx | Visualizacion del reporte de validacion con polling |
| **ListaArchivos** | carga/ListaArchivos.tsx | Historial de cargas anteriores |
| **CheckDropdown** | ui/CheckDropdown.tsx | Dropdown multiseleccion con busqueda, select all, scroll virtual |
| **Badge** | ui/Badge.tsx | Etiqueta de estado/rol con colores |
| **Spinner** | ui/Spinner.tsx | Indicador de carga SVG animado |
| **Semaforo** | ui/Semaforo.tsx | Indicador visual tipo semaforo (verde/amarillo/rojo) |
| **SkeletonCard** | ui/SkeletonCard.tsx | Placeholder de carga para tarjetas KPI |

---

## 6. Estrategia de Rendimiento

### 6.1 Optimizacion de Consultas

La estrategia de rendimiento se basa en **nunca consultar la tabla `autorizaciones` directamente** desde el dashboard. Todas las consultas van contra las vistas materializadas pre-agregadas.

**Comparacion de rendimiento:**

| Operacion | Sin optimizacion | Con vistas materializadas |
|-----------|-----------------|--------------------------|
| KPIs generales (COUNT, SUM) | Scan completo de autorizaciones (millones de filas) | Scan de vm_filtros_dashboard (pre-agregada) |
| Dashboard de laboratorios | Scan + filtro WHERE en autorizaciones | Scan de vm_dash_laboratorios (solo filas relevantes) |
| Opciones de filtro cascada | 12 queries con GROUP BY en tabla grande | 12 queries con GROUP BY en vista reducida |
| Serie temporal mensual | Scan con GROUP BY periodo | Suma rapida sobre filas pre-agregadas |

**Ejecucion paralela de queries:**

El endpoint `/api/dashboard/filtros` ejecuta **15+ queries en paralelo** usando `Promise.all`:
- 1 query para periodos disponibles
- 8 queries para opciones de cada dimension (cascada)
- 1 query para KPIs
- 2 queries para series temporales (actual + anterior)
- 3 queries para top 10 (profesionales, prestaciones, diagnosticos)

### 6.2 Cache Multinivel

El sistema implementa cache en 3 niveles:

```
Nivel 1: Cache SWR (cliente)
  |-- Memoria del navegador
  |-- Revalidacion automatica
  |-- keepPreviousData durante refetch
  |
Nivel 2: Cache HTTP (transporte)
  |-- Cache-Control: private, max-age=60, stale-while-revalidate=120
  |-- El navegador sirve respuestas stale mientras revalida
  |
Nivel 3: Cache in-memory (servidor)
  |-- Map<key, { data, expires }>
  |-- TTL: 5 minutos
  |-- Clave: hash de (filtros + rol + regional)
  |-- Se invalida automaticamente por TTL
```

**Calculo de cache key:**

```typescript
cacheKey("filtros", {
    periodos: [202601, 202603],
    estados: ["ACTIVO"],
    view: "vm_dash_laboratorios",
    rol: "coordinador",
    regional: "MANIZALES"
})
// Genera: "filtros:agrup_salud=&diagnostico=&estados=ACTIVO&..."
```

### 6.3 Filtros en Cascada

Los filtros del dashboard usan el patron **cascading dropdowns**: cada dropdown muestra solo opciones validas dado el estado de los demas filtros.

**Implementacion:**

El query builder tiene dos funciones clave:
- `buildAll(builder, parsed, regional)` — Aplica TODOS los filtros activos
- `buildExcept(builder, parsed, regional, skip)` — Aplica todos los filtros EXCEPTO la dimension especificada

Para generar las opciones de cada dropdown:

```
Opciones de "estado_medico" = SELECT DISTINCT estado_medico
                              FROM vista
                              WHERE [filtros de periodo, profesional, programa, ...]
                              -- NO incluye filtro de estado_medico
```

Esto asegura que:
- Cada dropdown muestra opciones con datos reales (no combinaciones vacias)
- Seleccionar un filtro no hace desaparecer las opciones de los demas

**Tracking de campos tocados:**

El reducer de estado rastrea que campos ha modificado el usuario (`touched[]`). Solo los campos tocados se envian al API, evitando enviar todas las opciones como filtro.

### 6.4 Pool de Conexiones

```typescript
// db.ts — Configuracion del pool
new Pool({
    connectionString: DATABASE_URL,
    max: 20,                    // Maximo 20 conexiones simultaneas
    idleTimeoutMillis: 30000,   // Libera conexiones inactivas despues de 30s
    statement_timeout: 15000    // Timeout de 15s por query
});
```

**Reutilizacion en desarrollo:**

Next.js recarga modulos frecuentemente en modo dev, lo que agotaria el pool. Se usa `globalThis` para reutilizar:

```typescript
const pool = process.env.NODE_ENV === "production"
    ? createPool()
    : (globalThis._pgPool ??= createPool());
```

---

## 7. Infraestructura y Despliegue

### 7.1 Arquitectura Docker

El sistema se despliega como **2 contenedores** orquestados con Docker Compose:

```
+----------------------------------------------------------+
|                    Docker Compose                         |
|                                                          |
|  +------------------------+   +------------------------+ |
|  |     db                 |   |     dashboard          | |
|  |     postgres:16-alpine |   |     node:20-alpine     | |
|  |                        |   |     + python 3.12      | |
|  |  Puerto: 5432 (int)    |   |                        | |
|  |  Volumen: pgdata       |   |  Puerto: 3000:3000     | |
|  |  Init: init-db.sh      |   |  Volumenes: uploads,   | |
|  |  SQL: /sql (readonly)  |   |             logs       | |
|  |                        |   |                        | |
|  |  Health: pg_isready    |   |  Health: curl /api/    | |
|  |                        |   |          health        | |
|  +------------------------+   +------------------------+ |
|                                                          |
|  Volumenes:                                              |
|  - pgdata  (datos PostgreSQL persistentes)               |
|  - uploads (archivos temporales de carga)                |
|  - logs    (logs del ETL)                                |
+----------------------------------------------------------+
```

**Restriccion arquitectonica:** El contenedor `dashboard` incluye Node.js Y Python porque el ETL se invoca via `child_process.spawn()` desde el proceso Node.js.

### 7.2 Dockerfile Multi-Stage

El Dockerfile usa 3 stages para optimizar el tamano de la imagen:

```
Stage 1: deps (node:20-alpine)
  |-- Copia package.json + package-lock.json
  |-- npm ci --omit=dev (solo dependencias de produccion)
  |
Stage 2: builder (node:20-alpine)
  |-- Copia node_modules desde deps
  |-- Copia codigo fuente del dashboard
  |-- Ejecuta: npm run build (output: standalone)
  |
Stage 3: runner (node:20-alpine + python3)
  |-- Instala Python 3.12 via apk
  |-- Crea virtualenv en /opt/venv
  |-- pip install dependencias del ETL
  |-- Copia build standalone de Next.js
  |-- Copia carpeta etl/ completa
  |-- Crea directorios tmp_uploads/ y logs/
  |-- CMD: node server.js
```

**Variables de entorno con defaults para Docker:**

| Variable | Default | Proposito |
|----------|---------|-----------|
| NODE_ENV | production | Modo de Next.js |
| PYTHON_PATH | python3 | Ejecutable Python |
| ETL_SCRIPT_PATH | /app/etl/etl_autorizaciones.py | Ruta al ETL |
| UPLOADS_DIR | /app/tmp_uploads | Directorio de archivos subidos |
| ETL_LOGS_DIR | /app/logs | Directorio de logs |
| PORT | 3000 | Puerto del servidor |

### 7.3 Orquestacion con Docker Compose

**Servicio `db` (PostgreSQL):**

```yaml
db:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
        - pgdata:/var/lib/postgresql/data        # Datos persistentes
        - ./docker/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh  # Init
        - ./etl/sql:/sql:ro                       # Migraciones (solo lectura)
    healthcheck:
        test: pg_isready -U postgres
        interval: 10s
        retries: 5
```

**Servicio `dashboard` (Next.js + Python):**

```yaml
dashboard:
    build: .
    restart: unless-stopped
    depends_on:
        db:
            condition: service_healthy    # Espera a que PostgreSQL este listo
    ports:
        - "3000:3000"
    volumes:
        - uploads:/app/tmp_uploads
        - logs:/app/logs
    healthcheck:
        test: curl -f http://localhost:3000/api/health
        interval: 30s
        start_period: 15s
```

### 7.4 Inicializacion Automatica de BD

El script `docker/init-db.sh` se ejecuta automaticamente en el primer arranque del contenedor PostgreSQL (via `docker-entrypoint-initdb.d/`):

```
1. Crear rol de aplicacion (APP_DB_USER) si no existe
2. Crear base de datos (APP_DB_NAME) si no existe
3. Ejecutar migraciones en orden:
   001_create_tables.sql   -> Tablas + funcion de particionamiento
   002_create_indexes.sql  -> 14 indices
   003_create_views.sql    -> Vista general vm_filtros_dashboard
   004_seed_usuarios.sql   -> Usuario admin inicial
   005_estado_medico_null_to_externo.sql -> Migracion de NULLs
   006_create_subviews.sql -> 7 subvistas por tipo de prestacion
4. Ejecutar 007_refresh_views.sql con tolerancia a errores
   (REFRESH CONCURRENTLY falla en BD vacia — comportamiento esperado)
```

### 7.5 Health Checks

**Health check del dashboard:**

```typescript
// GET /api/health — Sin autenticacion
export async function GET() {
    try {
        await query("SELECT 1");
        return NextResponse.json({ status: "ok" });
    } catch {
        return NextResponse.json({ status: "error" }, { status: 503 });
    }
}
```

Excluido del middleware de autenticacion para que Docker pueda verificar el estado sin credenciales.

**Health check de PostgreSQL:**

```bash
pg_isready -U postgres
```

**Configuracion Docker:**

| Servicio | Intervalo | Timeout | Start period | Reintentos |
|----------|-----------|---------|-------------|------------|
| db | 10s | 5s | - | 5 |
| dashboard | 30s | 5s | 15s | 3 |

### 7.6 Volumenes y Persistencia

| Volumen | Tipo | Contenido | Persistencia |
|---------|------|-----------|-------------|
| `pgdata` | Named volume | Datos de PostgreSQL (tablas, indices, WAL) | Sobrevive a `docker-compose down` |
| `uploads` | Named volume | Archivos .xlsx subidos temporalmente | Sobrevive a recreacion del contenedor |
| `logs` | Named volume | Logs del ETL ({jobId}.log) | Sobrevive a recreacion del contenedor |

**Destruccion de datos:** Solo `docker-compose down -v` destruye los volumenes.

### 7.7 Entorno de Produccion

**Variables de entorno requeridas (`.env.production`):**

| Variable | Ejemplo | Descripcion |
|----------|---------|-------------|
| POSTGRES_PASSWORD | (secreto) | Password del superusuario PostgreSQL |
| APP_DB_NAME | interconsultas | Nombre de la base de datos |
| APP_DB_USER | ips_user | Usuario de la aplicacion |
| APP_DB_PASSWORD | (secreto) | Password del usuario de app |
| NEXTAUTH_SECRET | (base64, 32+ chars) | Secreto para firmar JWT |
| NEXTAUTH_URL | http://IP:3000 | URL publica del dashboard |

**Comando de despliegue:**

```bash
docker-compose --env-file .env.production up -d
```

---

## 8. Seguridad

### 8.1 Autenticacion

- **Metodo:** Credenciales (email + password)
- **Hashing:** bcrypt con cost factor 12 (~250ms por hash)
- **Sesion:** JWT almacenado en cookie HTTP-only
- **Rate limiting:** 5 intentos fallidos por email en ventana de 15 minutos
- **Limpieza:** El contador se resetea en login exitoso

### 8.2 Autorizacion por Roles

- Cada endpoint API verifica rol del usuario antes de procesar
- Los coordinadores solo ven datos de su regional (inyeccion automatica de WHERE)
- El admin no puede desactivarse a si mismo ni cambiar su propio rol
- Soft delete para usuarios (nunca se eliminan fisicamente)

### 8.3 Proteccion contra Inyeccion SQL

Todas las consultas usan **queries parametrizadas**:

```typescript
// Query builder con parametros posicionales
const builder = wb(); // { clauses: ["1=1"], params: [] }
addIn(builder, "estado_medico", ["ACTIVO", "EXTERNO"]);
// clauses: ["1=1", "estado_medico IN ($1,$2)"]
// params: ["ACTIVO", "EXTERNO"]
```

Nunca se concatenan valores de usuario directamente en strings SQL.

### 8.4 Validacion de Entradas

| Punto de entrada | Validacion |
|-----------------|------------|
| Upload de archivo | Extension .xlsx obligatoria, tamano <= 150MB |
| jobId en URLs | Regex UUID `/^[0-9a-f-]+$/i` (mitiga path traversal) |
| Columnas del Excel | 56 columnas requeridas validadas antes de procesamiento |
| Filtros del dashboard | Sanitizados por query builder con parametros |
| Vistas | Whitelist en `view-registry.ts` (solo nombres conocidos) |

### 8.5 Gestion de Secretos

- Archivos `.env` excluidos de Git via `.gitignore`
- Templates `.env.example` con valores placeholder
- Variables sensibles inyectadas via Docker Compose `--env-file`
- NEXTAUTH_SECRET debe generarse con: `openssl rand -base64 32`

---

## 9. Testing

### 9.1 Tests del ETL (Python)

**Framework:** pytest 9.0.3
**Total:** 101 tests

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| test_validators.py | 10 | Validacion de columnas (presentes, faltantes, extra, vacias) |
| test_dedup.py | 12 | Hash de archivo, hash de filas, colisiones, archivos vacios |
| test_reporters.py | 14 | Construccion de informes, estados finales, serializacion JSON |
| test_detectar_periodo.py | 13 | Deteccion desde nombre de archivo, formatos, edge cases |
| test_parsear_fecha.py | 14 | Seriales Excel, ISO, DD/MM/YYYY, NaT, fuera de rango |
| test_cruzar_medicos.py | 9 | Match por usuario_txt, por nombre, EXTERNO, especiales |
| test_preparar_staging.py | 7 | Renombrado de columnas, hash de filas, orden de campos |
| test_valor_py.py | 14 | Conversion NaN/NaT a None, floats, enteros, edge cases |
| test_config.py | 5 | Variables de entorno, conexion, valores default |

**Ejecucion:**

```bash
cd etl
python -m pytest tests/ -v
```

### 9.2 Tests del Dashboard (TypeScript)

**Framework:** Jest 30 + @testing-library/react
**Total:** 101 tests

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| cache.test.ts | 9 | Cache en memoria, TTL, expiracion, claves |
| estado.test.ts | 5 | Helper de etiquetas de estado |
| dashboard-filters.test.ts | 22 | Query builder, parametros, cascada, regional |
| view-registry.test.ts | 11 | Resolucion de vistas, whitelist, defaults |
| fetcher.test.ts | 8 | Fetcher SWR, errores HTTP, JSON parsing |
| etl-spawn.test.ts | 6 | Spawn de proceso, validacion UUID, rutas |
| useDebouncedValue.test.ts | 5 | Hook de debounce, timing, actualizacion |
| Badge.test.tsx | 14 | Renderizado de badges, variantes de color |
| Spinner.test.tsx | 5 | Renderizado de spinner, clases CSS |
| Semaforo.test.tsx | 14 | Semaforo verde/amarillo/rojo, umbrales |
| health.test.ts | 2 | Endpoint health check (OK y error) |

**Ejecucion:**

```bash
cd dashboard
npx jest
```

---

## 10. Monitoreo y Observabilidad

### Puntos de monitoreo disponibles

| Metrica | Fuente | Como verificar |
|---------|--------|---------------|
| Estado de la aplicacion | GET /api/health | `curl http://localhost:3000/api/health` |
| Estado de PostgreSQL | pg_isready | `docker exec db pg_isready -U postgres` |
| Logs del ETL | Volumen logs | `docker exec dashboard cat /app/logs/{jobId}.log` |
| Estado de cargas | Tabla log_cargas | Query: `SELECT estado, COUNT(*) FROM log_cargas GROUP BY estado` |
| Cargas fallidas | Tabla log_cargas | Query: `SELECT * FROM log_cargas WHERE estado = 'error_fatal' ORDER BY cargado_en DESC` |
| Tamano de la BD | PostgreSQL | `SELECT pg_size_pretty(pg_database_size('interconsultas'))` |
| Tamano por particion | PostgreSQL | `SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) FROM pg_class WHERE relname LIKE 'autorizaciones_%'` |
| Filas por periodo | Vista | `SELECT periodo, SUM(total_autorizaciones) FROM vm_filtros_dashboard GROUP BY periodo ORDER BY periodo` |
| Logs del contenedor | Docker | `docker logs dashboard --tail 100` |

### Verificacion post-despliegue

```bash
# 1. Verificar servicios
docker-compose ps

# 2. Health check
curl http://localhost:3000/api/health

# 3. Verificar BD
docker exec -it db psql -U ips_user -d interconsultas -c "SELECT COUNT(*) FROM usuarios"

# 4. Verificar vistas
docker exec -it db psql -U ips_user -d interconsultas -c "\dm+ vm_*"

# 5. Login
# Abrir http://localhost:3000/login
# admin@ips.local / Admin2026!
```

---

## 11. Guia de Despliegue en DigitalOcean

### Requisitos

| Recurso | Especificacion |
|---------|---------------|
| Droplet | 4 GB RAM, 2 vCPU |
| Plan | $24/mes |
| Imagen | Docker preinstalado (DigitalOcean Marketplace) |
| Puertos | 22 (SSH), 3000 (Dashboard) |
| Almacenamiento | 80 GB SSD (incluido) |

### Pasos de despliegue

```bash
# 1. Conectar al Droplet
ssh root@IP_DEL_DROPLET

# 2. Clonar repositorio
git clone https://URL_DEL_REPOSITORIO.git interconsultas
cd interconsultas

# 3. Configurar variables de produccion
cp .env.production.example .env.production
nano .env.production
# Llenar: POSTGRES_PASSWORD, APP_DB_PASSWORD, NEXTAUTH_SECRET, NEXTAUTH_URL

# 4. Generar NEXTAUTH_SECRET
openssl rand -base64 32
# Copiar el resultado en NEXTAUTH_SECRET

# 5. Levantar servicios
docker-compose --env-file .env.production up -d

# 6. Verificar estado
docker-compose ps
curl http://localhost:3000/api/health

# 7. Configurar firewall
ufw allow 22/tcp
ufw allow 3000/tcp
ufw enable

# 8. Verificar acceso externo
# Abrir http://IP_DEL_DROPLET:3000/login en navegador
```

### Operaciones de mantenimiento

| Operacion | Comando |
|-----------|---------|
| Ver logs del dashboard | `docker logs dashboard --tail 100 -f` |
| Ver logs de PostgreSQL | `docker logs db --tail 100 -f` |
| Reiniciar servicio | `docker-compose restart dashboard` |
| Actualizar codigo | `git pull && docker-compose up -d --build` |
| Backup de BD | `docker exec db pg_dump -U ips_user interconsultas > backup_$(date +%Y%m%d).sql` |
| Restaurar BD | `cat backup.sql \| docker exec -i db psql -U ips_user -d interconsultas` |
| Ver uso de disco | `docker system df` |
| Limpiar imagenes viejas | `docker image prune -a` |

---

## 12. Glosario

| Termino | Definicion |
|---------|-----------|
| **Autorizacion** | Registro individual de una prestacion de salud autorizada por la EPS para un afiliado |
| **Periodo** | Mes de referencia en formato YYYYMM (ej: 202603 = marzo 2026) |
| **EPS** | Entidad Promotora de Salud — aseguradora de salud que autoriza prestaciones |
| **IPS** | Institucion Prestadora de Servicios de salud — ejecuta las prestaciones |
| **ETL** | Extract-Transform-Load — proceso de extraccion, transformacion y carga de datos |
| **Staging** | Area temporal donde se cargan datos validados antes de la confirmacion definitiva |
| **Vista materializada** | Tabla pre-calculada que almacena resultados de un query complejo; se refresca periodicamente |
| **Particionamiento** | Division de una tabla grande en subtablas fisicas por rango de valores (periodo) |
| **REFRESH CONCURRENTLY** | Refresco de vista materializada que no bloquea lecturas simultaneas |
| **Hash de fila** | SHA-256 calculado sobre columnas clave para detectar registros duplicados |
| **RBAC** | Role-Based Access Control — control de acceso basado en roles |
| **JWT** | JSON Web Token — estandar para autenticacion sin estado (stateless) |
| **SWR** | Stale-While-Revalidate — estrategia de cache que muestra datos stale mientras revalida |
| **Cascading filters** | Filtros donde las opciones de cada dropdown dependen de las selecciones en los demas |
| **Standalone output** | Modo de build de Next.js que genera un servidor independiente sin node_modules |
| **Health check** | Endpoint que verifica la salud del servicio, usado por Docker para reinicio automatico |
| **Soft delete** | Desactivar un registro (activo=false) en lugar de eliminarlo fisicamente |
| **usuario_txt** | Identificador del profesional en el sistema de turnos de la IPS |
| **Sucursal 1712** | Codigo de sucursal de la IPS Manizales; el ETL filtra solo este codigo |
| **Regional** | Subdivision geografica (MANIZALES, VILLAMARIA, CHINCHINA, etc.) |

---

*Documento generado el 2026-05-28. Para actualizaciones, consultar el repositorio del proyecto.*
