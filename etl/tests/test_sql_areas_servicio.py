"""Tests de 017_areas_servicio.sql.

La estructura se verifica leyendo el archivo como texto. Las reglas de
clasificación se prueban ejecutando la función en PostgreSQL dentro de una
transacción que se revierte; si no hay base de datos esas pruebas se omiten.
"""
import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent.parent
SQL = (RAIZ / "etl" / "sql" / "017_areas_servicio.sql").read_text(encoding="utf-8")
PLANO = " ".join(SQL.split())

AREAS = [
    "Medicina general", "Salud oral", "Laboratorio y tamizajes", "Enfermería",
    "Especialistas", "Nutrición", "Vacunación", "Psicosocial",
]


class TestEstructura:

    def test_es_idempotente_y_no_borra_datos(self):
        assert "CREATE TABLE IF NOT EXISTS areas_servicio" in PLANO
        assert "ADD COLUMN IF NOT EXISTS area " in PLANO
        assert "ADD COLUMN IF NOT EXISTS area_editada BOOLEAN NOT NULL DEFAULT FALSE" in PLANO
        assert "CREATE OR REPLACE FUNCTION clasificar_area_servicio(nombre TEXT) RETURNS TEXT" in PLANO
        assert not re.search(r"\bDROP\s+(TABLE|COLUMN)\b", SQL, re.I)
        assert not re.search(r"\bDELETE\b|\bTRUNCATE\b", SQL, re.I)

    def test_siembra_las_areas_en_orden(self):
        valores = re.findall(r"\('([^']+)',\s*(\d+)\)", SQL)
        assert [(n, int(o)) for n, o in valores] == [(a, i + 1) for i, a in enumerate(AREAS)]
        assert "ON CONFLICT (nombre) DO UPDATE SET orden = EXCLUDED.orden" in PLANO

    def test_area_es_obligatoria_y_referencia_el_catalogo_de_areas(self):
        assert "REFERENCES areas_servicio (nombre) ON UPDATE CASCADE" in PLANO
        assert "ALTER COLUMN area SET NOT NULL" in PLANO
        # El backfill usa la función y solo toca las filas sin área
        assert re.search(
            r"UPDATE servicios_citas SET area = clasificar_area_servicio\(nombre_servicio\) "
            r"WHERE area IS NULL", PLANO,
        )

    def test_la_funcion_es_inmutable(self):
        assert re.search(r"\$\$ LANGUAGE sql IMMUTABLE", PLANO, re.I)

    def test_vistas_simples_no_materializadas(self):
        assert "MATERIALIZED" not in SQL.upper()
        assert "CREATE OR REPLACE VIEW v_citas_area AS" in PLANO
        assert "CREATE OR REPLACE VIEW v_citas_area_principal AS" in PLANO

    def test_init_db_ejecuta_017_despues_de_016(self):
        script = (RAIZ / "docker" / "init-db.sh").read_text(encoding="utf-8")
        assert "/sql/017_areas_servicio.sql" in script
        assert script.index("/sql/016_citas_detallado.sql") < script.index(
            "/sql/017_areas_servicio.sql"
        )


def _sentencia_funcion() -> str:
    m = re.search(r"CREATE OR REPLACE FUNCTION clasificar_area_servicio.*?\$\$[^;]*;", SQL, re.S)
    assert m, "no se encontró la función"
    return m.group(0)


@pytest.fixture(scope="module")
def clasificar():
    """Crea la función en una transacción que se revierte al terminar."""
    psycopg2 = pytest.importorskip("psycopg2")
    import importlib
    import config
    # Otros tests recargan config con variables de entorno falsas
    importlib.reload(config)
    try:
        conn = config.get_db_conn()
    except psycopg2.OperationalError:
        pytest.skip("sin base de datos")
    cur = conn.cursor()
    cur.execute(_sentencia_funcion())

    def _clasificar(nombre):
        cur.execute("SELECT clasificar_area_servicio(%s)", (nombre,))
        return cur.fetchone()[0]

    yield _clasificar
    conn.rollback()
    conn.close()


@pytest.mark.parametrize("nombre, area", [
    # Salud oral (va primero: ODONTOPEDIATRIA no es pediatría)
    ("CONSULTA ODONTOPEDIATRIA POS", "Salud oral"),
    ("CONSULTA PRIORITARIA ODONTOLÓGICA MODELO", "Salud oral"),
    ("EDUCACION INDIVIDUAL EN SALUD POR HIGIENE ORAL", "Salud oral"),
    ("CONSULTA HIGIENISTA DENTAL", "Salud oral"),
    ("CONSULTA VALORACION INCIAL ENDODONCIA", "Salud oral"),
    ("CONSULTA CIRUGIA ORAL", "Salud oral"),
    # Nutrición, con y sin tilde
    ("CONTROL NUTRICIÓN", "Nutrición"),
    ("CONSULTA TELEMEDICINA NUTRICION", "Nutrición"),
    ("CONTROL NUTRICIONISTA DM", "Nutrición"),
    # Psicosocial
    ("CONSULTA PSICOLOGIA", "Psicosocial"),
    ("TELEMEDICINA ATENCION PSICOSOCIAL - RIAS CURSOS DE VIDA", "Psicosocial"),
    # Vacunación
    ("VACUNACIÓN INTRAMURAL", "Vacunación"),
    # Laboratorio y tamizajes
    ("LABORATORIO TOMA DE MUESTRA", "Laboratorio y tamizajes"),
    ("TAMIZAJE ADN-PVH CITOLOGIA VAGINAL TUMORAL", "Laboratorio y tamizajes"),
    ("TAMIZAJE CITOLOGIA VAGINAL TUMORAL", "Laboratorio y tamizajes"),
    # Enfermería
    ("VALORACIÓN INTEGRAL POR ENFERMERÍA - RIAS INFANCIA", "Enfermería"),
    ("INGRESO ASESORÍA PRECONCEPCIONAL ENFERMERA PROFESIONAL", "Enfermería"),
    ("ELECTROCARDIOGRAMA", "Enfermería"),
    ("TOMA SERIADA DE PRESIÓN ARTERIAL", "Enfermería"),
    ("INSERCION O RETIRAR DIU", "Enfermería"),
    ("APLICACION O RETIRO JADELLE", "Enfermería"),
    ("INSERCIÓN O EXTRACCIÓN DE IMPLANON", "Enfermería"),
    ("CONSULTA DE ASESORIA EN LACTANCIA", "Enfermería"),
    ("ACTIVIDAD EDUCATIVA", "Enfermería"),
    # Especialistas
    ("CONSULTA PEDIATRA", "Especialistas"),
    ("CONTROL GINECOLOGIA", "Especialistas"),
    ("CONTROL ASESORÍA PRECONCEPCIONAL GINECOBSTETRA", "Especialistas"),
    ("INGRESO OBSTETRA", "Especialistas"),
    ("CONTROL MEDICINA INTERNA", "Especialistas"),
    ("CONTROL DERMATOLOGICO", "Especialistas"),
    # Medicina general por defecto
    ("CONSULTA MEDICINA GENERAL SALUD CITA PRESENCIAL", "Medicina general"),
    ("CONTROL POR MEDICO -HIPERTENSION ARTERIAL", "Medicina general"),
    ("VALORACIÓN INTEGRAL POR MEDICINA - RIAS INFANCIA", "Medicina general"),
    ("GESTION EPS", "Medicina general"),
    # Mayúsculas, minúsculas y palabras que solo contienen el patrón
    ("control de nutrición", "Nutrición"),
    ("consulta pediatra", "Especialistas"),
    ("CONSULTA INDIUM", "Medicina general"),
    ("ATENCION INTERNACIONAL", "Medicina general"),
])
def test_clasifica_por_nombre(clasificar, nombre, area):
    assert clasificar(nombre) == area
