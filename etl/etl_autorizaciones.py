"""
etl_autorizaciones.py
ETL principal: DETALLADOS EPS  →  normalizar  →  staging  →  autorizaciones

Modos de uso
────────────
  # Paso 1 — previsualizar (no escribe en autorizaciones, solo en staging)
  python etl_autorizaciones.py --preview --archivo "ruta/archivo.xlsx"

  # Paso 2 — confirmar (mueve de staging a autorizaciones)
  python etl_autorizaciones.py --confirm <job_id>

  # Carga directa (preview + confirm en un solo paso, util en CLI masivo)
  python etl_autorizaciones.py --directo --archivo "ruta/archivo.xlsx"

  # Forzar recarga de un archivo ya procesado
  python etl_autorizaciones.py --preview --archivo "..." --force

  # Override de periodo (YYYYMM) cuando no se puede detectar del nombre
  python etl_autorizaciones.py --preview --archivo "..." --periodo 202603
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import uuid
from pathlib import Path

import pandas as pd
import psycopg2.extras

# ─── proyecto ────────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
from config import get_db_conn
from utils.validators import (
    COLUMNAS_ELIMINAR,
    USUARIOS_ESPECIALES,
    validar_columnas,
)
from utils.dedup import hash_archivo
from utils.reporters import (
    construir_informe,
    informe_error_fatal,
    imprimir_resumen,
)


# ─────────────────────────────────────────────────────────────────────────────
# Columnas que se agregan al normalizar EPS → AJUSTADOS
# (vienen del JOIN con tabla medicos por NUMERO_REMITE = identificacion)
# ─────────────────────────────────────────────────────────────────────────────
COLUMNAS_PLACEHOLDER = {
    "FECHA_PROGRAMACION":            None,
    "FECHA_ATENCION":                None,
    "CODIGO_ESPECIALIDAD_OP_REMITE": None,
    "ESPECIALIDAD_DESC_REMITE":      None,
}

# Mapeo DataFrame (post-rename) → columna en staging / autorizaciones
# Orden respeta el de la tabla staging_autorizaciones
COLUMNAS_STAGING_ORDERED = [
    # bigint / enteros
    "afiliado_id",
    "codigo_tipo_documento",
    "numero_documento",
    "fecha_nacimiento",
    "edad",
    "primer_apellido",
    "segundo_apellido",
    "primer_nombre",
    "segundo_nombre",
    "cod_regional_afiliado",
    "desc_regional_afiliado",
    "ciudad_afiliado",
    "sexo",
    "ind_cotizante",
    "codigo_nivel_ingreso",
    "codigo_sucursal_afiliado",
    "descripcion_sucursal_afiliado",
    "cod_regional_ips_afiliado",
    "desc_regional_ips_afiliado",
    "numero_consec_orden_serie",
    "numero_consec_evento",
    "codigo_prestacion",
    "descripcion_prestacion",
    "agrup_salud_prest_desc",
    "orden_agrup_prest_desc",
    "periodo",
    "fecha_digitacion",
    "fecha_emision",
    "fecha_atencion_ivr",
    "fecha_programacion",
    "fecha_atencion",
    "codigo_diagnostico",
    "diagnostico_desc",
    "codigo_sucursal_emite",
    "descripcion_sucursal_emite",
    "tipo_remite",
    "numero_remite",
    "prestador_remite",
    "codigo_especialidad_remite",
    "especialidad_desc_remite",
    "usuario_txt",
    "nombre_medico",
    "estado_medico",
    "programa_especialidad",
    "area_medico",
    "codigo_sucursal_atiende",
    "descripcion_sucursal_atiende",
    "codigo_tipo_ident_atiende",
    "num_ident_prestador_atiende",
    "descripcion_prestador_atiende",
    "tipo_prestacion_desc",
    "origen_servicio_desc",
    "producto_pac_eps_desc",
    "estado_autorizacion_desc",
    "tipo_convenio_desc",
    "origen_autorizacion_desc",
    "tipo_evento_desc",
    "tipo_cobro_desc",
    "cantidad_autorizada",
    "valor_autorizado_prestacion",
    "valor_provision",
    "hash_fila",
]

# Mapeo EPS (nombre original) → nombre en BD (snake_case)
MAPA_COLUMNAS: dict[str, str] = {
    "Afiliado_Id":                      "afiliado_id",
    "CODIGO_TIPO_DOCUMENTO_OP":         "codigo_tipo_documento",
    "NUMERO_DE_DOCUMENTO":              "numero_documento",
    "Fecha_Nacimiento":                 "fecha_nacimiento",
    "Edad_Cd":                          "edad",
    "Primer_Apellido":                  "primer_apellido",
    "Segundo_Apellido":                 "segundo_apellido",
    "Primer_Nombre":                    "primer_nombre",
    "Segundo_Nombre":                   "segundo_nombre",
    "COD_REGIONAL_AFILIADO":            "cod_regional_afiliado",
    "DESC_REGIONAL_AFILIADO":           "desc_regional_afiliado",
    "CIUDAD_AFILIADO":                  "ciudad_afiliado",
    "Sexo_Cd":                          "sexo",
    "Ind_Cotizante":                    "ind_cotizante",
    "CODIGO_NIVEL_INGRESO_OP":          "codigo_nivel_ingreso",
    "CODIGO_SUCURSAL_AFILIADO":         "codigo_sucursal_afiliado",
    "DESCRIPCION_SUCURSAL_AFILIADO":    "descripcion_sucursal_afiliado",
    "COD_REGIONAL_IPS_AFILIADO":        "cod_regional_ips_afiliado",
    "DESC_REGIONAL_IPS_AFILIADO":       "desc_regional_ips_afiliado",
    "Numero_Consec_Orden_Serie":        "numero_consec_orden_serie",
    "Numero_Consec_Evento":             "numero_consec_evento",
    "CODIGO_PRESTACION_OP":             "codigo_prestacion",
    "DESCRIPCION_PRESTACION":           "descripcion_prestacion",
    "Agrup_Salud_Prest_Desc":           "agrup_salud_prest_desc",
    "Orden_Agrup_Prest_Desc":           "orden_agrup_prest_desc",
    "PERIODO":                          "periodo",
    "Fecha_Emision":                    "fecha_emision",
    "Fecha_Atencion_Prestacion_IVR":    "fecha_atencion_ivr",
    "FECHA_PROGRAMACION":               "fecha_programacion",
    "FECHA_ATENCION":                   "fecha_atencion",
    "fecha_digitacion":                 "fecha_digitacion",
    "Codigo_Diagnostico_EPS_Op":        "codigo_diagnostico",
    "Diagnostico_EPS_Desc":             "diagnostico_desc",
    "CODIGO_SUCURSAL_EMITE":            "codigo_sucursal_emite",
    "DESCRIPCION_SUCURSAL_EMITE":       "descripcion_sucursal_emite",
    "TIPO_REMITE":                      "tipo_remite",
    "NUMERO_REMITE":                    "numero_remite",
    "PRESTADOR_REMITE":                 "prestador_remite",
    "CODIGO_SUCURSAL_ATIENDE":          "codigo_sucursal_atiende",
    "DESCRIPCION_SUCURSAL_ATIENDE":     "descripcion_sucursal_atiende",
    "CODIGO_TIPO_IDENT_ATIENDE":        "codigo_tipo_ident_atiende",
    "NUM_IDENT_PRESTADOR_ATIENDE":      "num_ident_prestador_atiende",
    "DESCRIPCION_PRESTADOR_ATIENDE":    "descripcion_prestador_atiende",
    "CODIGO_ESPECIALIDAD_OP_REMITE":    "codigo_especialidad_remite",
    "ESPECIALIDAD_DESC_REMITE":         "especialidad_desc_remite",
    "Tipo_Prestacion_Desc":             "tipo_prestacion_desc",
    "Origen_Servicio_Desc":             "origen_servicio_desc",
    "Producto_PAC_EPS_Desc":            "producto_pac_eps_desc",
    "Estado_Autorizacion_Desc":         "estado_autorizacion_desc",
    "Tipo_Convenio_Desc":               "tipo_convenio_desc",
    "Origen_autorizacion_Desc":         "origen_autorizacion_desc",
    "Tipo_Evento_Desc":                 "tipo_evento_desc",
    "Tipo_Cobro_Desc":                  "tipo_cobro_desc",
    "USUARIO_TXT":                      "usuario_txt",
    "CANTIDAD_AUTORIZADA":              "cantidad_autorizada",
    "Valor_Autorizado_Prestacion":      "valor_autorizado_prestacion",
    "Valor_Provision":                  "valor_provision",
    # Derivadas de medicos
    "NOMBRE":                           "nombre_medico",
    "ESTADO_MEDICO":                    "estado_medico",
    "PROGRAMA_ESPECIALIDAD":            "programa_especialidad",
    "AREA":                             "area_medico",
    # Aliases para archivos normalizados (DETALLADOS AJUSTADOS)
    "ESTADO":                           "estado_medico",
    "PROGRAMA / ESPECIALIDAD":          "programa_especialidad",
    "ÁREA":                              "area_medico",      # ÁREA con tilde
    "Fecha_Digitacion":                 "fecha_digitacion",
}

# Columnas de fecha a parsear con pd.to_datetime
COLS_FECHA = ["Fecha_Nacimiento", "Fecha_Emision", "Fecha_Atencion_Prestacion_IVR", "Fecha_Digitacion", "FECHA_PROGRAMACION", "FECHA_ATENCION"]

# Columnas numéricas a parsear
COLS_NUMERICAS_FLOAT = ["Valor_Autorizado_Prestacion", "Valor_Provision"]
COLS_NUMERICAS_INT   = [
    "CANTIDAD_AUTORIZADA", "Edad_Cd",
    "COD_REGIONAL_AFILIADO", "COD_REGIONAL_IPS_AFILIADO",
    "CODIGO_SUCURSAL_AFILIADO", "Numero_Consec_Evento",
    "CODIGO_SUCURSAL_EMITE", "CODIGO_SUCURSAL_ATIENDE",
    "NUMERO_REMITE", "NUM_IDENT_PRESTADOR_ATIENDE",
    "Afiliado_Id", "NUMERO_DE_DOCUMENTO",
]

# Columnas de texto que se convierten a UPPER
COLS_UPPER = [
    "Primer_Apellido", "Segundo_Apellido", "Primer_Nombre", "Segundo_Nombre",
    "DESCRIPCION_PRESTACION", "Diagnostico_EPS_Desc",
    "DESCRIPCION_PRESTADOR_ATIENDE", "DESC_REGIONAL_AFILIADO", "CIUDAD_AFILIADO",
]

# Tamaño del lote para execute_values
BATCH_SIZE = 5_000

# Filas de muestra en el preview
PREVIEW_SAMPLE_ROWS = 20


# ─────────────────────────────────────────────────────────────────────────────
# Parseo robusto de fechas (soporta números seriales de Excel + strings)
# ─────────────────────────────────────────────────────────────────────────────

def _parsear_fecha(serie: pd.Series) -> pd.Series:
    """Parsea una columna de fechas que puede contener seriales Excel, ISO, DD/MM/YYYY, etc."""
    import numpy as np

    n = len(serie)
    # Trabajar con array int64 de nanoseconds; iNaT para valores faltantes
    iNaT = np.int64(pd.NaT._value)  # noqa: N806
    result_ns = np.full(n, iNaT, dtype="int64")

    notna_mask = serie.notna().values
    if not notna_mask.any():
        return pd.Series(
            result_ns.view("datetime64[ns]").copy(), index=serie.index
        )

    txt = serie[notna_mask].astype(str)
    notna_idx = np.where(notna_mask)[0]

    # ── Seriales de Excel (30000..60000) ──
    numerico = pd.to_numeric(txt, errors="coerce")
    es_serial = (numerico.notna() & numerico.between(30_000, 60_000)).values

    if es_serial.any():
        serial_vals = numerico.values[es_serial]
        ts = (
            pd.to_timedelta(pd.Series(serial_vals) - 2, unit="D")
            + pd.Timestamp("1900-01-01")
        )
        valid = ts.notna().values
        positions = notna_idx[es_serial][valid]
        ts_arr = np.asarray(ts.values[valid])
        if ts_arr.dtype.kind == "M":
            result_ns[positions] = ts_arr.astype("datetime64[ns]").view("int64")
        else:
            result_ns[positions] = ts_arr.view("int64")

    # ── Texto: ISO y dayfirst ──
    texto_mask = ~es_serial
    if texto_mask.any():
        texto = txt.iloc[np.where(texto_mask)[0]]
        es_iso = texto.str.match(r"^\d{4}-\d{2}-\d{2}", na=False).values

        def _safe_to_datetime(s, **kw):
            """pd.to_datetime con proteccion contra OutOfBoundsDatetime."""
            try:
                return pd.to_datetime(s, errors="coerce", format="mixed", **kw)
            except Exception:
                # Fallback: parsear uno a uno
                result = pd.Series(pd.NaT, index=s.index, dtype="datetime64[ns]")
                for idx, val in s.items():
                    try:
                        result.at[idx] = pd.to_datetime(val, errors="coerce", **kw)
                    except Exception:
                        pass
                return result

        def _to_ns(dt_values):
            """Convierte datetime64 array a int64 nanoseconds, sea cual sea la resolucion."""
            arr = np.asarray(dt_values)
            if arr.dtype.kind == "M":
                return arr.astype("datetime64[ns]").view("int64")
            return arr.view("int64")

        if es_iso.any():
            iso_vals = texto.iloc[np.where(es_iso)[0]]
            parsed = _safe_to_datetime(iso_vals, dayfirst=False)
            valid = parsed.notna().values
            if valid.any():
                positions = notna_idx[texto_mask][es_iso][valid]
                result_ns[positions] = _to_ns(parsed.values[valid])

        if (~es_iso).any():
            day_vals = texto.iloc[np.where(~es_iso)[0]]
            # Filtrar valores tipo '206-11-03' (3 digitos = año < 1000, overflow en ns)
            valid_day = ~day_vals.str.match(r"^\d{3}[-/]", na=False)
            day_vals = day_vals[valid_day]
            if day_vals.empty:
                parsed = pd.Series(dtype="datetime64[ns]")
            else:
                parsed = _safe_to_datetime(day_vals, dayfirst=True)
            valid = parsed.notna().values
            if valid.any():
                # Recalcular posiciones considerando el filtro valid_day
                day_positions = notna_idx[texto_mask][~es_iso][valid_day.values]
                result_ns[day_positions[valid]] = _to_ns(parsed.values[valid])

    # ── Filtrar fuera de rango (antes de 1900 o despues de 2100) ──
    valid_mask = result_ns != iNaT
    if valid_mask.any():
        ts_1900 = np.datetime64("1900-01-01", "ns").view("int64")
        ts_2100 = np.datetime64("2100-12-31", "ns").view("int64")
        out_of_range = valid_mask & ((result_ns < ts_1900) | (result_ns > ts_2100))
        result_ns[out_of_range] = iNaT

    return pd.Series(
        result_ns.view("datetime64[ns]").copy(), index=serie.index
    )


# ─────────────────────────────────────────────────────────────────────────────
# Detección de periodo desde nombre del archivo
# ─────────────────────────────────────────────────────────────────────────────

def detectar_periodo(nombre_archivo: str) -> int | None:
    """
    Busca YYYYMM en el nombre del archivo.
    Acepta: '202603 Detallado...', '2026-03-02 al 2026-03-08', etc.
    """
    patron = re.search(r"(20\d{2})[_\-\s]?(0[1-9]|1[0-2])", nombre_archivo)
    if patron:
        return int(f"{patron.group(1)}{patron.group(2)}")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Catálogo de médicos en memoria
# ─────────────────────────────────────────────────────────────────────────────

def cargar_catalogo_medicos(conn) -> tuple[dict[str, dict], dict[str, dict]]:
    """
    Retorna dos diccionarios que apuntan a los mismos registros:

      catalogo_nombre  : {nombre_upper: registro}
      catalogo_usuario : {usuario_txt_upper: registro}

    catalogo_nombre replica el VLOOKUP del detallado ajustado (cruce por
    nombre del profesional).  catalogo_usuario permite resolver el médico
    cuando PRESTADOR_REMITE es un nombre de institución pero USUARIO_TXT
    identifica al profesional real.
    """
    cur = conn.cursor()
    cur.execute("""
        SELECT usuario_txt, identificacion::text, nombre,
               estado, programa_especialidad, area
        FROM medicos
    """)
    catalogo_nombre:  dict[str, dict] = {}
    catalogo_usuario: dict[str, dict] = {}
    for row in cur.fetchall():
        registro = {
            "usuario_txt":           row[0],
            "identificacion":        row[1],
            "nombre":                row[2],
            "estado":                row[3] or "ACTIVO",
            "programa_especialidad": row[4],
            "area":                  row[5],
        }
        nombre_key = (row[2] or "").strip().upper()
        if nombre_key:
            catalogo_nombre[nombre_key] = registro
        usuario_key = (row[0] or "").strip().upper()
        if usuario_key:
            catalogo_usuario[usuario_key] = registro
    cur.close()
    return catalogo_nombre, catalogo_usuario


# ─────────────────────────────────────────────────────────────────────────────
# Paso 1 — leer y limpiar
# ─────────────────────────────────────────────────────────────────────────────

def leer_y_limpiar(
    archivo: Path,
    periodo_override: int | None = None,
) -> tuple[pd.DataFrame, dict]:
    contadores = {
        "filas_en_archivo":             0,
        "fechas_invalidas":             0,
        "ejemplos_fechas_invalidas":    [],
        "valores_invalidos":            0,
        "periodo_detectado":            None,
    }

    print(f"[INFO] Leyendo: {archivo.name}")
    try:
        try:
            df = pd.read_excel(archivo, dtype=str, engine="calamine")
        except Exception:
            df = pd.read_excel(archivo, dtype=str, engine="openpyxl")
    except Exception as e:
        raise RuntimeError(f"No se pudo leer el archivo: {e}") from e

    df.columns = [c.strip() for c in df.columns]
    contadores["filas_en_archivo"] = len(df)
    print(f"[INFO] Filas: {len(df):,} | Columnas: {len(df.columns)}")

    # ── Validar estructura ────────────────────────────────────────────────────
    val = validar_columnas(list(df.columns))
    if not val["ok"]:
        raise ValueError(f"Columnas faltantes: {val['faltantes']}")
    if val["extra"]:
        print(f"[INFO] Columnas extra (se ignoraran): {val['extra']}")

    # ── Eliminar columnas no requeridas ───────────────────────────────────────
    eliminar = [c for c in df.columns
                if c.strip() in COLUMNAS_ELIMINAR]
    df.drop(columns=eliminar, errors="ignore", inplace=True)

    # ── Detectar periodo ──────────────────────────────────────────────────────
    periodo_fallback = periodo_override or detectar_periodo(archivo.name)

    if "PERIODO" in df.columns:
        df["PERIODO"] = pd.to_numeric(df["PERIODO"], errors="coerce")
        if periodo_fallback is not None:
            df["PERIODO"] = df["PERIODO"].fillna(periodo_fallback)
    else:
        if periodo_fallback is None:
            raise ValueError(
                "No se pudo detectar el periodo YYYYMM. Use --periodo YYYYMM."
            )
        df["PERIODO"] = periodo_fallback

    df["PERIODO"] = df["PERIODO"].astype("Int64")
    periodos_unicos = df["PERIODO"].dropna().unique().tolist()
    periodo = periodos_unicos[0] if len(periodos_unicos) == 1 else periodos_unicos
    contadores["periodo_detectado"] = periodo
    if len(periodos_unicos) > 1:
        print(f"[INFO] Multiples periodos detectados: {sorted(periodos_unicos)}")

    # ── Limpieza general de texto ─────────────────────────────────────────────
    str_cols = df.select_dtypes(include=["object", "string"]).columns
    for col in str_cols:
        df[col] = df[col].str.strip()
        df[col] = df[col].replace(
            {"None": None, "nan": None, "NaN": None, "": None, "?": None}
        )

    # ── Texto a UPPER ─────────────────────────────────────────────────────────
    for col in COLS_UPPER:
        if col in df.columns:
            df[col] = df[col].str.upper()

    # ── Filtrar por CODIGO_SUCURSAL_AFILIADO ─────────────────────────────────
    if "CODIGO_SUCURSAL_AFILIADO" in df.columns:
        mask = df["CODIGO_SUCURSAL_AFILIADO"].astype(str).str.contains("1712", na=False)
        filas_antes = len(df)
        df = df[mask].reset_index(drop=True)
        print(f"[INFO] Filtro CODIGO_SUCURSAL_AFILIADO (1712): {filas_antes:,} -> {len(df):,} filas")

    # ── Parseo de fechas ──────────────────────────────────────────────────────
    for col in COLS_FECHA:
        if col not in df.columns:
            df[col] = None
            continue
        nulos_antes = df[col].isna().sum()
        df[col] = _parsear_fecha(df[col])
        nuevos_nulos = int(df[col].isna().sum() - nulos_antes)
        if nuevos_nulos > 0:
            contadores["fechas_invalidas"] += nuevos_nulos
            if len(contadores["ejemplos_fechas_invalidas"]) < 5:
                malos = df[df[col].isna()].head(3)
                for _, fila in malos.iterrows():
                    contadores["ejemplos_fechas_invalidas"].append({
                        "columna":      col,
                        "consec_orden": str(fila.get("Numero_Consec_Orden_Serie")),
                    })

    # ── Parseo numérico float ─────────────────────────────────────────────────
    for col in COLS_NUMERICAS_FLOAT:
        if col not in df.columns:
            continue
        df[col] = df[col].astype(str).str.replace(",", ".", regex=False)
        nulos_antes = df[col].isna().sum()
        df[col] = pd.to_numeric(df[col], errors="coerce")
        contadores["valores_invalidos"] += int(df[col].isna().sum() - nulos_antes)

    # ── Parseo numérico int (se almacena como float para soportar NaN) ────────
    for col in COLS_NUMERICAS_INT:
        if col not in df.columns:
            continue
        df[col] = df[col].astype(str).str.replace(r"[^\d\-]", "", regex=True)
        nulos_antes = df[col].isna().sum()
        df[col] = pd.to_numeric(df[col], errors="coerce")
        contadores["valores_invalidos"] += int(df[col].isna().sum() - nulos_antes)

    # ── Columnas placeholder (no vienen del EPS) ─────────────────────────────
    for col, val_col in COLUMNAS_PLACEHOLDER.items():
        if col not in df.columns:
            df[col] = val_col

    return df, contadores


# ─────────────────────────────────────────────────────────────────────────────
# Paso 2 — cruzar con médicos
# ─────────────────────────────────────────────────────────────────────────────

def cruzar_medicos(
    df: pd.DataFrame,
    catalogo_nombre: dict[str, dict],
    catalogo_usuario: dict[str, dict],
) -> tuple[pd.DataFrame, dict]:
    """
    Enriquece el DataFrame con datos del catálogo de médicos (vectorizado).

    Replica la fórmula Excel:
      1. nombre_medico = BUSCARV(USUARIO_TXT, medicos, NOMBRE)
         Si no encuentra → PRESTADOR_REMITE
      2. estado/programa/area = BUSCARV(nombre_medico, medicos, ...)
    """
    # ── Preparar claves de búsqueda ──────────────────────────────────────────
    tiene_prestador = df["PRESTADOR_REMITE"].notna() & (df["PRESTADOR_REMITE"].str.strip() != "")

    if "USUARIO_TXT" not in df.columns:
        df["USUARIO_TXT"] = None
    usuario_upper = df["USUARIO_TXT"].str.strip().str.upper()

    usuarios_especiales_extendido = USUARIOS_ESPECIALES | {"INTERNET", "IPSA", "INTEIPSA"}
    es_especial = usuario_upper.isin(usuarios_especiales_extendido)

    # ── Fase A: resolver NOMBRE ──────────────────────────────────────────────
    # Buscar USUARIO_TXT en catalogo_usuario → retorna NOMBRE del médico
    usuario_nombre_map = {k: v["nombre"] for k, v in catalogo_usuario.items()}
    nombre_por_usuario = usuario_upper.map(usuario_nombre_map)

    # Fallback: si no se encuentra, usar PRESTADOR_REMITE
    df["NOMBRE"] = nombre_por_usuario
    sin_nombre = df["NOMBRE"].isna() & tiene_prestador
    df.loc[sin_nombre, "NOMBRE"] = df.loc[sin_nombre, "PRESTADOR_REMITE"]

    # ── Fase B: buscar atributos por NOMBRE resuelto ─────────────────────────
    nombre_resuelto_upper = df["NOMBRE"].str.strip().str.upper()

    estado_map   = {k: v["estado"]               for k, v in catalogo_nombre.items()}
    programa_map = {k: v["programa_especialidad"] for k, v in catalogo_nombre.items()}
    area_map     = {k: v["area"]                  for k, v in catalogo_nombre.items()}

    estado_raw = nombre_resuelto_upper.map(estado_map)

    # ── Fase C: detectar médicos no encontrados (antes del fillna) ──────────
    no_especial = ~es_especial
    sin_match   = estado_raw.isna() & tiene_prestador & no_especial

    medicos_no_encontrados = (
        df.loc[sin_match, "PRESTADOR_REMITE"]
        .str.strip()
        .value_counts()
        .to_dict()
    )

    df["ESTADO_MEDICO"]         = estado_raw.fillna("EXTERNO")
    df["PROGRAMA_ESPECIALIDAD"] = nombre_resuelto_upper.map(programa_map)
    df["AREA"]                  = nombre_resuelto_upper.map(area_map)

    stat = {
        "total":   len(medicos_no_encontrados),
        "nombres": sorted(medicos_no_encontrados.keys())[:50],
    }
    return df, stat


# ─────────────────────────────────────────────────────────────────────────────
# Paso 3 — renombrar columnas y calcular hash_fila
# ─────────────────────────────────────────────────────────────────────────────

def preparar_para_staging(df: pd.DataFrame) -> pd.DataFrame:
    # Renombrar
    rename_map = {k: v for k, v in MAPA_COLUMNAS.items() if k in df.columns}
    df = df.rename(columns=rename_map)

    # Eliminar columnas duplicadas (archivos normalizados pueden tener
    # columnas del médico que ya fueron añadidas por cruzar_medicos).
    # Mantener la última ocurrencia (la del archivo normalizado).
    df = df.loc[:, ~df.columns.duplicated(keep="last")]

    # Calcular hash_fila (vectorizado con numpy)
    cols_hash = ["numero_consec_orden_serie", "numero_consec_evento",
                 "codigo_prestacion", "periodo"]
    concat = df.get("numero_consec_orden_serie", pd.Series([""] * len(df))).astype(str)
    for c in cols_hash[1:]:
        if c in df.columns:
            concat = concat + "|" + df[c].astype(str)
    # hashlib sobre numpy array es ~3x más rápido que apply() fila a fila
    import numpy as np
    concat_np = concat.to_numpy()
    df["hash_fila"] = np.vectorize(
        lambda s: hashlib.sha256(s.encode()).hexdigest()
    )(concat_np)

    # Seleccionar solo las columnas del staging, en orden
    cols_ok = [c for c in COLUMNAS_STAGING_ORDERED if c in df.columns]
    # Agregar columnas faltantes como None
    for c in COLUMNAS_STAGING_ORDERED:
        if c not in df.columns:
            df[c] = None
    return df[COLUMNAS_STAGING_ORDERED]


# ─────────────────────────────────────────────────────────────────────────────
# Paso 4 — cargar en staging con execute_values
# ─────────────────────────────────────────────────────────────────────────────

def _valor_py(v):
    """Convierte NaN/NaT a None para que psycopg2 los inserte como NULL."""
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    # pandas Timestamp → datetime.date o datetime.datetime
    if isinstance(v, pd.Timestamp):
        return v.to_pydatetime() if v.time().hour != 0 else v.date()
    return v


def _df_lote_a_registros(lote: pd.DataFrame, job_id: str, cols: list) -> list:
    """
    Convierte un lote del DataFrame a lista de tuplas para execute_values.
    Usa to_numpy(object, na_value=None) para reemplazar NaN/NaT → None
    de forma vectorizada, sin iterrows.
    """
    import numpy as np

    sub = lote[cols].copy()

    # Convertir columnas datetime64 a Python datetime/date ANTES de to_numpy
    # (to_numpy con dtype=object no convierte Timestamps automáticamente)
    for col in sub.select_dtypes(include=["datetime64[ns, UTC]", "datetime64[ns]"]).columns:
        sub[col] = sub[col].apply(
            lambda v: (v.to_pydatetime() if v.time().hour + v.time().minute + v.time().second != 0
                       else v.date()) if pd.notna(v) else None
        )

    # to_numpy(dtype=object, na_value=None) convierte NaN y NaT → None
    arr = sub.to_numpy(dtype=object, na_value=None)

    # Asegurar que no queden float NaN sueltos (por columnas object)
    nan_mask = pd.isna(pd.DataFrame(arr)).to_numpy()
    arr[nan_mask] = None

    return [(job_id,) + tuple(row) for row in arr]


def cargar_en_staging(df: pd.DataFrame, job_id: str, conn) -> dict:
    cur = conn.cursor()
    cur.execute("DELETE FROM staging_autorizaciones WHERE job_id = %s", (job_id,))

    cols = COLUMNAS_STAGING_ORDERED
    sql  = (
        f"INSERT INTO staging_autorizaciones (job_id, {', '.join(cols)}) "
        f"VALUES %s"
    )

    insertadas = 0
    errores    = 0

    for inicio in range(0, len(df), BATCH_SIZE):
        lote = df.iloc[inicio: inicio + BATCH_SIZE]
        registros = _df_lote_a_registros(lote, job_id, cols)

        try:
            psycopg2.extras.execute_values(cur, sql, registros, page_size=BATCH_SIZE)
            conn.commit()
            insertadas += len(registros)
            if insertadas % 50_000 < BATCH_SIZE:
                print(f"[INFO]   {insertadas:,} filas en staging...")
        except Exception as e:
            conn.rollback()
            errores += len(registros)
            print(f"[WARN] Error lote {inicio}-{inicio+len(lote)}: {e}")

    cur.close()
    return {"insertadas": insertadas, "errores": errores}


# ─────────────────────────────────────────────────────────────────────────────
# Estadísticas de previsualización
# ─────────────────────────────────────────────────────────────────────────────

def generar_estadisticas_preview(df: pd.DataFrame, periodo: int) -> dict:
    stats: dict = {"periodo": periodo}

    if "tipo_prestacion_desc" in df.columns:
        dist = df["tipo_prestacion_desc"].value_counts(dropna=False).head(15)
        stats["distribucion_tipo_prestacion"] = {
            str(k): int(v) for k, v in dist.items()
        }

    if "programa_especialidad" in df.columns:
        stats["distribucion_programa"] = {
            str(k): int(v)
            for k, v in df["programa_especialidad"].value_counts(dropna=False).head(10).items()
        }

    if "usuario_txt" in df.columns:
        stats["medicos_distintos"]  = int(df["usuario_txt"].dropna().nunique())
        stats["filas_sin_medico"]   = int(df["usuario_txt"].isna().sum())

    if "estado_autorizacion_desc" in df.columns:
        stats["distribucion_estados"] = {
            str(k): int(v)
            for k, v in df["estado_autorizacion_desc"].value_counts(dropna=False).head(10).items()
        }

    # Muestra: primeras filas, serializable a JSON
    muestra = (
        df.head(PREVIEW_SAMPLE_ROWS)
        .fillna("")
        .to_dict(orient="records")
    )
    # Convertir tipos no serializables
    for fila in muestra:
        for k, v in fila.items():
            if isinstance(v, pd.Timestamp):
                fila[k] = v.isoformat()
    stats["muestra_filas"] = muestra
    return stats


# ─────────────────────────────────────────────────────────────────────────────
# Registrar en log_cargas
# ─────────────────────────────────────────────────────────────────────────────

def registrar_log(conn, job_id: str, informe: dict, estado: str) -> None:
    cur = conn.cursor()
    med = informe.get("medicos_no_encontrados") or {"total": 0, "nombres": []}
    cur.execute("""
        INSERT INTO log_cargas (
            job_id, nombre_archivo, hash_archivo,
            periodo_detectado, filas_en_archivo,
            filas_insertadas, filas_duplicadas,
            filas_con_error, fechas_invalidas, valores_invalidos,
            medicos_no_encontrados, columnas_faltantes,
            distribucion_estados,
            estado, error_mensaje,
            cargado_por, tiempo_segundos
        ) VALUES (
            %s, %s, %s,
            %s, %s,
            %s, %s,
            %s, %s, %s,
            %s::jsonb, %s::jsonb,
            %s::jsonb,
            %s, %s,
            %s, %s
        )
        ON CONFLICT (job_id) DO UPDATE SET
            estado               = EXCLUDED.estado,
            filas_insertadas     = EXCLUDED.filas_insertadas,
            filas_duplicadas     = EXCLUDED.filas_duplicadas,
            filas_con_error      = EXCLUDED.filas_con_error,
            fechas_invalidas     = EXCLUDED.fechas_invalidas,
            valores_invalidos    = EXCLUDED.valores_invalidos,
            medicos_no_encontrados = EXCLUDED.medicos_no_encontrados,
            distribucion_estados = EXCLUDED.distribucion_estados,
            error_mensaje        = EXCLUDED.error_mensaje,
            tiempo_segundos      = EXCLUDED.tiempo_segundos
    """, (
        job_id,
        informe.get("nombre_archivo"),
        informe.get("hash_archivo"),
        informe.get("periodo_detectado"),
        informe.get("filas_en_archivo", 0),
        informe.get("filas_insertadas", 0),
        informe.get("filas_duplicadas", 0),
        informe.get("filas_con_error_bd", 0),
        informe.get("fechas_invalidas", 0),
        informe.get("valores_numericos_invalidos", 0),
        json.dumps(med, ensure_ascii=False),
        json.dumps(informe.get("columnas_faltantes", []), ensure_ascii=False),
        json.dumps(informe.get("distribucion_estados", {}), ensure_ascii=False),
        estado,
        informe.get("error_fatal_mensaje"),
        informe.get("cargado_por"),
        informe.get("tiempo_segundos", 0),
    ))
    conn.commit()
    cur.close()


# ─────────────────────────────────────────────────────────────────────────────
# MODO --preview
# ─────────────────────────────────────────────────────────────────────────────

def modo_preview(
    archivo: Path,
    periodo_override: int | None = None,
    force: bool = False,
    cargado_por: str | None = None,
    job_id_externo: str | None = None,
) -> dict:
    t0 = time.time()
    job_id    = job_id_externo if job_id_externo else str(uuid.uuid4())
    h_archivo = hash_archivo(archivo)

    conn = get_db_conn()

    # ── Registrar INICIO inmediatamente (antes de leer el Excel)  ────────────
    # Esto permite que la UI pueda hacer polling desde el primer segundo.
    informe_inicio = construir_informe(
        job_id=job_id,
        nombre_archivo=archivo.name,
        hash_archivo=h_archivo,
        estado="procesando",
        cargado_por=cargado_por,
    )
    registrar_log(conn, job_id, informe_inicio, "procesando")
    print(f"[INFO] Job registrado: {job_id}")

    # ── Verificar si ya fue procesado ────────────────────────────────────────
    if not force:
        cur = conn.cursor()
        cur.execute("""
            SELECT job_id, cargado_en, estado
            FROM log_cargas
            WHERE hash_archivo = %s
              AND job_id != %s
              AND estado NOT IN ('cancelado', 'error_fatal', 'procesando')
            LIMIT 1
        """, (h_archivo, job_id))
        existente = cur.fetchone()
        cur.close()
        if existente:
            msg = (
                f"Archivo ya procesado (job={existente[0]}, "
                f"fecha={existente[1]}, estado={existente[2]}). "
                "Use --force para recargar."
            )
            print(f"[ADVERTENCIA] {msg}")
            informe = informe_error_fatal(
                job_id=job_id,
                nombre_archivo=archivo.name,
                hash_archivo=h_archivo,
                mensaje=msg,
                tiempo_segundos=time.time() - t0,
            )
            informe["estado"] = "ya_procesado"
            registrar_log(conn, job_id, informe, "ya_procesado")
            conn.close()
            return informe

    # ── Leer y limpiar ───────────────────────────────────────────────────────
    try:
        df, contadores = leer_y_limpiar(archivo, periodo_override)
    except (ValueError, RuntimeError) as exc:
        informe = informe_error_fatal(
            job_id=job_id,
            nombre_archivo=archivo.name,
            hash_archivo=h_archivo,
            mensaje=str(exc),
            tiempo_segundos=time.time() - t0,
        )
        registrar_log(conn, job_id, informe, "error_fatal")
        conn.close()
        imprimir_resumen(informe)
        return informe

    periodo = contadores["periodo_detectado"]
    # Para log_cargas (columna INT), usar el primer periodo si hay varios
    periodo_log = periodo[0] if isinstance(periodo, list) else periodo

    # Actualizar con datos del archivo leído
    informe_parcial = construir_informe(
        job_id=job_id,
        nombre_archivo=archivo.name,
        hash_archivo=h_archivo,
        periodo_detectado=periodo_log,
        filas_en_archivo=contadores["filas_en_archivo"],
        estado="previsualizando",
        tiempo_segundos=time.time() - t0,
        cargado_por=cargado_por,
    )
    registrar_log(conn, job_id, informe_parcial, "previsualizando")

    # ── JOIN con médicos ─────────────────────────────────────────────────────
    catalogo_nombre, catalogo_usuario = cargar_catalogo_medicos(conn)
    print(f"[INFO] Catalogo medicos cargado: {len(catalogo_nombre)} por nombre, {len(catalogo_usuario)} por usuario")
    df, medicos_stat = cruzar_medicos(df, catalogo_nombre, catalogo_usuario)
    if medicos_stat["total"] > 0:
        print(f"[WARN] Medicos no encontrados: {medicos_stat['total']} nombres unicos")

    # ── Preparar para staging ────────────────────────────────────────────────
    df = preparar_para_staging(df)

    # ── Estadísticas de preview ──────────────────────────────────────────────
    stats_preview = generar_estadisticas_preview(df, periodo_log)

    # ── Cargar en staging ────────────────────────────────────────────────────
    print(f"[INFO] Cargando {len(df):,} filas en staging...")
    result_st = cargar_en_staging(df, job_id, conn)
    print(f"[INFO] Staging: {result_st['insertadas']:,} insertadas, {result_st['errores']} errores")

    t_total = time.time() - t0

    informe = construir_informe(
        job_id=job_id,
        nombre_archivo=archivo.name,
        hash_archivo=h_archivo,
        periodo_detectado=periodo_log,
        filas_en_archivo=contadores["filas_en_archivo"],
        filas_insertadas=result_st["insertadas"],
        filas_con_error_bd=result_st["errores"],
        fechas_invalidas=contadores["fechas_invalidas"],
        ejemplos_fechas_invalidas=contadores["ejemplos_fechas_invalidas"],
        valores_numericos_invalidos=contadores["valores_invalidos"],
        medicos_no_encontrados=medicos_stat,
        distribucion_estados=stats_preview.get("distribucion_estados", {}),
        estado="esperando_confirmacion",
        tiempo_segundos=t_total,
        cargado_por=cargado_por,
    )
    informe["preview_stats"] = stats_preview

    registrar_log(conn, job_id, informe, "esperando_confirmacion")
    conn.close()
    imprimir_resumen(informe)
    return informe


# ─────────────────────────────────────────────────────────────────────────────
# MODO --confirm
# ─────────────────────────────────────────────────────────────────────────────

def modo_confirm(job_id: str) -> dict:
    t0   = time.time()
    conn = get_db_conn()
    cur  = conn.cursor()

    cur.execute("""
        SELECT nombre_archivo, hash_archivo, periodo_detectado,
               filas_en_archivo, estado
        FROM log_cargas WHERE job_id = %s
    """, (job_id,))
    row = cur.fetchone()
    if not row:
        print(f"[ERROR] job_id no encontrado: {job_id}")
        cur.close(); conn.close(); sys.exit(1)

    nombre_archivo, h_archivo, periodo, filas_en_archivo, estado = row
    if estado not in ("esperando_confirmacion",):
        print(f"[ERROR] El job {job_id} esta en estado '{estado}', no se puede confirmar.")
        cur.close(); conn.close(); sys.exit(1)

    # Obtener todos los periodos distintos desde staging
    cur.execute(
        "SELECT DISTINCT periodo FROM staging_autorizaciones WHERE job_id = %s ORDER BY periodo",
        (job_id,)
    )
    periodos_staging = [r[0] for r in cur.fetchall()]

    if not periodos_staging:
        if not periodo:
            print(f"[ERROR] No se pudo determinar el periodo para job {job_id}")
            cur.close(); conn.close(); sys.exit(1)
        periodos_staging = [periodo]

    if not periodo:
        periodo = periodos_staging[0]
        cur.execute(
            "UPDATE log_cargas SET periodo_detectado = %s WHERE job_id = %s",
            (periodo, job_id)
        )
        conn.commit()

    print(f"[INFO] Confirmando job {job_id} | {nombre_archivo} | periodos {periodos_staging}")
    cur.execute(
        "UPDATE log_cargas SET estado = 'procesando' WHERE job_id = %s", (job_id,)
    )
    conn.commit()

    # Crear particiones para todos los periodos
    for p in periodos_staging:
        cur.execute("SELECT crear_particion_autorizaciones(%s)", (p,))
        conn.commit()
        print(f"[INFO] Particion autorizaciones_{p} lista")

    # Contar staging antes de mover
    cur.execute(
        "SELECT COUNT(*) FROM staging_autorizaciones WHERE job_id = %s", (job_id,)
    )
    total_staging = cur.fetchone()[0]

    # Obtener columnas de staging dinámicamente (excepto id y job_id)
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'staging_autorizaciones'
          AND column_name NOT IN ('id', 'job_id')
        ORDER BY ordinal_position
    """)
    cols_staging = [r[0] for r in cur.fetchall()]
    cols_csv = ", ".join(f"s.{c}" for c in cols_staging)
    cols_dest = ", ".join(cols_staging)

    cur.execute(f"""
        INSERT INTO autorizaciones ({cols_dest}, archivo_fuente, cargado_en)
        SELECT {cols_csv}, %s, NOW()
        FROM staging_autorizaciones s
        WHERE s.job_id = %s
        ON CONFLICT (hash_fila, periodo) DO NOTHING
    """, (nombre_archivo, job_id))

    filas_insertadas = cur.rowcount
    filas_duplicadas = total_staging - filas_insertadas
    conn.commit()

    # Limpiar staging
    cur.execute("DELETE FROM staging_autorizaciones WHERE job_id = %s", (job_id,))
    conn.commit()

    t_total = time.time() - t0

    # Actualizar log
    cur.execute("""
        UPDATE log_cargas SET
            estado           = 'exitoso',
            filas_insertadas = %s,
            filas_duplicadas = %s,
            tiempo_segundos  = tiempo_segundos + %s
        WHERE job_id = %s
    """, (filas_insertadas, max(filas_duplicadas, 0), round(t_total, 1), job_id))
    conn.commit()
    cur.close()
    conn.close()

    informe = construir_informe(
        job_id=job_id,
        nombre_archivo=nombre_archivo,
        hash_archivo=h_archivo,
        periodo_detectado=periodo,
        filas_en_archivo=filas_en_archivo,
        filas_insertadas=filas_insertadas,
        filas_duplicadas=max(filas_duplicadas, 0),
        estado="exitoso",
        tiempo_segundos=t_total,
    )
    imprimir_resumen(informe)
    return informe


# ─────────────────────────────────────────────────────────────────────────────
# MODO --directo (preview + confirm automático)
# ─────────────────────────────────────────────────────────────────────────────

def modo_directo(
    archivo: Path,
    periodo_override: int | None = None,
    force: bool = False,
    cargado_por: str | None = None,
) -> dict:
    informe = modo_preview(archivo, periodo_override, force, cargado_por)
    if informe["estado"] in ("error_fatal", "ya_procesado"):
        return informe
    return modo_confirm(informe["job_id"])


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="ETL DETALLADOS EPS -> autorizaciones"
    )
    grupo = parser.add_mutually_exclusive_group(required=True)
    grupo.add_argument("--preview",  action="store_true",
                       help="Normalizar y cargar en staging; mostrar previa")
    grupo.add_argument("--confirm",  metavar="JOB_ID",
                       help="Confirmar carga con job_id dado")
    grupo.add_argument("--directo",  action="store_true",
                       help="Preview + confirm en un solo paso")

    parser.add_argument("--archivo",  type=str, default=None)
    parser.add_argument("--periodo",  type=int, default=None)
    parser.add_argument("--force",    action="store_true")
    parser.add_argument("--usuario",  type=str, default=None)
    parser.add_argument("--job-id",   type=str, default=None,
                        dest="job_id",
                        help="UUID pre-generado por el API (evita esperar al ETL para obtenerlo)")
    args = parser.parse_args()

    if args.preview or args.directo:
        if not args.archivo:
            parser.error("--preview y --directo requieren --archivo")
        ruta = Path(args.archivo)
        if not ruta.exists():
            print(f"[ERROR] Archivo no encontrado: {ruta}")
            sys.exit(1)

    if args.preview:
        inf = modo_preview(
            Path(args.archivo), args.periodo, args.force, args.usuario,
            job_id_externo=args.job_id,
        )
        if inf["estado"] == "esperando_confirmacion":
            print(f"[JOB_ID] {inf['job_id']}")
            print("[INFO] Para confirmar:")
            print(f"       python etl_autorizaciones.py --confirm {inf['job_id']}")

    elif args.confirm:
        modo_confirm(args.confirm)

    elif args.directo:
        modo_directo(
            Path(args.archivo), args.periodo, args.force, args.usuario
        )


if __name__ == "__main__":
    main()
