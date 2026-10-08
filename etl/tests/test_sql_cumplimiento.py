"""Tests estructurales de las migraciones SQL del módulo de cumplimiento.

Leen los archivos .sql como texto (no requieren base de datos) y verifican
que las 7 subvistas vm_dash_* exponen numero_remite y que vm_cumpl_ordenes
se construye únicamente a partir de ellas.
"""
import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent.parent
SQL_DIR = RAIZ / "etl" / "sql"

# categoria -> subvista de la que hereda los filtros
CATEGORIAS = {
    "medicamentos": "vm_dash_medicamentos",
    "laboratorios": "vm_dash_laboratorios",
    "proc_dx": "vm_dash_proc_dx",
    "rx": "vm_dash_rx",
    "ecografias": "vm_dash_ecografias",
    "remisiones_cap": "vm_dash_remisiones_cap",
    "remisiones_ext": "vm_dash_remisiones_ext",
}
SUBVISTAS = sorted(CATEGORIAS.values())

# Literales de filtro que solo pueden vivir en 006 (fuente única de verdad)
LITERALES_DE_FILTRO = [
    "'CAPITADO'",
    "'LABORATORIO CLINICO'",
    "'RADIOLOGIA'",
    "'ECOGRAFIA'",
    "'PROCEDIMIENTOS DIAGNOSTICOS'",
    "'CONSULTAS MEDICAS'",
    "'PROGRAMAS ESPECIALES'",
    "'MEDICAMENTOS PBS AMBULATORIOS'",
    "'ACTIVIDAD'",
]


def _sin_comentarios(sql: str) -> str:
    """Quita los comentarios de línea para no evaluar texto explicativo."""
    return re.sub(r"--[^\n]*", "", sql)


def _leer(nombre: str) -> str:
    return _sin_comentarios((SQL_DIR / nombre).read_text(encoding="utf-8"))


def _bloque_vista(sql: str, vista: str) -> str:
    """Devuelve el CREATE MATERIALIZED VIEW de la vista, hasta su ';'."""
    m = re.search(rf"CREATE MATERIALIZED VIEW {vista} AS(.*?);", sql, re.S)
    assert m, f"No se encontró el CREATE MATERIALIZED VIEW de {vista}"
    return m.group(1)


def _columnas_indice_unico(sql: str, vista: str) -> list[str]:
    m = re.search(
        rf"CREATE UNIQUE INDEX idx_{vista}_uq ON {vista} \((.*?)\)", sql, re.S
    )
    assert m, f"No se encontró el índice único de {vista}"
    return [c.strip() for c in m.group(1).split(",")]


class TestSubvistasExponenNumeroRemite:

    def test_006_define_las_7_subvistas(self):
        sql = _leer("006_create_subviews.sql")
        definidas = re.findall(r"CREATE MATERIALIZED VIEW (vm_dash_\w+) AS", sql)
        assert sorted(definidas) == SUBVISTAS

    @pytest.mark.parametrize("vista", SUBVISTAS)
    def test_selecciona_numero_remite_despues_de_usuario_txt(self, vista):
        bloque = _bloque_vista(_leer("006_create_subviews.sql"), vista)
        select = bloque.split("FROM autorizaciones")[0]
        dimensiones = select.split("COUNT(*)")[0]
        columnas = [c.strip() for c in dimensiones.replace("SELECT", "").split(",") if c.strip()]
        assert len(columnas) == 13
        assert columnas[-2:] == ["usuario_txt", "numero_remite"]

    @pytest.mark.parametrize("vista", SUBVISTAS)
    def test_agrupa_por_13_columnas(self, vista):
        bloque = _bloque_vista(_leer("006_create_subviews.sql"), vista)
        m = re.search(r"GROUP BY\s+([\d,\s]+)$", bloque.strip())
        assert m, f"{vista} no termina en un GROUP BY posicional"
        posiciones = [int(p) for p in m.group(1).split(",")]
        assert posiciones == list(range(1, 14))

    @pytest.mark.parametrize("vista", SUBVISTAS)
    def test_indice_unico_incluye_numero_remite(self, vista):
        columnas = _columnas_indice_unico(_leer("006_create_subviews.sql"), vista)
        assert "numero_remite" in columnas
        assert len(columnas) == 13
        assert len(set(columnas)) == 13


class TestVistaCumplimientoOrdenes:

    def test_define_vm_cumpl_ordenes(self):
        sql = _leer("013_cumplimiento.sql")
        assert "DROP MATERIALIZED VIEW IF EXISTS vm_cumpl_ordenes" in sql
        assert "CREATE MATERIALIZED VIEW vm_cumpl_ordenes AS" in sql

    @pytest.mark.parametrize("categoria,vista", sorted(CATEGORIAS.items()))
    def test_cada_categoria_lee_de_su_subvista(self, categoria, vista):
        bloque = _bloque_vista(_leer("013_cumplimiento.sql"), "vm_cumpl_ordenes")
        ramas = [r for r in bloque.split("UNION ALL") if f"'{categoria}'" in r]
        assert len(ramas) == 1, f"Se esperaba una sola rama para {categoria}"
        assert re.search(rf"FROM\s+{vista}\b", ramas[0])

    def test_tiene_exactamente_7_ramas(self):
        bloque = _bloque_vista(_leer("013_cumplimiento.sql"), "vm_cumpl_ordenes")
        assert len(bloque.split("UNION ALL")) == 7

    def test_no_lee_directamente_de_autorizaciones(self):
        bloque = _bloque_vista(_leer("013_cumplimiento.sql"), "vm_cumpl_ordenes")
        assert not re.search(r"FROM\s+autorizaciones\b", bloque)

    @pytest.mark.parametrize("literal", LITERALES_DE_FILTRO)
    def test_no_copia_los_filtros_de_006(self, literal):
        # Fuente única de verdad: las condiciones de cada categoría solo
        # se definen en 006_create_subviews.sql.
        sql = (SQL_DIR / "013_cumplimiento.sql").read_text(encoding="utf-8")
        assert literal not in sql

    def test_indice_unico_para_refresh_concurrente(self):
        sql = _leer("013_cumplimiento.sql")
        columnas = _columnas_indice_unico(sql, "vm_cumpl_ordenes")
        assert columnas == ["categoria", "periodo", "numero_remite", "usuario_txt"]
        assert re.search(
            r"idx_vm_cumpl_ordenes_uq ON vm_cumpl_ordenes \([^)]*\)\s*NULLS NOT DISTINCT",
            sql,
        )

    def test_no_reutiliza_nombres_que_003_elimina(self):
        sql = _leer("013_cumplimiento.sql")
        assert "vm_cumplimiento_mensual" not in sql
        assert "vm_tasas_por_medico" not in sql

    def test_es_sql_plano_sin_metacomandos_psql(self):
        sql = (SQL_DIR / "013_cumplimiento.sql").read_text(encoding="utf-8")
        assert not re.search(r"^\s*\\", sql, re.M)

    def test_siembra_35_metas_de_2026(self):
        sql = _leer("013_cumplimiento.sql")
        filas = re.findall(r"\(2026,\s*'([^']+)',\s*'([^']+)',\s*[\d.]+,\s*'(ratio|x100)'", sql)
        assert len(filas) == 35
        assert len({programa for programa, _, _ in filas}) == 5
        assert {tipo for _, tipo, _ in filas} == set(CATEGORIAS)
        for _, tipo, escala in filas:
            esperada = "ratio" if tipo in ("medicamentos", "laboratorios") else "x100"
            assert escala == esperada, f"escala incorrecta para {tipo}"
        assert "ON CONFLICT (anio, programa, tipo_prestacion) DO NOTHING" in sql


class TestOrdenDeMigraciones:

    def test_init_db_ejecuta_013_despues_de_006(self):
        script = (RAIZ / "docker" / "init-db.sh").read_text(encoding="utf-8")
        assert "/sql/013_cumplimiento.sql" in script
        assert script.index("/sql/006_create_subviews.sql") < script.index(
            "/sql/013_cumplimiento.sql"
        )

    def test_007_refresca_vm_cumpl_ordenes_al_final(self):
        sql = _leer("007_refresh_views.sql")
        refrescadas = re.findall(r"REFRESH MATERIALIZED VIEW CONCURRENTLY (\w+);", sql)
        assert refrescadas[-1] == "vm_cumpl_ordenes"
        assert set(SUBVISTAS) <= set(refrescadas[:-1])
