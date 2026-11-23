"""Tests del informe de citas detallado por profesional (Agenda Web).

El fixture es sintético (nombres y cédulas ficticios): imita el archivo real,
que es texto separado por tabuladores en latin-1 con extensión .xls, con
filas TOTALES y una fila vacía al final de cada bloque de profesional.
La base de datos se simula con un cursor falso que responde según el SQL.
"""
import json
from datetime import date, datetime
from unittest.mock import patch

import openpyxl
import pytest

import citas_detallado as cd
import etl_citas as ec


ENCABEZADO = [
    "IDENTIFICACION PROFESIONAL", "NOMBRE PROFESIONAL", "CODIGO IPS", "NOMBRE IPS",
    "CODIGO SERVICIO", "NOMBRE SERVICIO", "PLAN AGRUPADOR", "TIEMPO SERVICIO",
    "TOTAL CITAS CREADAS", "TOTAL CITAS BLOQUEADAS", "TOTAL CITAS OFERTADAS",
    "TOTAL CITAS DISPONIBLES", "TOTAL CITAS ASIGNADAS", "TOTAL CITAS CONFIRMADAS",
    "TOTAL CITAS CONFIRMADAS SIN ATENCION", "TOTAL CITAS INASISTIDAS",
    "TOTAL CITAS CANCELADAS", "TOTAL CITAS PENDIENTES POR ASISTIR",
]
VACIA = [""] * 18
IPS = ["1712", "IPS DE PRUEBA SEDE 1"]


def _fila(ident, nombre, servicio, nombre_servicio, plan, tiempo, metricas):
    return [ident, nombre, *IPS, servicio, nombre_servicio, plan, tiempo, *metricas]


def _totales(*filas):
    sumas = [sum(int(f[8 + i]) for f in filas if f[8 + i].isdigit()) for i in range(10)]
    return ["TOTALES"] + [""] * 7 + [str(s) for s in sumas]


def _metricas(*valores):
    return [str(v) for v in valores]


# Profesional 1: dos planes del mismo servicio y otro servicio
P1 = [
    _fila("CC 1000001", "MARÍA  JOSÉ PEÑA ÁVILA", "50110", "CONSULTA MEDICINA GENERAL", "POS", "20",
          _metricas(100, 0, 100, 5, 95, 80, 1, 14, 10, 0)),
    _fila("CC 1000001", "MARÍA  JOSÉ PEÑA ÁVILA", "50110", "CONSULTA MEDICINA GENERAL", "SIN PLAN", "20",
          _metricas(10, 8, 2, 2, 0, 0, 0, 0, 1, 0)),
    _fila("CC 1000001", "MARÍA  JOSÉ PEÑA ÁVILA", "50114", "CONSULTA NO PROGRAMADA", "POLIZA", "15",
          _metricas(20, 0, 20, 0, 20, 18, 0, 2, 3, 0)),
]
# Profesional 2: un plan, con cédula de extranjería
P2 = [
    _fila("CE 2000002", "JUAN CAMILO NUÑEZ", "11", "CONSULTA NUTRICION", "DINAMICA", "30",
          _metricas(40, 0, 40, 0, 40, 35, 0, 5, 2, 0)),
    _fila("CE 2000002", "JUAN CAMILO NUÑEZ", "11", "CONSULTA NUTRICION", "PARTICULAR", "30",
          _metricas(4, 0, 4, 0, 4, 4, 0, 0, 0, 0)),
]


def _filas_informe(fecha_inicial="1/10/2026", fecha_final="31/10/2026", p1=None, p2=None,
                   totales_p1=None):
    p1 = P1 if p1 is None else p1
    p2 = P2 if p2 is None else p2
    return [
        ["INFORME GENERAL DE CITAS DETALLADO POR PROFESIONAL"] + [""] * 17,
        VACIA,
        ["FECHA ACTUAL ", "3/11/2026 11:57"] + [""] * 16,
        ["FECHA INICIAL ", fecha_inicial] + [""] * 16,
        ["FECHA FINAL ", fecha_final] + [""] * 16,
        VACIA,
        ENCABEZADO,
        *p1,
        totales_p1 or _totales(*p1),
        VACIA,
        *p2,
        _totales(*p2),
        VACIA,
    ]


def _texto(filas) -> bytes:
    return "\r\n".join("\t".join(f) for f in filas).encode("latin-1") + b"\r\n"


def _guardar_texto(tmp_path, filas=None, nombre="INFORME DETALLADO.xls"):
    ruta = tmp_path / nombre
    ruta.write_bytes(_texto(filas or _filas_informe()))
    return ruta


def _guardar_xlsx(tmp_path, filas=None, nombre="detallado.xlsx"):
    wb = openpyxl.Workbook()
    ws = wb.active
    for fila in filas or _filas_informe():
        ws.append([_como_numero(v) for v in fila])
    ruta = tmp_path / nombre
    wb.save(ruta)
    return ruta


def _como_numero(v):
    return int(v) if isinstance(v, str) and v.isdigit() else (v or None)


# ─────────────────────────────────────────────
# Base de datos simulada
# ─────────────────────────────────────────────

class CursorFalso:
    """Responde las consultas del ETL según el texto del SQL."""

    def __init__(self, solapados=(), servicios_existentes=(), medicos=()):
        self.solapados = list(solapados)
        self.servicios_existentes = list(servicios_existentes)
        self.medicos = list(medicos)
        self.ejecutados: list[tuple[str, object]] = []
        self.lotes: list[tuple[str, list]] = []
        self._resultado: list = []

    def execute(self, sql, params=None):
        self.ejecutados.append((" ".join(sql.split()), params))
        s = " ".join(sql.split()).upper()
        if s.startswith("SELECT DISTINCT FECHA_INICIAL"):
            self._resultado = self.solapados
        elif s.startswith("SELECT CODIGO_SERVICIO FROM SERVICIOS_CITAS"):
            self._resultado = [(c,) for c in self.servicios_existentes]
        elif "FROM MEDICOS" in s:
            self._resultado = self.medicos
        else:
            self._resultado = []

    def executemany(self, sql, filas):
        self.lotes.append((" ".join(sql.split()), list(filas)))

    def fetchall(self):
        return self._resultado

    def close(self):
        pass

    def sql(self, prefijo):
        return [(s, p) for s, p in self.ejecutados if s.upper().startswith(prefijo.upper())]

    def lote(self, prefijo):
        lotes = [f for s, f in self.lotes if s.upper().startswith(prefijo.upper())]
        assert len(lotes) <= 1
        return lotes[0] if lotes else None


class ConexionFalsa:
    def __init__(self, cursor):
        self._cursor = cursor
        self.commits = 0
        self.rollbacks = 0
        self.cerrada = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.cerrada = True


MEDICOS = [
    (1000001, "PEÑA AVILA MARIA JOSE", "RCV"),
]


def _cargar(ruta, **kwargs):
    kwargs.setdefault("medicos", MEDICOS)
    cur = CursorFalso(**kwargs)
    conn = ConexionFalsa(cur)
    with patch.object(cd, "get_db_conn", return_value=conn):
        resultado = ec.cargar_citas(ruta)
    return resultado, conn, cur


# ─────────────────────────────────────────────
# Detección y lectura del archivo
# ─────────────────────────────────────────────

class TestLeerFilas:

    def test_lee_el_texto_latin1_con_tabuladores_y_crlf(self, tmp_path):
        filas = cd.leer_filas_detallado(_guardar_texto(tmp_path))

        assert filas[0][0] == "INFORME GENERAL DE CITAS DETALLADO POR PROFESIONAL"
        assert filas[7][1] == "MARÍA  JOSÉ PEÑA ÁVILA"
        assert all(not c.endswith("\r") for f in filas for c in f if isinstance(c, str))

    def test_lee_el_texto_en_utf8_si_alguien_lo_guarda_asi(self, tmp_path):
        ruta = tmp_path / "detallado.xls"
        ruta.write_bytes("\r\n".join("\t".join(f) for f in _filas_informe()).encode("utf-8"))

        filas = cd.leer_filas_detallado(ruta)

        assert filas[7][1] == "MARÍA  JOSÉ PEÑA ÁVILA"

    def test_lee_un_xlsx_con_la_misma_estructura(self, tmp_path):
        filas = cd.leer_filas_detallado(_guardar_xlsx(tmp_path))

        informe = cd.parsear_informe(filas)
        assert informe.filas == 5
        assert informe.fecha_inicial == date(2026, 10, 1)

    def test_un_xlsx_sin_la_estructura_no_es_el_informe_detallado(self, tmp_path):
        wb = openpyxl.Workbook()
        wb.active.append(["PROFESIONAL", "ID MD", 202601])
        ruta = tmp_path / "citas.xlsx"
        wb.save(ruta)

        assert cd.leer_filas_detallado(ruta) is None

    def test_rechaza_el_informe_general_con_un_mensaje_claro(self, tmp_path):
        ruta = tmp_path / "general.xls"
        ruta.write_bytes(_texto([
            ["INFORME GENERAL DE CITAS", ""],
            ["FECHA INICIAL: 2026/10/01", ""],
            ["CODIGO SERVICIO", "NOMBRE SERVICIO"],
        ]))

        with pytest.raises(ec.ErrorArchivo, match="detallado por profesional"):
            cd.leer_filas_detallado(ruta)

    def test_rechaza_un_texto_que_no_es_el_informe(self, tmp_path):
        ruta = tmp_path / "otra.xls"
        ruta.write_bytes(b"hola\tmundo\r\n")

        with pytest.raises(ec.ErrorArchivo, match="IDENTIFICACION PROFESIONAL"):
            cd.leer_filas_detallado(ruta)


class TestParsearFecha:

    @pytest.mark.parametrize("valor, esperado", [
        ("1/10/2026", date(2026, 10, 1)),
        ("31/10/2026", date(2026, 10, 31)),
        (" 7/1/2026 ", date(2026, 1, 7)),
        ("3/11/2026 11:57", date(2026, 11, 3)),
        ("2026/10/01", date(2026, 10, 1)),
        ("2026-10-31", date(2026, 10, 31)),
        (datetime(2026, 10, 1, 0, 0), date(2026, 10, 1)),
        (date(2026, 10, 31), date(2026, 10, 31)),
    ])
    def test_reconoce_los_formatos(self, valor, esperado):
        assert cd.parsear_fecha(valor) == esperado

    @pytest.mark.parametrize("valor", [None, "", "31/02/2026", "10-2026", "hoy", 45000])
    def test_retorna_none_si_no_es_una_fecha(self, valor):
        assert cd.parsear_fecha(valor) is None


class TestGranularidad:

    @pytest.mark.parametrize("ini, fin", [
        (date(2026, 10, 1), date(2026, 10, 31)),
        (date(2026, 2, 1), date(2026, 2, 28)),
        (date(2028, 2, 1), date(2028, 2, 29)),
    ])
    def test_un_mes_calendario_completo_es_mensual(self, ini, fin):
        assert cd.granularidad(ini, fin) == "mensual"

    @pytest.mark.parametrize("ini, fin", [
        (date(2026, 10, 1), date(2026, 10, 7)),
        (date(2026, 10, 2), date(2026, 10, 31)),
        (date(2026, 10, 26), date(2026, 11, 1)),
        (date(2026, 10, 1), date(2026, 11, 30)),
    ])
    def test_cualquier_otro_rango_es_semanal(self, ini, fin):
        assert cd.granularidad(ini, fin) == "semanal"


class TestParsearInforme:

    def _informe(self, **kwargs):
        return cd.parsear_informe([list(f) for f in _filas_informe(**kwargs)])

    def test_detecta_el_rango_el_periodo_y_la_granularidad(self):
        informe = self._informe()

        assert informe.fecha_inicial == date(2026, 10, 1)
        assert informe.fecha_final == date(2026, 10, 31)
        assert informe.periodo == 202610
        assert informe.granularidad == "mensual"

    def test_un_rango_semanal_toma_el_periodo_de_la_fecha_inicial(self):
        informe = self._informe(fecha_inicial="26/10/2026", fecha_final="1/11/2026")

        assert informe.periodo == 202610
        assert informe.granularidad == "semanal"

    def test_omite_las_filas_totales_y_vacias(self):
        informe = self._informe()

        assert informe.filas == 5
        assert len(informe.registros) == 5
        assert informe.advertencias == []

    def test_separa_tipo_y_numero_de_documento_y_normaliza_el_nombre(self):
        informe = self._informe()

        r = informe.registros[0]
        assert (r.tipo_documento, r.documento) == ("CC", 1000001)
        assert r.nombre_profesional == "MARÍA JOSÉ PEÑA ÁVILA"
        assert (r.codigo_ips, r.nombre_ips) == ("1712", "IPS DE PRUEBA SEDE 1")
        assert (r.codigo_servicio, r.plan_agrupador, r.tiempo_servicio) == ("50110", "POS", 20)
        assert r.metricas == (100, 0, 100, 5, 95, 80, 1, 14, 10, 0)
        assert informe.registros[3].tipo_documento == "CE"
        assert informe.profesionales == {
            1000001: "MARÍA JOSÉ PEÑA ÁVILA", 2000002: "JUAN CAMILO NUÑEZ",
        }

    def test_reune_el_catalogo_de_servicios_del_archivo(self):
        assert self._informe().servicios == {
            "50110": "CONSULTA MEDICINA GENERAL",
            "50114": "CONSULTA NO PROGRAMADA",
            "11": "CONSULTA NUTRICION",
        }

    def test_suma_las_confirmadas_por_documento(self):
        assert self._informe().confirmadas_por_documento() == {1000001: 98, 2000002: 39}

    def test_agrupa_las_filas_con_la_misma_llave_natural_sumando_las_metricas(self):
        repetida = _fila("CC 1000001", "MARÍA JOSÉ PEÑA ÁVILA", "50110", "CONSULTA MEDICINA GENERAL",
                         "POS", "20", _metricas(2, 0, 2, 0, 2, 1, 0, 1, 0, 0))
        informe = self._informe(p1=P1 + [repetida])

        assert informe.filas == 6
        assert informe.filas_agrupadas == 1
        assert len(informe.registros) == 5
        assert informe.registros[0].metricas == (102, 0, 102, 5, 97, 81, 1, 15, 10, 0)
        assert informe.advertencias == []

    def test_advierte_si_la_fila_totales_no_coincide_con_la_suma_del_bloque(self):
        totales = _totales(*P1)
        totales[13] = str(int(totales[13]) + 1)   # confirmadas

        informe = self._informe(totales_p1=totales)

        assert len(informe.advertencias) == 1
        assert "TOTALES" in informe.advertencias[0]
        assert "1000001" in informe.advertencias[0]
        assert "CONFIRMADAS" in informe.advertencias[0]
        assert len(informe.registros) == 5

    def test_advierte_y_omite_una_fila_con_metricas_invalidas(self):
        mala = list(P2[1])
        mala[12] = "NA"

        informe = self._informe(p2=[P2[0], mala])

        assert len(informe.registros) == 4
        assert any("NA" in a for a in informe.advertencias)

    def test_advierte_y_omite_una_identificacion_invalida(self):
        mala = list(P2[0])
        mala[0] = "SIN DOCUMENTO"

        informe = self._informe(p2=[mala, P2[1]])

        assert len(informe.registros) == 4
        assert any("SIN DOCUMENTO" in a for a in informe.advertencias)

    def test_encuentra_el_encabezado_sin_depender_del_numero_de_fila(self):
        filas = _filas_informe()
        filas.insert(1, ["Nota adicional"] + [""] * 17)

        informe = cd.parsear_informe(filas)

        assert informe.filas == 5

    def test_falla_si_no_esta_la_fecha_inicial(self):
        filas = [f for f in _filas_informe() if not f[0].startswith("FECHA INICIAL")]

        with pytest.raises(ec.ErrorArchivo, match="FECHA INICIAL"):
            cd.parsear_informe(filas)

    def test_acepta_la_fecha_en_la_misma_celda_tras_dos_puntos(self):
        filas = _filas_informe()
        filas[3] = ["FECHA INICIAL: 2026/10/01"] + [""] * 17

        assert cd.parsear_informe(filas).fecha_inicial == date(2026, 10, 1)

    def test_falla_si_la_fecha_final_es_anterior_a_la_inicial(self):
        with pytest.raises(ec.ErrorArchivo, match="anterior"):
            self._informe(fecha_inicial="31/10/2026", fecha_final="1/10/2026")

    def test_falla_si_falta_una_columna(self):
        filas = _filas_informe()
        filas[6] = [c if c != "PLAN AGRUPADOR" else "PLAN" for c in ENCABEZADO]

        with pytest.raises(ec.ErrorArchivo, match="PLAN AGRUPADOR"):
            cd.parsear_informe(filas)

    def test_falla_si_no_hay_filas_de_datos(self):
        filas = _filas_informe()[:7]

        with pytest.raises(ec.ErrorArchivo, match="no tiene filas"):
            cd.parsear_informe(filas)


# ─────────────────────────────────────────────
# Carga en la base de datos
# ─────────────────────────────────────────────

class TestCargarDetallado:

    def test_inserta_el_detalle_con_el_rango_la_granularidad_y_el_archivo(self, tmp_path):
        _, conn, cur = _cargar(_guardar_texto(tmp_path))

        filas = cur.lote("INSERT INTO citas_profesional_servicio")
        assert len(filas) == 5
        primera = filas[0]
        assert primera[:9] == (
            "CC", 1000001, "MARÍA JOSÉ PEÑA ÁVILA", "1712", "IPS DE PRUEBA SEDE 1",
            "50110", "POS", 20, 100,
        )
        assert primera[-5:] == (
            date(2026, 10, 1), date(2026, 10, 31), 202610, "mensual", "INFORME DETALLADO.xls",
        )
        assert conn.commits == 1 and conn.rollbacks == 0 and conn.cerrada

    def test_el_insert_es_parametrizado(self, tmp_path):
        _, _, cur = _cargar(_guardar_texto(tmp_path))

        sql = next(s for s, _ in cur.lotes if s.upper().startswith("INSERT INTO CITAS_PROFESIONAL"))
        assert "%s" in sql
        assert "1000001" not in sql

    def test_recargar_el_mismo_rango_reemplaza_sus_filas(self, tmp_path):
        _, _, cur = _cargar(_guardar_texto(tmp_path))

        borrados = cur.sql("DELETE FROM citas_profesional_servicio")
        assert len(borrados) == 1
        sql, params = borrados[0]
        assert "fecha_inicial = %s AND fecha_final = %s" in sql
        assert params == (date(2026, 10, 1), date(2026, 10, 31))
        assert cur.ejecutados.index(borrados[0]) > cur.ejecutados.index(
            cur.sql("SELECT DISTINCT fecha_inicial")[0])

    def test_bloquea_las_cargas_concurrentes(self, tmp_path):
        _, _, cur = _cargar(_guardar_texto(tmp_path))

        assert "PG_ADVISORY_XACT_LOCK" in cur.ejecutados[0][0].upper()

    def test_busca_solapamientos_solo_en_la_misma_granularidad(self, tmp_path):
        _, _, cur = _cargar(_guardar_texto(tmp_path))

        sql, params = cur.sql("SELECT DISTINCT fecha_inicial")[0]
        assert "granularidad = %s" in sql
        assert params[0] == "mensual"

    def test_rechaza_un_rango_distinto_que_se_solapa(self, tmp_path):
        ruta = _guardar_texto(tmp_path, _filas_informe("5/10/2026", "11/10/2026"))
        cur = CursorFalso(solapados=[(date(2026, 10, 1), date(2026, 10, 7))], medicos=MEDICOS)
        conn = ConexionFalsa(cur)

        with patch.object(cd, "get_db_conn", return_value=conn), \
             pytest.raises(ec.ErrorArchivo, match="se solapa") as exc:
            ec.cargar_citas(ruta)

        assert "01/10/2026" in str(exc.value) and "07/10/2026" in str(exc.value)
        assert cur.sql("DELETE") == []
        assert cur.lotes == []
        assert conn.commits == 0 and conn.rollbacks == 1 and conn.cerrada

    def test_registra_los_servicios_en_el_catalogo_y_reporta_los_nuevos(self, tmp_path):
        resultado, _, cur = _cargar(_guardar_texto(tmp_path), servicios_existentes=["50110"])

        filas = cur.lote("INSERT INTO servicios_citas")
        assert sorted(filas, key=lambda f: f["codigo"]) == [
            {"codigo": "11", "nombre": "CONSULTA NUTRICION", "primer": 202610, "ultimo": 202610},
            {"codigo": "50110", "nombre": "CONSULTA MEDICINA GENERAL", "primer": 202610, "ultimo": 202610},
            {"codigo": "50114", "nombre": "CONSULTA NO PROGRAMADA", "primer": 202610, "ultimo": 202610},
        ]
        sql = next(s for s, _ in cur.lotes if s.upper().startswith("INSERT INTO SERVICIOS_CITAS"))
        assert "ON CONFLICT (codigo_servicio) DO UPDATE" in sql
        assert "LEAST" in sql and "GREATEST" in sql
        assert resultado["servicios_nuevos"] == [
            {"codigo": "11", "nombre": "CONSULTA NUTRICION"},
            {"codigo": "50114", "nombre": "CONSULTA NO PROGRAMADA"},
        ]

    def test_un_servicio_nuevo_recibe_el_area_de_la_regla_y_uno_existente_conserva_la_suya(
            self, tmp_path):
        _, _, cur = _cargar(_guardar_texto(tmp_path))

        sql = next(s for s, _ in cur.lotes if s.upper().startswith("INSERT INTO SERVICIOS_CITAS"))
        insercion, actualizacion = sql.split("ON CONFLICT")
        # La regla vive solo en SQL: el área de un servicio nuevo sale de la función
        assert "area" in insercion
        assert "clasificar_area_servicio(%(nombre)s)" in insercion
        # Al actualizar un servicio existente nunca se reclasifica (editada o no)
        assert "area" not in actualizacion

    def test_la_carga_mensual_alimenta_citas_atendidas_con_las_confirmadas(self, tmp_path):
        resultado, _, cur = _cargar(_guardar_texto(tmp_path))

        assert cur.lote("INSERT INTO citas_atendidas") == [
            (1000001, 202610, 98, "PEÑA AVILA MARIA JOSE"),
        ]
        sql = next(s for s, _ in cur.lotes if s.upper().startswith("INSERT INTO CITAS_ATENDIDAS"))
        assert "ON CONFLICT (documento, periodo) DO UPDATE SET" in sql
        assert resultado["citas_atendidas"] == 1
        assert resultado["periodos"] == [202610]

    def test_la_carga_semanal_no_toca_citas_atendidas(self, tmp_path):
        ruta = _guardar_texto(tmp_path, _filas_informe("1/10/2026", "7/10/2026"))

        resultado, _, cur = _cargar(ruta)

        assert cur.lote("INSERT INTO citas_atendidas") is None
        assert resultado["granularidad"] == "semanal"
        assert resultado["citas_atendidas"] == 0
        assert resultado["periodos"] == []

    def test_resumen_con_las_claves_esperadas(self, tmp_path):
        resultado, _, _ = _cargar(_guardar_texto(tmp_path))

        assert resultado == {
            "formato": "detallado",
            "periodo": 202610,
            "fecha_inicial": "2026-10-01",
            "fecha_final": "2026-10-31",
            "granularidad": "mensual",
            "filas": 5,
            "registros": 5,
            "filas_agrupadas": 0,
            "profesionales": 2,
            "servicios": 3,
            "servicios_nuevos": [
                {"codigo": "11", "nombre": "CONSULTA NUTRICION"},
                {"codigo": "50110", "nombre": "CONSULTA MEDICINA GENERAL"},
                {"codigo": "50114", "nombre": "CONSULTA NO PROGRAMADA"},
            ],
            "citas_atendidas": 1,
            "periodos": [202610],
            "sin_catalogo": [{"documento": "2000002", "nombre": "JUAN CAMILO NUÑEZ"}],
            "sin_programa": 0,
            "advertencias": [],
        }

    def test_imprime_una_sola_linea_result_json_al_final(self, tmp_path, capsys):
        resultado, _, _ = _cargar(_guardar_texto(tmp_path))

        salida = capsys.readouterr().out
        lineas = [l for l in salida.splitlines() if l.startswith("RESULT_JSON:")]
        assert len(lineas) == 1
        assert salida.strip().splitlines()[-1] == lineas[0]
        assert json.loads(lineas[0][len("RESULT_JSON:"):]) == resultado

    def test_revierte_si_una_sentencia_falla(self, tmp_path):
        cur = CursorFalso(medicos=MEDICOS)
        cur.executemany = lambda sql, filas: (_ for _ in ()).throw(RuntimeError("fallo"))
        conn = ConexionFalsa(cur)

        with patch.object(cd, "get_db_conn", return_value=conn), \
             pytest.raises(RuntimeError, match="fallo"):
            ec.cargar_citas(_guardar_texto(tmp_path))

        assert conn.commits == 0 and conn.rollbacks == 1 and conn.cerrada

    def test_un_xlsx_del_informe_detallado_tambien_se_carga(self, tmp_path):
        resultado, _, cur = _cargar(_guardar_xlsx(tmp_path))

        assert resultado["formato"] == "detallado"
        assert len(cur.lote("INSERT INTO citas_profesional_servicio")) == 5

    def test_un_archivo_invalido_falla_antes_de_conectarse(self, tmp_path):
        filas = [f for f in _filas_informe() if not f[0].startswith("FECHA FINAL")]

        with patch.object(cd, "get_db_conn") as get_conn, pytest.raises(ec.ErrorArchivo):
            ec.cargar_citas(_guardar_texto(tmp_path, filas))

        get_conn.assert_not_called()


class TestMainDetallado:

    def test_un_solapamiento_termina_con_codigo_1_y_mensaje_en_stderr(self, tmp_path, capsys):
        ruta = _guardar_texto(tmp_path, _filas_informe("5/10/2026", "11/10/2026"))
        conn = ConexionFalsa(CursorFalso(solapados=[(date(2026, 10, 1), date(2026, 10, 7))]))

        with patch.object(cd, "get_db_conn", return_value=conn):
            codigo = ec.main(["--archivo", str(ruta)])

        err = capsys.readouterr().err
        assert codigo == 1
        assert "se solapa" in err
        assert "Traceback" not in err
