"""
etl_medicos.py
Carga el catálogo de médicos desde 'BD profesionales TXT.xlsx' a la tabla medicos.
Es idempotente: se puede ejecutar múltiples veces sin duplicar datos.

Uso:
    python etl_medicos.py
    python etl_medicos.py --archivo "ruta/alternativa.xlsx"
"""
import sys
import argparse
from pathlib import Path
import pandas as pd
from config import get_db_conn, DOCS_DIR


ARCHIVO_DEFAULT = DOCS_DIR / "BD profesionales TXT.xlsx"

# Mapeo exacto: columna del Excel → columna en la tabla medicos
COLUMNAS = {
    "USUARIO TXT":           "usuario_txt",
    "IDENTIFICACIÓN":        "identificacion",
    "NOMBRE":                "nombre",
    "ESTADO":                "estado",
    "PROGRAMA / ESPECIALIDAD": "programa_especialidad",
    "ÁREA":                  "area",
}


def cargar_medicos(archivo: Path) -> dict:
    print(f"[INFO] Leyendo: {archivo.name}")

    df = pd.read_excel(archivo, dtype=str, engine="openpyxl")

    # Limpiar nombres de columnas (espacios extra)
    df.columns = [c.strip() for c in df.columns]

    # Verificar columnas requeridas
    faltantes = [c for c in COLUMNAS if c not in df.columns]
    if faltantes:
        print(f"[ERROR] Columnas faltantes: {faltantes}")
        print(f"        Columnas disponibles: {list(df.columns)}")
        sys.exit(1)

    # Seleccionar y renombrar
    df = df[list(COLUMNAS.keys())].rename(columns=COLUMNAS)

    # Limpieza
    for col in df.columns:
        df[col] = df[col].str.strip().replace({"None": None, "nan": None, "": None})

    # Convertir identificacion a entero
    df["identificacion"] = pd.to_numeric(df["identificacion"], errors="coerce")

    # Eliminar filas sin identificacion
    antes = len(df)
    df = df.dropna(subset=["identificacion"])
    omitidas = antes - len(df)
    if omitidas:
        print(f"[WARN] {omitidas} fila(s) omitidas por identificacion nula")

    df["identificacion"] = df["identificacion"].astype("int64")

    # Si usuario_txt es nulo, usar identificacion como PK
    sin_usuario = df["usuario_txt"].isna()
    if sin_usuario.any():
        df.loc[sin_usuario, "usuario_txt"] = df.loc[sin_usuario, "identificacion"].astype(str)
        print(f"[INFO] {sin_usuario.sum()} registro(s) sin USUARIO TXT, usando identificacion")

    print(f"[INFO] {len(df)} médicos a procesar")

    conn = get_db_conn()
    cur = conn.cursor()

    insertados = 0
    actualizados = 0
    errores = 0

    for _, row in df.iterrows():
        try:
            cur.execute("""
                INSERT INTO medicos (usuario_txt, identificacion, nombre, estado, programa_especialidad, area)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (usuario_txt) DO UPDATE SET
                    identificacion        = EXCLUDED.identificacion,
                    nombre                = EXCLUDED.nombre,
                    estado                = EXCLUDED.estado,
                    programa_especialidad = EXCLUDED.programa_especialidad,
                    area                  = EXCLUDED.area
            """, (
                row["usuario_txt"],
                int(row["identificacion"]),
                row["nombre"],
                row["estado"] or "ACTIVO",
                row["programa_especialidad"],
                row["area"],
            ))
            # xmax = 0 significa INSERT, > 0 significa UPDATE
            if cur.rowcount > 0:
                insertados += 1
        except Exception as e:
            errores += 1
            print(f"[WARN] Error en fila {row['usuario_txt']}: {e}")

    conn.commit()

    # Contar total en BD
    cur.execute("SELECT COUNT(*) FROM medicos")
    total_bd = cur.fetchone()[0]

    cur.close()
    conn.close()

    resultado = {
        "archivo": archivo.name,
        "filas_procesadas": len(df),
        "registros_en_bd": total_bd,
        "errores": errores,
    }

    print()
    print("=" * 50)
    print(f"  Filas procesadas : {len(df)}")
    print(f"  Total en BD      : {total_bd}")
    print(f"  Errores          : {errores}")
    print("=" * 50)
    print("[OK] Carga de medicos completada")

    return resultado


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Carga catalogo de medicos")
    parser.add_argument("--archivo", type=str, default=None,
                        help="Ruta al archivo Excel de profesionales")
    args = parser.parse_args()

    archivo = Path(args.archivo) if args.archivo else ARCHIVO_DEFAULT

    if not archivo.exists():
        print(f"[ERROR] Archivo no encontrado: {archivo}")
        sys.exit(1)

    cargar_medicos(archivo)
