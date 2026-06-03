"""
reporters.py
Construye el informe JSON que se guarda en log_cargas y se devuelve a la UI.
Tambien formatea el resumen de texto para la consola.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
# Constructor del informe
# ─────────────────────────────────────────────────────────────────────────────

def construir_informe(
    *,
    job_id: str,
    nombre_archivo: str,
    hash_archivo: str = "",
    periodo_detectado: int | None = None,
    filas_en_archivo: int = 0,
    filas_insertadas: int = 0,
    filas_duplicadas: int = 0,
    filas_con_error_bd: int = 0,
    fechas_invalidas: int = 0,
    ejemplos_fechas_invalidas: list[dict] | None = None,
    valores_numericos_invalidos: int = 0,
    medicos_no_encontrados: dict | None = None,
    columnas_faltantes: list[str] | None = None,
    columnas_extra: list[str] | None = None,
    distribucion_estados: dict | None = None,
    estado: str = "exitoso",
    error_fatal_mensaje: str | None = None,
    tiempo_segundos: float = 0.0,
    cargado_por: str | None = None,
) -> dict[str, Any]:
    """
    Retorna el dict normalizado que:
      - Se serializa como JSON para guardarlo en log_cargas.
      - Se devuelve al endpoint de la API para que la UI lo muestre.

    estados posibles:
      'previsualizando'          → ETL en modo --preview
      'esperando_confirmacion'   → preview completado, esperando --confirm
      'procesando'               → confirmacion en curso
      'exitoso'                  → carga exitosa sin advertencias
      'exitoso_con_advertencias' → carga con medicos no encontrados / fechas invalidas
      'error_fatal'              → se aborto, no se cargo nada
      'cancelado'                → usuario cancelo desde la UI
    """
    return {
        "job_id":                       job_id,
        "estado":                       estado,
        "nombre_archivo":               nombre_archivo,
        "hash_archivo":                 hash_archivo,
        "periodo_detectado":            periodo_detectado,
        "filas_en_archivo":             filas_en_archivo,
        "filas_insertadas":             filas_insertadas,
        "filas_duplicadas":             filas_duplicadas,
        "filas_con_error_bd":           filas_con_error_bd,
        "fechas_invalidas":             fechas_invalidas,
        "ejemplos_fechas_invalidas":    ejemplos_fechas_invalidas or [],
        "valores_numericos_invalidos":  valores_numericos_invalidos,
        "medicos_no_encontrados":       medicos_no_encontrados or {"total": 0, "cedulas": []},
        "columnas_faltantes":           columnas_faltantes or [],
        "columnas_extra":               columnas_extra or [],
        "distribucion_estados":         distribucion_estados or {},
        "error_fatal_mensaje":          error_fatal_mensaje,
        "tiempo_segundos":              round(tiempo_segundos, 1),
        "cargado_por":                  cargado_por,
        "generado_en":                  datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Informe de error fatal (aborto antes de cargar)
# ─────────────────────────────────────────────────────────────────────────────

def informe_error_fatal(
    *,
    job_id: str,
    nombre_archivo: str,
    hash_archivo: str,
    mensaje: str,
    columnas_faltantes: list[str] | None = None,
    tiempo_segundos: float = 0.0,
) -> dict[str, Any]:
    return construir_informe(
        job_id=job_id,
        nombre_archivo=nombre_archivo,
        hash_archivo=hash_archivo,
        periodo_detectado=None,
        filas_en_archivo=0,
        estado="error_fatal",
        error_fatal_mensaje=mensaje,
        columnas_faltantes=columnas_faltantes or [],
        tiempo_segundos=tiempo_segundos,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Determinar estado final (exitoso vs exitoso_con_advertencias)
# ─────────────────────────────────────────────────────────────────────────────

def calcular_estado_final(informe: dict) -> str:
    """
    Decide el estado segun las advertencias acumuladas en el informe.
    Llama a esto ANTES de guardar en log_cargas.
    """
    if informe.get("error_fatal_mensaje"):
        return "error_fatal"

    hay_advertencias = (
        informe.get("medicos_no_encontrados", {}).get("total", 0) > 0
        or informe.get("fechas_invalidas", 0) > 0
        or informe.get("valores_numericos_invalidos", 0) > 0
        or informe.get("columnas_extra", [])
    )
    return "exitoso_con_advertencias" if hay_advertencias else "exitoso"


# ─────────────────────────────────────────────────────────────────────────────
# Resumen de consola
# ─────────────────────────────────────────────────────────────────────────────

def imprimir_resumen(informe: dict) -> None:
    """Imprime un resumen legible en la consola."""
    sep = "=" * 56
    print()
    print(sep)
    print(f"  Archivo        : {informe['nombre_archivo']}")
    print(f"  Periodo        : {informe['periodo_detectado']}")
    print(f"  Estado         : {informe['estado'].upper()}")
    print(sep)
    print(f"  Filas en archivo         : {informe['filas_en_archivo']:>10,}")
    print(f"  Filas insertadas         : {informe['filas_insertadas']:>10,}")
    print(f"  Filas duplicadas         : {informe['filas_duplicadas']:>10,}")
    print(f"  Filas con error BD       : {informe['filas_con_error_bd']:>10,}")
    print(f"  Fechas invalidas         : {informe['fechas_invalidas']:>10,}")
    print(f"  Num. invalidos           : {informe['valores_numericos_invalidos']:>10,}")

    med = informe.get("medicos_no_encontrados", {})
    if med.get("total", 0) > 0:
        cedulas = med.get("cedulas", [])[:10]
        print(f"  Medicos no encontrados   : {med['total']:>10,}")
        print(f"    Cedulas (top 10) : {cedulas}")

    if informe.get("columnas_faltantes"):
        print(f"  Columnas faltantes : {informe['columnas_faltantes']}")

    if informe.get("error_fatal_mensaje"):
        print(f"  ERROR FATAL : {informe['error_fatal_mensaje']}")

    print(f"  Tiempo total             : {informe['tiempo_segundos']:>9.1f}s")
    print(sep)

    if informe["estado"] == "error_fatal":
        print("[ERROR] Carga abortada — no se insertaron datos")
    elif informe["estado"] == "esperando_confirmacion":
        print("[PREVIEW] Previa completada — confirma con --confirm " + informe["job_id"])
    elif informe["estado"].startswith("exitoso"):
        print("[OK] Carga completada")
    print()


# ─────────────────────────────────────────────────────────────────────────────
# Serializar a JSON string (para guardar en log_cargas.medicos_no_encontrados)
# ─────────────────────────────────────────────────────────────────────────────

def a_json(informe: dict) -> str:
    return json.dumps(informe, ensure_ascii=False, default=str)
