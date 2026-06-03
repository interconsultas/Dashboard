# Interconsultas — Dashboard de Autorizaciones IPS

## Arquitectura

Monorepo con dos componentes:

- **dashboard/** — Next.js 14 (App Router) con NextAuth 5 beta, PostgreSQL (pg), Recharts, TailwindCSS
- **etl/** — Python 3.12 (pandas, psycopg2, openpyxl) que procesa archivos Excel de autorizaciones

El dashboard invoca al ETL vía `child_process.spawn()` en `dashboard/src/lib/etl-spawn.ts`. En Docker, ambos corren en el mismo contenedor.

## Base de datos

PostgreSQL 16. Tabla principal `autorizaciones` particionada por `periodo` (YYYYMM). 8 vistas materializadas (`vm_*`) para analítica. Migraciones en `etl/sql/001-007`.

## Roles de usuario

- `admin` — Gestión completa (carga, usuarios, médicos)
- `direccion_medica` — Dashboard + métricas médicas
- `coordinador` — Dashboard filtrado por regional

## Desarrollo local

```bash
# ETL
cd etl
python -m venv venv && venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env  # completar valores

# Dashboard
cd dashboard
npm install
cp .env.example .env.local  # completar DATABASE_URL
npm run dev
```

## Tests

```bash
# Python
cd etl && python -m pytest tests/ -v

# Dashboard
cd dashboard && npx jest
```

## Docker (producción)

```bash
cp .env.production.example .env.production
# Editar .env.production con valores reales
docker-compose --env-file .env.production up -d
```

## Variables de entorno clave

- `DATABASE_URL` — Conexión PostgreSQL para el dashboard
- `PYTHON_PATH`, `ETL_SCRIPT_PATH`, `UPLOADS_DIR`, `ETL_LOGS_DIR` — Rutas para el spawn del ETL
- `NEXTAUTH_SECRET` — Secreto JWT (mínimo 32 caracteres)
