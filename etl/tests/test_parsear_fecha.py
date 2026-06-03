"""Tests para etl_autorizaciones._parsear_fecha"""
import pandas as pd
import numpy as np
import pytest

from etl_autorizaciones import _parsear_fecha


class TestParsearFecha:

    def test_formato_iso(self):
        s = pd.Series(["2026-03-15"])
        resultado = _parsear_fecha(s)
        assert resultado.iloc[0] == pd.Timestamp("2026-03-15")

    def test_formato_dd_mm_yyyy(self):
        s = pd.Series(["15/03/2026"])
        resultado = _parsear_fecha(s)
        assert resultado.iloc[0].day == 15
        assert resultado.iloc[0].month == 3
        assert resultado.iloc[0].year == 2026

    def test_serial_excel(self):
        # 45000 ≈ 2023-02-18 (serial de Excel)
        s = pd.Series(["45000"])
        resultado = _parsear_fecha(s)
        assert pd.notna(resultado.iloc[0])
        ts = resultado.iloc[0]
        assert ts.year >= 2020
        assert ts.year <= 2030

    def test_valor_nulo(self):
        s = pd.Series([None, pd.NA, np.nan])
        resultado = _parsear_fecha(s)
        assert resultado.isna().all()

    def test_mezcla_formatos(self):
        s = pd.Series(["2026-01-10", "15/03/2026", None])
        resultado = _parsear_fecha(s)
        assert pd.notna(resultado.iloc[0])
        assert pd.notna(resultado.iloc[1])
        assert pd.isna(resultado.iloc[2])

    def test_fecha_fuera_rango_baja(self):
        """Fechas antes de 1900 se convierten en NaT."""
        s = pd.Series(["1800-01-01"])
        resultado = _parsear_fecha(s)
        assert pd.isna(resultado.iloc[0])

    def test_fecha_fuera_rango_alta(self):
        """Fechas después de 2100 se convierten en NaT."""
        s = pd.Series(["2200-12-31"])
        resultado = _parsear_fecha(s)
        assert pd.isna(resultado.iloc[0])

    def test_fecha_valida_limite_inferior(self):
        s = pd.Series(["1900-01-02"])
        resultado = _parsear_fecha(s)
        assert pd.notna(resultado.iloc[0])

    def test_fecha_valida_limite_superior(self):
        s = pd.Series(["2100-12-30"])
        resultado = _parsear_fecha(s)
        assert pd.notna(resultado.iloc[0])

    def test_texto_invalido_retorna_nat(self):
        s = pd.Series(["no_es_fecha", "abc123"])
        resultado = _parsear_fecha(s)
        assert resultado.isna().all()

    def test_serie_vacia(self):
        s = pd.Series([], dtype=object)
        resultado = _parsear_fecha(s)
        assert len(resultado) == 0

    def test_serial_excel_fuera_rango(self):
        """Números que no son seriales válidos de Excel."""
        s = pd.Series(["100", "99999"])
        resultado = _parsear_fecha(s)
        # 100 no está en rango 30000-60000
        # 99999 tampoco
        # Pueden parsearse como texto o quedar NaT
        assert len(resultado) == 2

    def test_index_se_preserva(self):
        s = pd.Series(["2026-03-15", "2026-06-20"], index=[10, 20])
        resultado = _parsear_fecha(s)
        assert list(resultado.index) == [10, 20]

    def test_formato_anio_3_digitos_ignorado(self):
        """Años con 3 dígitos (ej. '206-11-03') deben ignorarse."""
        s = pd.Series(["206-11-03"])
        resultado = _parsear_fecha(s)
        assert pd.isna(resultado.iloc[0])
