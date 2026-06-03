"""
dedup.py
Utilidades de hashing para deduplicacion en dos niveles:
  1. Hash del archivo binario    → evita recargar el mismo archivo
  2. Hash por fila (SHA-256)     → evita duplicar registros dentro de la BD
"""

import hashlib
from pathlib import Path

import pandas as pd


# ─────────────────────────────────────────────────────────────────────────────
# Nivel 1 — hash del archivo completo
# ─────────────────────────────────────────────────────────────────────────────

def hash_archivo(ruta: Path, chunk_bytes: int = 65536) -> str:
    """
    Calcula el SHA-256 del archivo en disco leyendo en bloques para no
    cargar archivos de 150 MB completos en memoria.
    Retorna la cadena hexadecimal de 64 caracteres.
    """
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        while True:
            bloque = f.read(chunk_bytes)
            if not bloque:
                break
            h.update(bloque)
    return h.hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# Nivel 2 — hash por fila
# ─────────────────────────────────────────────────────────────────────────────

# Columnas que identifican de forma unívoca un registro de autorización.
# Usamos las mismas que formarían una PK natural en el esquema del negocio.
_COLS_HASH = [
    "Numero_Consec_Orden_Serie",
    "Numero_Consec_Evento",
    "CODIGO_PRESTACION_OP",
    "PERIODO",
]


def calcular_hash_filas(df: pd.DataFrame) -> pd.Series:
    """
    Genera una Series con el SHA-256 de cada fila del DataFrame.
    Concatena los valores de _COLS_HASH separados por '|' y los hashea.
    Las columnas deben existir en df; se convierten a str antes de hashear.

    Retorna una pd.Series de strings hexadecimales (64 chars c/u).
    """
    # Construir cadena de identificación por fila
    cols_presentes = [c for c in _COLS_HASH if c in df.columns]
    if not cols_presentes:
        raise ValueError(
            f"Ninguna columna de hash encontrada en el DataFrame. "
            f"Se esperaban: {_COLS_HASH}"
        )

    concat_series = df[cols_presentes[0]].astype(str)
    for col in cols_presentes[1:]:
        concat_series = concat_series + "|" + df[col].astype(str)

    return concat_series.apply(
        lambda s: hashlib.sha256(s.encode("utf-8")).hexdigest()
    )
