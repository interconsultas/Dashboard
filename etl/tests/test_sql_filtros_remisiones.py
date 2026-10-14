"""Tests de los filtros de las subvistas de remisiones (issue #35).

Leen los archivos como texto (no requieren base de datos) y verifican:
- la estructura de 015_filtros_remisiones.sql (drops con CASCADE, vistas
  recreadas e índices únicos para REFRESH CONCURRENTLY);
- que los filtros WHERE de vm_dash_remisiones_cap y vm_dash_remisiones_ext
  son idénticos en 006, 015 y dashboard/src/lib/view-registry.ts, de modo
  que editar uno solo de los tres lugares rompa el test.
"""
import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent.parent
SQL_DIR = RAIZ / "etl" / "sql"
ARCHIVO = "015_filtros_remisiones.sql"
VIEW_REGISTRY = RAIZ / "dashboard" / "src" / "lib" / "view-registry.ts"

VISTAS = ["vm_dash_remisiones_cap", "vm_dash_remisiones_ext"]

# clave de FiltrosBody (view-registry) -> columna de autorizaciones
COLUMNA = {
    "tipo_convenio": "tipo_convenio_desc",
    "orden_agrup": "orden_agrup_prest_desc",
    "agrup_salud": "agrup_salud_prest_desc",
    "prestacion": "descripcion_prestacion",
}

# Valores exactos acordados con el cliente. Los dobles espacios son
# intencionales: así vienen en los datos de origen.
PRESTACIONES_CAP = [
    "CONTROL  EN PEDIATRIA",
    "CONSULTA  EN PEDIATRIA",
    "CONTROL PEDIATRA",
    "CONSULTA PEDIATRA",
    "CONTROL  EN MEDICINA INTERNA",
    "CONSULTA  EN MEDICINA INTERNA",
    "CONTROL MEDICINA INTERNA (NO VIGENTE, USAR CODIGO 890366)",
    "CONTROL MEDICINA INTERNA",
    "CONSULTA MEDICINA INTERNA",
    "CONTROL GINECOLOGIA",
    "CONSULTA GINECOLOGIA",
    "CONTROL GINECOLOGO (A) (NO VIGENTE, USAR CODIGO 890350)",
    "CONTROL GINECOLOGO (A)",
    "CONSULTA GINECOLOGO",
    "CONTROL  EN DERMATOLOGIA",
    "CONSULTA  EN DERMATOLOGIA",
    "CONTROL DERMATOLOGO (A)",
    "CONSULTA DERMATOLOGIA",
]

ESPERADO = {
    "vm_dash_remisiones_cap": {
        "tipo_convenio": ["CAPITADO"],
        "orden_agrup": [
            "CONSULTA ESP BASICAS", "CONSULTA MEDICO GENERAL",
            "CONSULTA OTRAS ESP.", "PROMOCION Y PREVENCION", "SALUD EN CASA",
        ],
        "agrup_salud": ["CONSULTAS MEDICAS", "NIVEL BASICO Y ATENCION DOMICIALIARIA"],
        "prestacion": PRESTACIONES_CAP,
    },
    "vm_dash_remisiones_ext": {
        "tipo_convenio": ["ACTIVIDAD"],
        "orden_agrup": [
            "CONSULTA ESP BASICAS", "CONSULTA MEDICA URGENTE",
            "CONSULTA MEDICO GENERAL", "CONSULTA OTRAS ESP.",
        ],
        "agrup_salud": ["CONSULTAS MEDICAS", "NIVEL BASICO Y ATENCION DOMICIALIARIA"],
    },
}


def _crudo(nombre: str) -> str:
    return (SQL_DIR / nombre).read_text(encoding="utf-8")


def _leer(nombre: str) -> str:
    """SQL sin comentarios de línea, para no evaluar texto explicativo."""
    return re.sub(r"--[^\n]*", "", _crudo(nombre))


def _bloque_vista(sql: str, vista: str) -> str:
    """CREATE MATERIALIZED VIEW de la vista hasta GROUP BY (excluido)."""
    m = re.search(rf"CREATE MATERIALIZED VIEW {vista} AS(.*?)GROUP BY", sql, re.S)
    assert m, f"No se encontró el CREATE MATERIALIZED VIEW de {vista}"
    return m.group(1)


def _literales(texto: str, pos: int, columna: str) -> list[str]:
    """Lee literales '...' separados por comas desde pos hasta el ')' de cierre.

    No usa una regex de paréntesis porque algunos valores contienen '(' y ')'.
    """
    valores = []
    patron = re.compile(r"\s*'((?:[^']|'')*)'\s*([,)])")
    while True:
        m = patron.match(texto, pos)
        assert m, f"Lista IN mal formada para {columna}"
        valores.append(m.group(1).replace("''", "'"))
        pos = m.end()
        if m.group(2) == ")":
            return valores


def _filtros_sql(nombre: str, vista: str) -> dict[str, list[str]]:
    """Extrae del WHERE de la vista los valores de cada columna filtrada."""
    where = _bloque_vista(_leer(nombre), vista).split("WHERE", 1)[1]
    filtros = {}
    for clave, columna in COLUMNA.items():
        m_in = re.search(rf"\b{columna}\s+IN\s*\(", where)
        m_eq = re.search(rf"\b{columna}\s*=\s*'((?:[^']|'')*)'", where)
        if m_in:
            filtros[clave] = _literales(where, m_in.end(), columna)
        elif m_eq:
            filtros[clave] = [m_eq.group(1).replace("''", "'")]
    return filtros


def _filtros_registry(vista: str) -> dict[str, list[str]]:
    """Extrae los arreglos de la entrada de la vista en view-registry.ts."""
    ts = VIEW_REGISTRY.read_text(encoding="utf-8")
    m = re.search(rf"\b{vista}:\s*\{{(.*?)\}}", ts, re.S)
    assert m, f"No se encontró {vista} en view-registry.ts"
    filtros = {}
    for clave, arreglo in re.findall(r"(\w+):\s*\[(.*?)\]", m.group(1), re.S):
        filtros[clave] = re.findall(r'"((?:[^"\\]|\\.)*)"', arreglo)
    return filtros


class TestEstructura015:

    def test_elimina_ambas_vistas_con_cascade(self):
        sql = _leer(ARCHIVO)
        for vista in VISTAS:
            assert re.search(
                rf"DROP MATERIALIZED VIEW IF EXISTS {vista} CASCADE;", sql
            ), vista

    def test_recrea_ambas_vistas(self):
        sql = _leer(ARCHIVO)
        for vista in VISTAS:
            assert f"CREATE MATERIALIZED VIEW {vista} AS" in sql

    @pytest.mark.parametrize("vista", VISTAS)
    def test_indice_unico_nulls_not_distinct(self, vista):
        sql = _leer(ARCHIVO)
        m = re.search(
            rf"CREATE UNIQUE INDEX idx_{vista}_uq ON {vista} \((.*?)\) NULLS NOT DISTINCT;",
            sql, re.S,
        )
        assert m, f"Falta el índice único de {vista} (REFRESH CONCURRENTLY)"

    @pytest.mark.parametrize("vista", VISTAS)
    def test_mismos_indices_que_006(self, vista):
        def indices(nombre):
            return sorted(
                " ".join(i.split())
                for i in re.findall(
                    rf"CREATE (?:UNIQUE )?INDEX idx_{vista}_\w+ ON {vista} .*?;",
                    _leer(nombre), re.S,
                )
            )
        assert indices(ARCHIVO) == indices("006_create_subviews.sql")
        assert len(indices(ARCHIVO)) == 3

    @pytest.mark.parametrize("vista", VISTAS)
    def test_mismo_select_que_006(self, vista):
        def select(nombre):
            m = re.search(
                rf"CREATE MATERIALIZED VIEW {vista} AS(.*?)WHERE.*?(GROUP BY[^;]*;)",
                _leer(nombre), re.S,
            )
            assert m
            return " ".join((m.group(1) + m.group(2)).split())
        assert select(ARCHIVO) == select("006_create_subviews.sql")

    def test_cabecera_exige_reejecutar_013(self):
        cabecera = _crudo(ARCHIVO).split("\n\n", 1)[0]
        assert "013_cumplimiento.sql" in cabecera
        assert "CASCADE" in cabecera
        assert "Idempotente" in cabecera


class TestFiltrosConsistentes:

    @pytest.mark.parametrize("nombre", ["006_create_subviews.sql", ARCHIVO])
    @pytest.mark.parametrize("vista", VISTAS)
    def test_sql_coincide_con_lo_acordado(self, nombre, vista):
        assert _filtros_sql(nombre, vista) == ESPERADO[vista]

    @pytest.mark.parametrize("vista", VISTAS)
    def test_view_registry_coincide_con_lo_acordado(self, vista):
        assert _filtros_registry(vista) == ESPERADO[vista]

    @pytest.mark.parametrize("vista", VISTAS)
    def test_006_015_y_view_registry_iguales(self, vista):
        reg = _filtros_registry(vista)
        assert _filtros_sql("006_create_subviews.sql", vista) == reg
        assert _filtros_sql(ARCHIVO, vista) == reg

    @pytest.mark.parametrize("nombre", ["006_create_subviews.sql", ARCHIVO])
    def test_conserva_dobles_espacios(self, nombre):
        prestaciones = _filtros_sql(nombre, "vm_dash_remisiones_cap")["prestacion"]
        dobles = [p for p in prestaciones if "  EN " in p]
        assert len(dobles) == 6
        assert "CONTROL  EN PEDIATRIA" in prestaciones
        assert "CONTROL EN PEDIATRIA" not in prestaciones

    def test_registry_conserva_dobles_espacios(self):
        prestaciones = _filtros_registry("vm_dash_remisiones_cap")["prestacion"]
        assert len([p for p in prestaciones if "  EN " in p]) == 6
        assert len(prestaciones) == 18


class TestInitDb:

    def test_015_corre_despues_de_006_y_antes_de_013(self):
        # 015 elimina vm_cumpl_ordenes con CASCADE; 013 debe correr después
        # para que una instalación limpia termine con la vista creada.
        script = (RAIZ / "docker" / "init-db.sh").read_text(encoding="utf-8")
        orden = re.findall(r"/sql/(\d{3})_\w+\.sql", script.split("for f in", 1)[1])
        assert "015" in orden
        assert orden.index("006") < orden.index("015") < orden.index("013")
