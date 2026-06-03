"""Tests para utils/reporters.py"""
import json

from utils.reporters import (
    construir_informe,
    informe_error_fatal,
    calcular_estado_final,
    imprimir_resumen,
    a_json,
)


class TestConstruirInforme:

    def test_campos_obligatorios_presentes(self):
        informe = construir_informe(
            job_id="abc-123",
            nombre_archivo="test.xlsx",
        )
        assert informe["job_id"] == "abc-123"
        assert informe["nombre_archivo"] == "test.xlsx"
        assert informe["estado"] == "exitoso"
        assert "generado_en" in informe

    def test_valores_por_defecto(self):
        informe = construir_informe(
            job_id="x",
            nombre_archivo="x.xlsx",
        )
        assert informe["filas_en_archivo"] == 0
        assert informe["filas_insertadas"] == 0
        assert informe["filas_duplicadas"] == 0
        assert informe["fechas_invalidas"] == 0
        assert informe["columnas_faltantes"] == []
        assert informe["columnas_extra"] == []
        assert informe["error_fatal_mensaje"] is None
        assert informe["medicos_no_encontrados"] == {"total": 0, "cedulas": []}

    def test_tiempo_redondeado(self):
        informe = construir_informe(
            job_id="x",
            nombre_archivo="x.xlsx",
            tiempo_segundos=12.3456789,
        )
        assert informe["tiempo_segundos"] == 12.3

    def test_todos_los_campos_configurables(self):
        informe = construir_informe(
            job_id="job-1",
            nombre_archivo="detallado.xlsx",
            hash_archivo="abc123",
            periodo_detectado=202603,
            filas_en_archivo=5000,
            filas_insertadas=4900,
            filas_duplicadas=50,
            filas_con_error_bd=10,
            fechas_invalidas=5,
            valores_numericos_invalidos=3,
            estado="exitoso_con_advertencias",
            cargado_por="admin@test.com",
        )
        assert informe["periodo_detectado"] == 202603
        assert informe["filas_en_archivo"] == 5000
        assert informe["filas_insertadas"] == 4900
        assert informe["cargado_por"] == "admin@test.com"


class TestInformeErrorFatal:

    def test_estado_es_error_fatal(self):
        informe = informe_error_fatal(
            job_id="err-1",
            nombre_archivo="malo.xlsx",
            hash_archivo="hash123",
            mensaje="Columnas faltantes",
        )
        assert informe["estado"] == "error_fatal"
        assert informe["error_fatal_mensaje"] == "Columnas faltantes"

    def test_filas_en_cero(self):
        informe = informe_error_fatal(
            job_id="err-2",
            nombre_archivo="malo.xlsx",
            hash_archivo="hash123",
            mensaje="Error",
        )
        assert informe["filas_en_archivo"] == 0
        assert informe["filas_insertadas"] == 0


class TestCalcularEstadoFinal:

    def test_exitoso_sin_advertencias(self):
        informe = construir_informe(job_id="x", nombre_archivo="x.xlsx")
        assert calcular_estado_final(informe) == "exitoso"

    def test_exitoso_con_advertencias_medicos(self):
        informe = construir_informe(
            job_id="x",
            nombre_archivo="x.xlsx",
            medicos_no_encontrados={"total": 5, "nombres": ["DR X"]},
        )
        assert calcular_estado_final(informe) == "exitoso_con_advertencias"

    def test_exitoso_con_advertencias_fechas(self):
        informe = construir_informe(
            job_id="x",
            nombre_archivo="x.xlsx",
            fechas_invalidas=3,
        )
        assert calcular_estado_final(informe) == "exitoso_con_advertencias"

    def test_exitoso_con_advertencias_valores(self):
        informe = construir_informe(
            job_id="x",
            nombre_archivo="x.xlsx",
            valores_numericos_invalidos=2,
        )
        assert calcular_estado_final(informe) == "exitoso_con_advertencias"

    def test_exitoso_con_advertencias_columnas_extra(self):
        informe = construir_informe(
            job_id="x",
            nombre_archivo="x.xlsx",
            columnas_extra=["COLUMNA_NUEVA"],
        )
        assert calcular_estado_final(informe) == "exitoso_con_advertencias"

    def test_error_fatal_prevalece(self):
        informe = construir_informe(
            job_id="x",
            nombre_archivo="x.xlsx",
            error_fatal_mensaje="Fallo critico",
            fechas_invalidas=10,
        )
        assert calcular_estado_final(informe) == "error_fatal"


class TestAJson:

    def test_serializa_correctamente(self):
        informe = construir_informe(job_id="j1", nombre_archivo="test.xlsx")
        resultado = a_json(informe)
        parsed = json.loads(resultado)
        assert parsed["job_id"] == "j1"

    def test_soporta_caracteres_unicode(self):
        informe = construir_informe(
            job_id="j1",
            nombre_archivo="archivo_ñ_áéí.xlsx",
        )
        resultado = a_json(informe)
        assert "ñ" in resultado
        assert "áéí" in resultado


class TestImprimirResumen:

    def test_no_lanza_error_exitoso(self, capsys):
        informe = construir_informe(
            job_id="j1",
            nombre_archivo="test.xlsx",
            estado="exitoso",
            filas_en_archivo=100,
            filas_insertadas=95,
        )
        imprimir_resumen(informe)
        salida = capsys.readouterr().out
        assert "test.xlsx" in salida
        assert "EXITOSO" in salida

    def test_no_lanza_error_error_fatal(self, capsys):
        informe = informe_error_fatal(
            job_id="j2",
            nombre_archivo="malo.xlsx",
            hash_archivo="h",
            mensaje="Columnas faltantes: PERIODO",
        )
        imprimir_resumen(informe)
        salida = capsys.readouterr().out
        assert "ERROR" in salida

    def test_no_lanza_error_esperando_confirmacion(self, capsys):
        informe = construir_informe(
            job_id="j3",
            nombre_archivo="preview.xlsx",
            estado="esperando_confirmacion",
        )
        imprimir_resumen(informe)
        salida = capsys.readouterr().out
        assert "PREVIEW" in salida
        assert "j3" in salida
