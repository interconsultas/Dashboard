"""Tests para etl_autorizaciones.detectar_periodo"""
from etl_autorizaciones import detectar_periodo


class TestDetectarPeriodo:

    def test_formato_yyyymm_con_espacio(self):
        assert detectar_periodo("202603 Detallado autorizaciones.xlsx") == 202603

    def test_formato_fecha_rango(self):
        assert detectar_periodo("Autorizado 2026-03-02 al 2026-03-08.xlsx") == 202603

    def test_formato_guion_bajo(self):
        assert detectar_periodo("detallado_202602.xlsx") == 202602

    def test_formato_sin_separador(self):
        assert detectar_periodo("archivo202601datos.xlsx") == 202601

    def test_mes_diciembre(self):
        assert detectar_periodo("2025-12 reporte.xlsx") == 202512

    def test_mes_enero(self):
        assert detectar_periodo("202601 archivo.xlsx") == 202601

    def test_sin_periodo_retorna_none(self):
        assert detectar_periodo("archivo_sin_fecha.xlsx") is None

    def test_mes_invalido_13_retorna_none(self):
        assert detectar_periodo("202613_archivo.xlsx") is None

    def test_mes_invalido_00_retorna_none(self):
        assert detectar_periodo("202600_archivo.xlsx") is None

    def test_anio_fuera_rango(self):
        assert detectar_periodo("191203_archivo.xlsx") is None

    def test_nombre_real_detallado_eps(self):
        assert detectar_periodo("10. Autorizado 2026-03-02 al 2026-03-08.xlsx") == 202603

    def test_nombre_real_ajustado(self):
        assert detectar_periodo("202602 Detallado autorizaciones.xlsx") == 202602

    def test_multiples_fechas_toma_primera(self):
        resultado = detectar_periodo("2026-02-01 al 2026-03-15.xlsx")
        assert resultado == 202602
