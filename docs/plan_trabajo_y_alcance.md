# Plan de Trabajo y Alcance
## Dashboard de Autorizaciones y Gestión Médica

**IPS Manizales**

---

## Información General del Proyecto

| Atributo | Valor |
|----------|-------|
| Nombre del proyecto | Dashboard de Autorizaciones y Gestión Médica |
| Cliente | IPS Manizales |
| Inicio | 14 de abril de 2026 |
| Entrega | 16 de mayo de 2026 |
| Duración | 5 semanas |
| Presupuesto desarrollo | $3.800.000 COP |
| Presupuesto infraestructura mensual | ~$16.80 USD (~$71.000 COP) a cargo del cliente |
| Forma de pago | 50% Semana 3 / 50% Semana 5 |

---

## 1. Plan de Trabajo por Semana

### Semana 1: Base de Datos y ETL (14 – 18 de abril)

**Objetivo:** Construir el cimiento técnico del proyecto — base de datos optimizada y pipeline de carga de datos.

| # | Tarea | Tipo | Duración | Estado |
|---|-------|------|----------|--------|
| 1.1 | Configurar DigitalOcean Droplet: Ubuntu, PostgreSQL, Nginx y SSL | Infraestructura | 0.5 días | Por hacer |
| 1.2 | Diseñar esquema de tablas: autorizaciones, citas_atendidas, medicos, usuarios | Base de datos | 0.5 días | Por hacer |
| 1.3 | Crear 6 índices compuestos optimizados para los filtros del dashboard | Base de datos | 0.5 días | Por hacer |
| 1.4 | Script ETL Python autorizaciones: limpiar fórmulas, normalizar 76 columnas, carga COPY | ETL | 1.5 días | Por hacer |
| 1.5 | Script ETL Python citas atendidas y cruce con catálogo de médicos | ETL | 0.5 días | Por hacer |
| 1.6 | Cargar datos de muestra y validar tiempos con EXPLAIN ANALYZE | ETL | 0.5 días | Por hacer |

**Entregable:** Base de datos en la nube operativa con ETL funcional y validado.

---

### Semana 2: Vistas Materializadas y Autenticación (21 – 25 de abril)

**Objetivo:** Pre-calcular agregados para rendimiento y construir autenticación con roles.

| # | Tarea | Tipo | Duración | Estado |
|---|-------|------|----------|--------|
| 2.1 | Implementar 4 vistas materializadas: por médico, cumplimiento, distribución, tendencia | Base de datos | 1.0 día | Por hacer |
| 2.2 | Script actualización automática de vistas materializadas tras cada carga | Base de datos | 0.5 días | Por hacer |
| 2.3 | Inicializar proyecto Next.js 14 + Tailwind CSS + estructura de carpetas | Frontend | 0.5 días | Por hacer |
| 2.4 | NextAuth.js: login, sesiones JWT y protección de rutas | Auth | 0.5 días | Por hacer |
| 2.5 | Middleware de roles (Admin, Dirección Médica, Coordinador) en API Routes | Auth | 0.5 días | Por hacer |
| 2.6 | Conectar Next.js a PostgreSQL y validar queries desde el frontend | Backend | 0.5 días | Por hacer |

**Entregable:** Aplicación web desplegada en Vercel con login funcionando y vistas materializadas activas.

---

### Semana 3: Dashboard, Filtros y Exportación ⭐ HITO DE PAGO (28 de abril – 2 de mayo)

**Objetivo:** Módulo principal operativo. Este entregable activa el primer pago ($1.900.000 COP).

| # | Tarea | Tipo | Duración | Estado |
|---|-------|------|----------|--------|
| 3.1 | Tarjetas KPI: total autorizaciones, tasa de cumplimiento y distribución por tipo | Frontend | 1.0 día | Por hacer |
| 3.2 | Gráfica de línea: tendencia mensual de autorizaciones (24 meses) | Frontend | 0.5 días | Por hacer |
| 3.3 | Gráfica de dona: distribución porcentual por tipo de prestación | Frontend | 0.5 días | Por hacer |
| 3.4 | Módulo 8 filtros combinables: médico, período, tipo, IPS, especialidad, regional, estado | Frontend | 1.0 día | Por hacer |
| 3.5 | Tabla paginada con ordenamiento y exportación a Excel (.xlsx) | Frontend | 0.5 días | Por hacer |
| 3.6 | Revisión con cliente y aprobación del entregable — **PRIMER PAGO $1.900.000 COP** | Entrega | 0.5 días | Por hacer |

**Indicador principal:** Tasa de cumplimiento = (citas atendidas / autorizaciones emitidas) × 100

**Entregable:** Dashboard operativo con filtros funcionales, gráficas y exportación a Excel.

**💰 HITO DE PAGO:** Primer pago de $1.900.000 COP al aprobar este entregable.

---

### Semana 4: Roles, Panel de Carga y Preforma Fase 2 (5 – 9 de mayo)

**Objetivo:** Completar control de acceso, panel administrativo y dejar arquitectura lista para Fase 2.

| # | Tarea | Tipo | Duración | Estado |
|---|-------|------|----------|--------|
| 4.1 | Control de acceso completo por rol en todas las rutas de API y frontend | Auth | 1.0 día | Por hacer |
| 4.2 | Panel de carga de archivos Excel con validación de formato y errores | Frontend | 1.0 día | Por hacer |
| 4.3 | Documentar endpoints API para perfil del médico (Fase 2) | Backend | 0.5 días | Por hacer |
| 4.4 | Semáforo visual de cumplimiento (verde/amarillo/rojo según umbrales) | Frontend | 0.5 días | Por hacer |
| 4.5 | Documentación técnica del modelo de datos y guía del administrador | QA | 1.0 día | Por hacer |

**Entregable:** Control de acceso por rol implementado, panel de carga funcional, preforma documentada para Fase 2.

---

### Semana 5: Carga Histórica, Pruebas y Entrega Final (12 – 16 de mayo)

**Objetivo:** Estabilización y entrega en producción con datos reales.

| # | Tarea | Tipo | Duración | Estado |
|---|-------|------|----------|--------|
| 5.1 | Carga del histórico completo: 2 años de autorizaciones y citas | ETL | 1.0 día | Por hacer |
| 5.2 | Pruebas de rendimiento: filtros en menos de 2 seg con 6.8M filas | QA | 0.5 días | Por hacer |
| 5.3 | Ajustes de UX basados en feedback del cliente semana 3 | Frontend | 0.5 días | Por hacer |
| 5.4 | Capacitación remota al administrador del sistema (máx. 2 horas) | Capacitación | 0.5 días | Por hacer |
| 5.5 | Entrega formal en producción — **SEGUNDO PAGO $1.900.000 COP** | Entrega | 0.5 días | Por hacer |

**Entregable:** Sistema en producción con histórico completo cargado, pruebas validadas, capacitación realizada.

**💰 HITO DE PAGO:** Segundo pago de $1.900.000 COP contra entrega en producción.

---

## 2. Alcance Detallado

### ✅ IN SCOPE — Lo que está incluido en esta fase

#### Base de datos y ETL

- Esquema relacional PostgreSQL con 4 tablas:
  - `autorizaciones`: detalle de servicios autorizados (76 columnas normalizadas)
  - `citas_atendidas`: reporte mensual de citas efectivamente atendidas
  - `medicos`: catálogo de médicos ordenadores
  - `usuarios`: usuarios del sistema con roles asignados

- 6 índices compuestos optimizados:
  - `(medico_id, periodo)` — filtro más frecuente
  - `(periodo, tipo_prestacion)` — segmentación por tipo
  - `(ips_atiende, periodo)` — análisis por IPS prestadora
  - `(diagnostico_cod, periodo)` — análisis por diagnóstico
  - `(regional, periodo, tipo_prestacion)` — vista ejecutiva
  - `(estado_autorizacion, periodo)` — seguimiento por estado

- 4 vistas materializadas (agregados pre-calculados):
  - `vm_autorizaciones_por_medico` — totales por médico y período
  - `vm_cumplimiento_mensual` — tasa de cumplimiento (autorizaciones vs. citas)
  - `vm_distribucion_prestacion` — proporción por tipo de prestación
  - `vm_tendencia_mensual` — serie temporal mensual

- Script ETL Python:
  - Lectura de archivos Excel de autorizaciones quincenales
  - Limpieza de columnas con fórmulas incrustadas (`$`, `IPS ASOCIADA`)
  - Normalización de 76 columnas
  - Carga masiva a PostgreSQL con `COPY` en lotes de 10.000 filas
  - Actualización automática de vistas materializadas

- Panel web de carga de archivos:
  - Validación de formato (detección de columnas faltantes)
  - Retroalimentación de errores
  - Confirmación de carga exitosa

#### Módulos del Dashboard

**Tarjetas KPI**
- Total de autorizaciones del período con variación % respecto al período anterior
- **Tasa de cumplimiento global:** (citas atendidas / autorizaciones emitidas) × 100
- Distribución por tipo de prestación: lab, RX/imagen, medicamento, procedimiento, consulta

**Gráficas de visualización**
- Gráfica de línea: tendencia mensual de total de autorizaciones y tasa de cumplimiento (últimos 24 meses)
- Gráfica de dona: distribución porcentual por tipo de prestación para período seleccionado

**Módulo de filtros (8 combinables)**
1. Médico ordenador (lista de médicos activos)
2. Período (rango de fechas, quincenal o mensual)
3. Tipo de prestación (laboratorio, RX, medicamento, procedimiento, consulta)
4. IPS que atiende (lista de prestadores)
5. Especialidad médica (especialidades del catálogo)
6. Regional/Ciudad (todas las regionales)
7. Estado de autorización (entregada, generada, anulada, etc.)
8. Diagrama (opcional)

**Tabla detallada con exportación**
- Tabla paginada de resultados filtrados
- Columnas: médico ordenador, fecha, tipo de prestación, descripción, diagnóstico, IPS, regional, estado, cantidad, valor autorizado
- Ordenamiento por cualquier columna
- Exportación completa a Excel (.xlsx) independiente de página visible

#### Autenticación y Control de Acceso

- Login seguro con NextAuth.js (sesiones JWT)
- Tres roles funcionales con permisos diferenciados:
  - **Administrador:** Carga de archivos, acceso a todos los datos, gestión de usuarios
  - **Dirección Médica:** Visualización de todos los médicos, dashboard ejecutivo
  - **Coordinador:** Visualización de su área/regional, análisis de médicos a su cargo
- Protección de todas las rutas de API con validación de sesión y rol
- Row Level Security (RLS) implementado a nivel de API para aislamiento de datos

#### Infraestructura y Entrega

- Configuración del servidor DigitalOcean Droplet (2GB RAM, 50GB SSD)
- Instalación y configuración de PostgreSQL, Nginx, SSL
- Despliegue de frontend en Vercel (plan Hobby, gratuito)
- Despliegue de API en DigitalOcean
- Carga del histórico completo de 2 años (6.8 millones de filas)
- Validación de tiempos de respuesta < 2 segundos con datos reales
- Backups automáticos diarios

#### Documentación y Capacitación

- Documentación técnica del modelo de datos (tablas, índices, vistas)
- Guía del administrador del sistema (carga de archivos, gestión de usuarios)
- 1 sesión de capacitación remota para el administrador (máximo 2 horas)
- Documentación de endpoints de API para Fase 2

---

### ❌ OUT OF SCOPE — No está incluido en esta fase

- **Portal individual del médico:** KPIs personales, top prestaciones propias, tasa de cumplimiento individual, gráfica de tendencia mensual personal. La arquitectura de roles, RLS y endpoints de API quedan **completamente implementados** en esta fase; el módulo visual se desarrolla en Fase 2 sin rediseño.

- **Integración directa con el HIS** o cualquier API externa de la EPS

- **Aplicación móvil nativa** (iOS / Android) — el dashboard es responsive pero no es app nativa

- **Módulo de alertas o notificaciones automáticas** por email o SMS

- **Carga automática y programada de archivos** — el proceso de carga es iniciado manualmente por el administrador desde el panel web

- **Reportes o indicadores adicionales** a los definidos en el alcance

- **Soporte y mantenimiento post-entrega** (cotizable por separado)

- **Capacitación a usuarios finales médicos** — solo se capacita al administrador del sistema

- **Costos de infraestructura mensual** (~$16.80 USD/mes):
  - DigitalOcean Droplet: ~$14 USD
  - DigitalOcean Backups: ~$2.80 USD
  - Vercel: $0 (plan Hobby)
  - A cargo del cliente

---

## 3. Requisitos Previos del Cliente

### Información necesaria antes del 14 de abril

| Elemento | Descripción | Fecha límite |
|----------|-------------|-------------|
| **Archivos Excel de autorizaciones** | Mínimo 2 períodos quincenales recientes en el formato actual | **14 de abril** |
| **Archivo de citas atendidas** | Reporte mensual en formato actual | **14 de abril** |
| **Histórico completo (2 años)** | Todos los archivos quincenales disponibles para carga final | **Semana 5 (12 mayo)** |

### Información a definir en la reunión de kick-off (14 de abril)

| Pregunta | Opciones | Para semana |
|----------|----------|-------------|
| Umbral del semáforo de cumplimiento | Verde ≥ __%, amarillo __–__%, rojo < __% | 1 |
| Tipo de login | Correo institucional vs. credenciales propias | 1 |
| Cantidad de usuarios iniciales | Número aproximado de usuarios del sistema | 2 |
| Dominio web | ¿Existe ya o se debe crear? (ej: dashboard.ips.com) | 2 |

### Compromisos del cliente

- Disponibilidad de interlocutor para resolver dudas: máximo 24 horas hábiles
- Sesiones de revisión semanal: máximo 1 hora, en día acordado (sugerido: viernes 3pm)
- Formato de los archivos Excel no cambia durante el desarrollo
- Datos de pacientes tratados únicamente para desarrollo y pruebas, eliminados al finalizar

---

## 4. Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|--------------|
| **Frontend** | Next.js 14 + Tailwind CSS | Framework React con SSR para rendimiento, sin licencias |
| **Backend / API** | Next.js API Routes | API integrada, sin servidor adicional |
| **Base de datos** | PostgreSQL en DigitalOcean | Relacional nativo, soporta índices compuestos y vistas materializadas |
| **Autenticación** | NextAuth.js | Open source, manejo de sesiones JWT y roles nativos |
| **Visualizaciones** | Recharts | Gráficas ligeras, sin licencias, integración React |
| **ETL / Carga** | Python + pandas | Procesamiento robusto de Excel, carga masiva a PostgreSQL |
| **Hosting frontend** | Vercel | CDN global, despliegue automático, plan Hobby gratuito |
| **Hosting BD + Servidor** | DigitalOcean Droplet | $14 USD/mes, 2GB RAM, 50GB SSD, SLA 99.99%, capacidad 10+ años |
| **Backups** | DigitalOcean Backups | $2.80 USD/mes, automáticos diarios, retención 7 días |

---

## 5. Hitos de Pago

| Hito | Condición | Monto | Fecha estimada |
|------|-----------|-------|-----------------|
| **Primer pago** | Aprobación del entregable Semana 3 (dashboard con filtros funcionales) | $1.900.000 COP | 2 de mayo |
| **Segundo pago** | Entrega en producción Semana 5 (sistema completo con datos reales) | $1.900.000 COP | 16 de mayo |
| **TOTAL** | | **$3.800.000 COP** | |

---

## 6. Condiciones que Protegen el Alcance

- **Formato de datos:** Los archivos Excel mantienen las 76 columnas y su estructura. Cambios en las columnas o estructura requieren evaluación de impacto en cronograma y presupuesto.

- **Entrega de datos:** Los archivos Excel de autorizaciones y citas atendidas se entregan en o antes del 14 de abril. Retrasos en la entrega pueden correr el cronograma de la Semana 1.

- **Revisiones semanales:** Cada sesión de revisión es máximo 1 hora. Si el cliente requiere más tiempo, se reagenda como sesión adicional.

- **Cambios de alcance:** Cualquier cambio, adición o eliminación de funcionalidades requiere una evaluación formal y puede resultar en ajuste de presupuesto y cronograma.

- **Disponibilidad:** El cliente designa un interlocutor con disponibilidad de máximo 24 horas hábiles para resolver dudas técnicas.

---

## 7. Módulos Futuros — Fase 2

Los siguientes módulos quedan completamente arquitectados en esta fase (sin rediseño requerido):

- **Portal individual del médico (prioridad Fase 2):** Acceso autenticado donde cada médico ve exclusivamente sus autorizaciones, KPIs personales, top prestaciones propias, tasa de cumplimiento individual y gráfica de tendencia mensual. Los endpoints de API, el modelo de datos y el RLS quedan implementados; el desarrollo del portal es directo.

- **Módulo de alertas:** Notificación automática cuando un médico supera umbrales definidos.

- **Integración con HIS:** Carga automática sin subir archivos manualmente.

- **Comparativo inter-médico:** Benchmarking por especialidad.

---

## 8. Cronograma Visual

```
Semana 1          Semana 2          Semana 3 ⭐        Semana 4          Semana 5
14-18 abr         21-25 abr         28 abr-2 may      5-9 may           12-16 may
│                 │                 │                 │                 │
├─ BD + ETL       ├─ Vistas         ├─ Dashboard      ├─ Control acceso  ├─ Histórico
├─ Índices        ├─ NextAuth       ├─ Filtros        ├─ Panel carga     ├─ Pruebas
├─ Validación     ├─ Roles          ├─ Exportación    ├─ Preforma Fase 2 ├─ Capacitación
│                 │                 ├─ REVISIÓN       │                 │
│                 │                 ├─ PAGO 1 ✅      │                 └─ PAGO 2 ✅
│                 │                 │ $1.900.000 COP  │                 $1.900.000 COP
└─ Entregable:    └─ Entregable:    └─ Entregable:    └─ Entregable:    └─ Entregable:
  BD operativa      App con login      Dashboard ops     Roles + Panel      En producción
```

---

## 9. Equipo y Responsabilidades

### Equipo Desarrollo

- **Rol:** Desarrollador Principal
- **Responsabilidades:** Ejecución del desarrollo, cumplimiento del cronograma, reportes semanales
- **Disponibilidad:** 3 días por semana

### Equipo Cliente

- **Interlocutor Principal:** [A definir en reunión]
  - Responsables: Validación de entregables, aporte de datos, toma de decisiones

- **Dirección Médica:** [A definir en reunión]
  - Responsables: Validación de indicadores, umbrales del semáforo

- **Administrador del Sistema:** [A definir en reunión]
  - Responsables: Carga de archivos, capacitación post-entrega

---

## 10. Comunicación y Revisiones

| Tipo | Canal | Frecuencia | Tiempo respuesta |
|------|-------|-----------|-----------------|
| **Consultas operativas** | WhatsApp/Telegram | Diaria | 4 horas hábiles |
| **Revisiones semanales** | Videollamada (Meet/Zoom) | Todos los viernes 3pm | Agendada |
| **Entrega de archivos** | Correo / Google Drive | Según cronograma | Día acordado |
| **Cambios de alcance** | Correo formal | Ad-hoc | 24 horas hábiles |

---

## Aprobación

| Rol | Nombre | Firma | Fecha |
|-----|--------|-------|------|
| Desarrollo | | | |
| Cliente (Interlocutor) | | | |
| Cliente (Dirección Médica) | | | |

---

**Documento válido por:** 30 días calendario desde la firma

**Versión:** 1.0 | **Fecha:** 14 de abril de 2026
