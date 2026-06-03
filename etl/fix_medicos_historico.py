"""
fix_medicos_historico.py
Corrige nombre_medico, estado_medico y programa_especialidad en autorizaciones
usando los DETALLADOS AJUSTADOS como fuente de verdad histórica.

Uso:
  python fix_medicos_historico.py --todos              # corregir todos los periodos
  python fix_medicos_historico.py --todos --dry-run     # solo reportar diferencias
  python fix_medicos_historico.py --archivo "docs/DETALLADOS AJUSTADOS/2026/202603 Detallado autorizaciones.xlsx"
"""

import argparse
import hashlib
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg2.extras

sys.path.insert(0, str(Path(__file__).parent))
from config import get_db_conn, DOCS_DIR

AJUSTADOS_DIR = DOCS_DIR / "DETALLADOS AJUSTADOS"

COLS_MATCH = ["Numero_Consec_Orden_Serie", "Numero_Consec_Evento",
              "CODIGO_PRESTACION_OP", "PERIODO"]

COL_MAP = {
    "NOMBRE": "nombre",
    "ESTADO": "estado",
    "PROGRAMA / ESPECIALIDAD": "programa",
}


def leer_ajustado(archivo: Path) -> pd.DataFrame:
    try:
        df = pd.read_excel(archivo, dtype=str, engine="calamine")
    except Exception:
        df = pd.read_excel(archivo, dtype=str, engine="openpyxl")

    df.columns = [c.strip() for c in df.columns]

    for col in COLS_MATCH:
        if col not in df.columns:
            raise ValueError(f"Columna '{col}' faltante en {archivo.name}")
    for col in COL_MAP:
        if col not in df.columns:
            raise ValueError(f"Columna '{col}' faltante en {archivo.name}")

    if "CODIGO_SUCURSAL_AFILIADO" in df.columns:
        mask = df["CODIGO_SUCURSAL_AFILIADO"].astype(str).str.contains("1712", na=False)
        df = df[mask].reset_index(drop=True)

    df["PERIODO"] = pd.to_numeric(df["PERIODO"], errors="coerce").astype("Int64")

    for col in ["NOMBRE", "ESTADO", "PROGRAMA / ESPECIALIDAD"]:
        df[col] = df[col].str.strip()
        df[col] = df[col].replace({"None": None, "nan": None, "NaN": None, "": None, "#N/D": None})

    df["ESTADO"] = df["ESTADO"].fillna("EXTERNO")
    df["NOMBRE"] = df["NOMBRE"].str.upper()

    concat = (
        df["Numero_Consec_Orden_Serie"].astype(str) + "|" +
        df["Numero_Consec_Evento"].astype(str) + "|" +
        df["CODIGO_PRESTACION_OP"].astype(str) + "|" +
        df["PERIODO"].astype(str)
    )
    df["hash_fila"] = np.vectorize(
        lambda s: hashlib.sha256(s.encode()).hexdigest()
    )(concat.to_numpy())

    return df[["hash_fila", "PERIODO", "NOMBRE", "ESTADO", "PROGRAMA / ESPECIALIDAD"]]


def corregir_periodo(conn, df: pd.DataFrame, dry_run: bool) -> dict:
    periodos = sorted(df["PERIODO"].dropna().unique().tolist())
    periodo_label = ", ".join(str(p) for p in periodos)

    cur = conn.cursor()

    cur.execute("""
        CREATE TEMP TABLE IF NOT EXISTS tmp_correccion (
            hash_fila   CHAR(64),
            periodo     INT,
            nombre      VARCHAR(150),
            estado      VARCHAR(20),
            programa    VARCHAR(100)
        ) ON COMMIT DELETE ROWS
    """)

    registros = []
    for _, row in df.iterrows():
        registros.append((
            row["hash_fila"],
            int(row["PERIODO"]) if pd.notna(row["PERIODO"]) else None,
            row["NOMBRE"] if pd.notna(row["NOMBRE"]) else None,
            row["ESTADO"] if pd.notna(row["ESTADO"]) else None,
            row["PROGRAMA / ESPECIALIDAD"] if pd.notna(row["PROGRAMA / ESPECIALIDAD"]) else None,
        ))

    psycopg2.extras.execute_values(
        cur,
        "INSERT INTO tmp_correccion (hash_fila, periodo, nombre, estado, programa) VALUES %s",
        registros,
        page_size=5000,
    )

    cur.execute("""
        SELECT COUNT(*) FROM autorizaciones a
        JOIN tmp_correccion t ON a.hash_fila = t.hash_fila AND a.periodo = t.periodo
        WHERE a.nombre_medico IS DISTINCT FROM t.nombre
           OR a.estado_medico IS DISTINCT FROM t.estado
           OR a.programa_especialidad IS DISTINCT FROM t.programa
    """)
    diferencias = cur.fetchone()[0]

    detalle = []
    if diferencias > 0:
        cur.execute("""
            SELECT a.periodo, a.hash_fila,
                   a.nombre_medico AS nombre_actual, t.nombre AS nombre_nuevo,
                   a.estado_medico AS estado_actual, t.estado AS estado_nuevo,
                   a.programa_especialidad AS programa_actual, t.programa AS programa_nuevo
            FROM autorizaciones a
            JOIN tmp_correccion t ON a.hash_fila = t.hash_fila AND a.periodo = t.periodo
            WHERE a.nombre_medico IS DISTINCT FROM t.nombre
               OR a.estado_medico IS DISTINCT FROM t.estado
               OR a.programa_especialidad IS DISTINCT FROM t.programa
            LIMIT 20
        """)
        detalle = cur.fetchall()

    actualizados = 0
    if not dry_run and diferencias > 0:
        cur.execute("""
            UPDATE autorizaciones a
            SET nombre_medico = t.nombre,
                estado_medico = t.estado,
                programa_especialidad = t.programa
            FROM tmp_correccion t
            WHERE a.hash_fila = t.hash_fila
              AND a.periodo = t.periodo
              AND (
                a.nombre_medico IS DISTINCT FROM t.nombre
                OR a.estado_medico IS DISTINCT FROM t.estado
                OR a.programa_especialidad IS DISTINCT FROM t.programa
              )
        """)
        actualizados = cur.rowcount
        conn.commit()
    else:
        conn.rollback()

    cur.close()

    return {
        "periodos": periodo_label,
        "total_archivo": len(df),
        "diferencias": diferencias,
        "actualizados": actualizados,
        "detalle_muestra": detalle,
    }


def buscar_archivos() -> list[Path]:
    archivos = sorted(AJUSTADOS_DIR.rglob("*.xlsx"))
    return [a for a in archivos if not a.name.startswith("~$")]


def main():
    parser = argparse.ArgumentParser(description="Corregir datos históricos de profesionales")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--todos", action="store_true", help="Procesar todos los DETALLADOS AJUSTADOS")
    group.add_argument("--archivo", type=str, help="Ruta a un archivo específico")
    parser.add_argument("--dry-run", action="store_true", help="Solo reportar diferencias, no actualizar")
    args = parser.parse_args()

    if args.archivo:
        archivos = [Path(args.archivo)]
        if not archivos[0].exists():
            print(f"[ERROR] Archivo no encontrado: {args.archivo}")
            sys.exit(1)
    else:
        archivos = buscar_archivos()
        if not archivos:
            print(f"[ERROR] No se encontraron archivos en {AJUSTADOS_DIR}")
            sys.exit(1)

    print(f"{'[DRY-RUN] ' if args.dry_run else ''}Procesando {len(archivos)} archivo(s)...")
    print("=" * 80)

    conn = get_db_conn()
    total_diferencias = 0
    total_actualizados = 0

    for archivo in archivos:
        t0 = time.time()
        print(f"\n[INFO] {archivo.name}")

        try:
            df = leer_ajustado(archivo)
        except Exception as e:
            print(f"  [ERROR] {e}")
            continue

        print(f"  Filas: {len(df):,}")

        resultado = corregir_periodo(conn, df, args.dry_run)
        elapsed = time.time() - t0

        total_diferencias += resultado["diferencias"]
        total_actualizados += resultado["actualizados"]

        if resultado["diferencias"] == 0:
            print(f"  Sin diferencias ({elapsed:.1f}s)")
        else:
            action = "encontradas" if args.dry_run else "corregidas"
            print(f"  Diferencias {action}: {resultado['diferencias']:,} / {resultado['total_archivo']:,} ({elapsed:.1f}s)")

            if resultado["detalle_muestra"]:
                print(f"  Muestra de cambios (max 20):")
                for row in resultado["detalle_muestra"][:10]:
                    periodo, hash_f, nom_act, nom_new, est_act, est_new, prog_act, prog_new = row
                    cambios = []
                    if nom_act != nom_new:
                        cambios.append(f"nombre: {nom_act} -> {nom_new}")
                    if est_act != est_new:
                        cambios.append(f"estado: {est_act} -> {est_new}")
                    if prog_act != prog_new:
                        cambios.append(f"programa: {prog_act} -> {prog_new}")
                    print(f"    [{periodo}] {' | '.join(cambios)}")

    conn.close()

    print("\n" + "=" * 80)
    print(f"RESUMEN: {total_diferencias:,} diferencias, {total_actualizados:,} actualizados")
    if args.dry_run and total_diferencias > 0:
        print("Ejecutar sin --dry-run para aplicar las correcciones.")


if __name__ == "__main__":
    main()
