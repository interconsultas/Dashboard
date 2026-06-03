"""
Configuración centralizada del ETL.
Lee variables de entorno desde el archivo .env.
"""
import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

# Cargar .env desde la misma carpeta de este script
BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "127.0.0.1"),
    "port":     int(os.getenv("DB_PORT", 5432)),
    "dbname":   os.getenv("DB_NAME", "interconsultas_dev"),
    "user":     os.getenv("DB_USER", "ips_user"),
    "password": os.getenv("DB_PASSWORD", ""),
}

# Ruta base del proyecto (un nivel arriba de /etl)
PROJECT_ROOT = BASE_DIR.parent
DOCS_DIR     = PROJECT_ROOT / "docs"

def get_db_conn():
    """Retorna una conexión psycopg2 a la base de datos configurada."""
    return psycopg2.connect(**DB_CONFIG)


if __name__ == "__main__":
    # Prueba de conexión
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        print("[OK] CONEXION EXITOSA")
        print(f"     {version}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[ERROR] Conexion fallida: {e}")
