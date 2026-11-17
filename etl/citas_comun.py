"""
citas_comun.py
Piezas compartidas por los dos formatos de carga de citas (etl_citas.py y
citas_detallado.py). Viven aparte para que ambos módulos usen la misma clase
ErrorArchivo también cuando etl_citas.py se ejecuta como script (__main__).
"""
import unicodedata

MAX_ADVERTENCIAS = 50
CEDULA_MAX = 10 ** 15 - 1     # misma cota que la API del dashboard (15 dígitos)
CITAS_MAX = 2147483647        # las cantidades se guardan como INT


class ErrorArchivo(Exception):
    """El archivo no tiene el formato esperado. El mensaje se muestra al usuario."""

    def __init__(self, mensaje: str, tiene_cedula: bool = False):
        super().__init__(mensaje)
        self.tiene_cedula = tiene_cedula


def normalizar(valor) -> str:
    """Texto en mayúsculas, sin tildes y con espacios simples."""
    if not isinstance(valor, str):
        return ""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", valor) if unicodedata.category(c) != "Mn"
    )
    return " ".join(sin_tildes.split()).upper()


def limitar_advertencias(advertencias: list[str]) -> list[str]:
    """Como máximo MAX_ADVERTENCIAS elementos; el último indica cuántas se omiten."""
    if len(advertencias) <= MAX_ADVERTENCIAS:
        return list(advertencias)
    visibles = advertencias[:MAX_ADVERTENCIAS - 1]
    omitidas = len(advertencias) - len(visibles)
    return visibles + [f"Hay {omitidas} advertencias más que no se muestran"]


# El programa de metas se resuelve desde programa_especialidad (014_metas_v5.sql);
# solo se usa para informar cuántos profesionales cargados no tienen meta.
SQL_CATALOGO = """
    SELECT m.identificacion, m.nombre, map.programa
    FROM medicos m
    LEFT JOIN programa_meta_mapeo map
           ON UPPER(TRIM(map.programa_especialidad)) = UPPER(TRIM(m.programa_especialidad))
    WHERE m.identificacion = ANY(%s)
"""

SQL_UPSERT_CITAS_ATENDIDAS = """
    INSERT INTO citas_atendidas (documento, periodo, cantidad_citas, nombre_medico)
    VALUES (%s, %s, %s, %s)
    ON CONFLICT (documento, periodo) DO UPDATE SET
        cantidad_citas = EXCLUDED.cantidad_citas,
        nombre_medico  = EXCLUDED.nombre_medico
"""
