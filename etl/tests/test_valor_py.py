"""Tests para etl_autorizaciones._valor_py"""
import pandas as pd
import numpy as np

from etl_autorizaciones import _valor_py


class TestValorPy:

    def test_none_retorna_none(self):
        assert _valor_py(None) is None

    def test_nan_retorna_none(self):
        assert _valor_py(float("nan")) is None

    def test_np_nan_retorna_none(self):
        assert _valor_py(np.nan) is None

    def test_pd_nat_retorna_none(self):
        assert _valor_py(pd.NaT) is None

    def test_pd_na_retorna_none(self):
        assert _valor_py(pd.NA) is None

    def test_string_pasa_directo(self):
        assert _valor_py("hola") == "hola"

    def test_entero_pasa_directo(self):
        assert _valor_py(42) == 42

    def test_float_pasa_directo(self):
        assert _valor_py(3.14) == 3.14

    def test_timestamp_con_hora_retorna_datetime(self):
        ts = pd.Timestamp("2026-03-15 14:30:00")
        result = _valor_py(ts)
        assert hasattr(result, "hour")
        assert result.hour == 14

    def test_timestamp_sin_hora_retorna_date(self):
        ts = pd.Timestamp("2026-03-15")
        result = _valor_py(ts)
        assert hasattr(result, "year")
        assert result.year == 2026
        assert result.month == 3
        assert result.day == 15

    def test_lista_pasa_directo(self):
        assert _valor_py([1, 2, 3]) == [1, 2, 3]

    def test_string_vacio_pasa_directo(self):
        assert _valor_py("") == ""

    def test_cero_no_es_none(self):
        assert _valor_py(0) == 0
        assert _valor_py(0) is not None

    def test_false_no_es_none(self):
        assert _valor_py(False) is False
