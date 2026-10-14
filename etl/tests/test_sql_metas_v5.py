"""Tests estructurales de 014_metas_v5.sql.

Leen el archivo como texto (no requieren base de datos) y verifican la tabla
de mapeo especialidad → programa de metas, sus semillas, la fila informativa
TOTAL MGI y la eliminación de medicos.programa_meta.
"""
import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent.parent
SQL_DIR = RAIZ / "etl" / "sql"
ARCHIVO = "014_metas_v5.sql"

CATEGORIAS = {
    "medicamentos", "laboratorios", "proc_dx", "rx",
    "ecografias", "remisiones_cap", "remisiones_ext",
}

# especialidad (programa_especialidad de medicos) -> programa de metas
MAPEO_INICIAL = {
    "MÉDICO GENERAL INTEGRADOR": "PROGRAMADA",
    "SUPERNUMERARIO": "PROGRAMADA",
    "DIRECCIÓN MÉDICA": "PROGRAMADA",
    "TELEMEDICINA": "PROGRAMADA",
    "NO PROGRAMADA": "NO PROGRAMADA",
    "RCV": "RCV",
    "PROGRAMAS PYM": "CyD-RIAS-PF-SALUD PÚBLICA",
    "RIAS": "CyD-RIAS-PF-SALUD PÚBLICA",
    "SSR": "CyD-RIAS-PF-SALUD PÚBLICA",
    "SALUD PÚBLICA": "CyD-RIAS-PF-SALUD PÚBLICA",
    "MATERNO INFANTIL": "CPR",
    "DERMATOLOGÍA": "DERMATOLOGÍA",
    "MEDICINA INTERNA": "MEDICINA INTERNA",
    "GINECOLOGÍA Y OBSTETRICIA": "GINECOLOGÍA Y OBSTETRICIA",
    "PEDIATRÍA": "PEDIATRÍA",
}

TOTAL_MGI = {
    "medicamentos": ("2.698630", "ratio"),
    "laboratorios": ("0.755312", "ratio"),
    "proc_dx": ("7.733049", "x100"),
    "rx": ("3.280461", "x100"),
    "ecografias": ("1.018033", "x100"),
    "remisiones_cap": ("3.113825", "x100"),
    "remisiones_ext": ("11.162229", "x100"),
}


def _crudo() -> str:
    return (SQL_DIR / ARCHIVO).read_text(encoding="utf-8")


def _leer() -> str:
    """SQL sin comentarios de línea, para no evaluar texto explicativo."""
    return re.sub(r"--[^\n]*", "", _crudo())


def _bloque(sql: str, inicio: str) -> str:
    """Sentencia que empieza en `inicio`, hasta su ';'."""
    i = sql.index(inicio)
    return sql[i:sql.index(";", i)]


class TestTablaDeMapeo:

    def test_crea_la_tabla_de_forma_idempotente(self):
        sql = _leer()
        assert "CREATE TABLE IF NOT EXISTS programa_meta_mapeo" in sql

    def test_columnas_de_la_tabla(self):
        bloque = " ".join(_bloque(_leer(), "CREATE TABLE IF NOT EXISTS programa_meta_mapeo").split())
        # Igual que medicos.programa_especialidad y metas.programa
        assert "programa_especialidad VARCHAR(100) PRIMARY KEY" in bloque
        assert "programa VARCHAR(80) NULL" in bloque
        assert "actualizado_en TIMESTAMPTZ" in bloque

    def test_siembra_el_mapeo_inicial_sin_sobrescribir_ediciones(self):
        bloque = _bloque(_leer(), "INSERT INTO programa_meta_mapeo")
        filas = dict(re.findall(r"\('([^']+)',\s*'([^']+)'\)", bloque))
        assert filas == MAPEO_INICIAL
        assert "ON CONFLICT (programa_especialidad) DO NOTHING" in bloque

    def test_las_especialidades_sembradas_estan_normalizadas(self):
        # El cruce usa UPPER(TRIM()): las claves se guardan ya normalizadas
        for especialidad in MAPEO_INICIAL:
            assert especialidad == especialidad.strip().upper()


class TestFilaTotalMgi:

    def _filas(self):
        sql = _leer()
        return re.findall(
            r"\(2026,\s*'TOTAL MGI',\s*'([^']+)',\s*([\d.]+),\s*'(ratio|x100)'\)", sql
        )

    def test_siembra_las_7_categorias_de_2026(self):
        filas = self._filas()
        assert {tipo: (valor, escala) for tipo, valor, escala in filas} == TOTAL_MGI
        assert len(filas) == 7
        assert {tipo for tipo, _, _ in filas} == CATEGORIAS

    def test_no_sobrescribe_metas_editadas(self):
        bloque = _bloque(_leer(), "INSERT INTO metas")
        assert "ON CONFLICT (anio, programa, tipo_prestacion) DO NOTHING" in bloque


class TestEliminaProgramaMeta:

    def test_elimina_la_columna_de_medicos(self):
        assert "ALTER TABLE medicos DROP COLUMN IF EXISTS programa_meta" in _leer()

    def test_elimina_el_programa_por_periodo_de_citas_atendidas(self):
        # El programa sale solo del catálogo de profesionales vía el mapeo
        assert "ALTER TABLE citas_atendidas DROP COLUMN IF EXISTS programa" in _leer()


@pytest.mark.parametrize("sentencia", [
    "CREATE TABLE ",
    "INSERT INTO ",
])
def test_es_idempotente(sentencia):
    sql = _leer()
    if sentencia == "CREATE TABLE ":
        assert not re.search(r"CREATE TABLE (?!IF NOT EXISTS)", sql)
    else:
        for m in re.finditer(r"INSERT INTO", sql):
            assert "ON CONFLICT" in sql[m.start():sql.index(";", m.start())]


def test_es_sql_plano_sin_metacomandos_psql():
    assert not re.search(r"^\s*\\", _crudo(), re.M)
