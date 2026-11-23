"""Estructura de 016_citas_detallado.sql (se lee como texto, sin base de datos)."""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent.parent
SQL = (RAIZ / "etl" / "sql" / "016_citas_detallado.sql").read_text(encoding="utf-8")
PLANO = " ".join(SQL.split())

METRICAS = [
    "creadas", "bloqueadas", "ofertadas", "disponibles", "asignadas", "confirmadas",
    "confirmadas_sin_atencion", "inasistidas", "canceladas", "pendientes_por_asistir",
]


def _tabla(nombre):
    m = re.search(rf"CREATE TABLE IF NOT EXISTS {nombre} \((.*?)\n\);", SQL, re.S)
    assert m, f"no se encontró la tabla {nombre}"
    return " ".join(m.group(1).split())


def test_es_idempotente_y_no_borra_ni_toca_vistas_materializadas():
    assert "DROP " not in SQL.upper()
    assert "MATERIALIZED" not in SQL.upper()
    for indice in re.findall(r"CREATE (?:UNIQUE )?INDEX (\S+)", SQL):
        assert indice == "IF", "los índices deben usar IF NOT EXISTS"


def test_catalogo_de_servicios_por_codigo():
    tabla = _tabla("servicios_citas")
    assert "codigo_servicio VARCHAR(20) PRIMARY KEY" in tabla
    for columna in ("nombre_servicio", "primer_periodo INT NOT NULL", "ultimo_periodo INT NOT NULL"):
        assert columna in tabla


def test_detalle_con_todas_las_columnas():
    tabla = _tabla("citas_profesional_servicio")
    for columna in (
        "tipo_documento", "documento BIGINT NOT NULL", "nombre_profesional", "codigo_ips",
        "nombre_ips", "codigo_servicio VARCHAR(20) NOT NULL REFERENCES servicios_citas",
        "plan_agrupador", "tiempo_servicio INT NOT NULL", "fecha_inicial DATE NOT NULL",
        "fecha_final DATE NOT NULL", "periodo INT NOT NULL", "archivo_fuente",
        "cargado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    ):
        assert columna in tabla
    for metrica in METRICAS:
        assert f"{metrica} INT NOT NULL" in tabla
    assert "CHECK (granularidad IN ('mensual', 'semanal'))" in tabla
    assert "CHECK (fecha_final >= fecha_inicial)" in tabla


def test_llave_natural_unica_con_el_rango():
    assert (
        "UNIQUE (tipo_documento, documento, codigo_ips, codigo_servicio, plan_agrupador, "
        "tiempo_servicio, fecha_inicial, fecha_final)"
    ) in _tabla("citas_profesional_servicio")


def test_indices_de_consulta():
    for columnas in ("(periodo)", "(documento)", "(codigo_servicio)", "(granularidad, fecha_inicial, fecha_final)"):
        assert re.search(
            rf"CREATE INDEX IF NOT EXISTS \S+ ON citas_profesional_servicio {re.escape(columnas)}",
            PLANO,
        ), columnas
