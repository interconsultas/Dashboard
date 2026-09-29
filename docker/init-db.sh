#!/bin/bash
set -e

echo "=== Inicializando base de datos ==="

DB_NAME="${APP_DB_NAME:-interconsultas}"
DB_USER="${APP_DB_USER:-ips_user}"
DB_PASS="${APP_DB_PASSWORD:-ips_password}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
            CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
        END IF;
    END
    \$\$;

    SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

    GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
EOSQL

echo "=== Ejecutando migraciones SQL ==="

for f in /sql/001_create_tables.sql \
         /sql/002_create_indexes.sql \
         /sql/003_create_views.sql \
         /sql/004_seed_usuarios.sql \
         /sql/005_estado_medico_null_to_externo.sql \
         /sql/006_create_subviews.sql; do
    echo "  -> $(basename "$f")"
    psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" -f "$f"
done

echo "  -> 007_refresh_views.sql (tolerante a errores)"
psql --username "$DB_USER" --dbname "$DB_NAME" -f /sql/007_refresh_views.sql || \
    echo "  ⚠ Refresh de vistas omitido (normal en BD vacía)"

echo "=== Base de datos lista ==="
