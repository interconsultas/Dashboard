"""Tests para etl_autorizaciones._parsear_fecha"""
import pandas as pd
import numpy as np
import pytest

from etl_autorizaciones import _parsear_fecha, _parsear_columnas_fecha, COLS_FECHA


def _contadores_vacios():
    return {
        "fechas_invalidas":          0,
        "ejemplos_fechas_invalidas": [],
        "columnas_faltantes":        [],
    }


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


class TestParsearColumnasFecha:
    """Tests para etl_autorizaciones._parsear_columnas_fecha (wrapper por-DataFrame)."""

    def _df_base(self, n=1):
        data = {col: ["2026-03-15"] * n for col in COLS_FECHA}
        data["Numero_Consec_Orden_Serie"] = [f"ORD-{i}" for i in range(n)]
        return pd.DataFrame(data)

    def test_columna_faltante_se_registra(self):
        """Si el archivo no trae una columna de COLS_FECHA, debe quedar
        registrada en contadores['columnas_faltantes'] en vez de perderse
        en silencio."""
        df = self._df_base()
        df = df.drop(columns=["FECHA_ATENCION"])
        contadores = _contadores_vacios()
        _parsear_columnas_fecha(df, contadores)
        assert "FECHA_ATENCION" in contadores["columnas_faltantes"]

    def test_columna_presente_no_se_registra_como_faltante(self):
        df = self._df_base()
        contadores = _contadores_vacios()
        _parsear_columnas_fecha(df, contadores)
        assert contadores["columnas_faltantes"] == []

    def test_columna_con_otro_casing_se_reconoce_y_no_se_marca_faltante(self):
        """Bug real: un archivo con la columna 'FECHA_DIGITACION' (todo
        mayúsculas) en vez de 'Fecha_Digitacion' (el nombre canónico en
        COLS_FECHA) debe reconocerse y parsearse igual, no perderse."""
        df = self._df_base()
        df = df.rename(columns={"Fecha_Digitacion": "FECHA_DIGITACION"})
        contadores = _contadores_vacios()
        df = _parsear_columnas_fecha(df, contadores)
        assert "Fecha_Digitacion" not in contadores["columnas_faltantes"]
        assert "FECHA_DIGITACION" not in contadores["columnas_faltantes"]
        assert "Fecha_Digitacion" in df.columns
        assert pd.notna(df["Fecha_Digitacion"].iloc[0])

    def test_columna_con_espacios_extra_se_reconoce(self):
        df = self._df_base()
        df = df.rename(columns={"Fecha_Digitacion": " Fecha_Digitacion "})
        contadores = _contadores_vacios()
        df = _parsear_columnas_fecha(df, contadores)
        assert "Fecha_Digitacion" not in contadores["columnas_faltantes"]
        assert "Fecha_Digitacion" in df.columns

    def test_valor_original_se_captura_en_ejemplo(self):
        """Cuando un valor no puede parsearse, el ejemplo debe incluir el
        valor original (no solo el consecutivo de orden)."""
        df = self._df_base(n=1)
        df.loc[0, "FECHA_ATENCION"] = "no-es-una-fecha"
        contadores = _contadores_vacios()
        _parsear_columnas_fecha(df, contadores)
        ejemplos = [e for e in contadores["ejemplos_fechas_invalidas"] if e["columna"] == "FECHA_ATENCION"]
        assert len(ejemplos) == 1
        assert ejemplos[0]["valor_original"] == "no-es-una-fecha"

    def test_ejemplos_no_comparten_tope_entre_columnas(self):
        """5 fallos en FECHA_ATENCION y 5 en FECHA_PROGRAMACION deben dejar
        5 ejemplos de cada una (10 en total), no compartir un tope global de 5."""
        n = 5
        df = self._df_base(n=n)
        df["FECHA_ATENCION"] = ["no-es-fecha"] * n
        df["FECHA_PROGRAMACION"] = ["tampoco-es-fecha"] * n
        contadores = _contadores_vacios()
        _parsear_columnas_fecha(df, contadores)
        ejemplos_atencion = [e for e in contadores["ejemplos_fechas_invalidas"] if e["columna"] == "FECHA_ATENCION"]
        ejemplos_programacion = [e for e in contadores["ejemplos_fechas_invalidas"] if e["columna"] == "FECHA_PROGRAMACION"]
        assert len(ejemplos_atencion) == 5
        assert len(ejemplos_programacion) == 5

    def test_fechas_invalidas_solo_cuenta_valores_que_eran_no_nulos(self):
        """Una celda ya vacía antes de parsear no debe sumar a fechas_invalidas."""
        df = self._df_base(n=1)
        df.loc[0, "FECHA_DIGITACION" if "FECHA_DIGITACION" in df.columns else "Fecha_Digitacion"] = None
        contadores = _contadores_vacios()
        _parsear_columnas_fecha(df, contadores)
        assert contadores["fechas_invalidas"] == 0

    def test_fecha_valida_no_genera_ejemplo(self):
        df = self._df_base(n=1)
        contadores = _contadores_vacios()
        _parsear_columnas_fecha(df, contadores)
        assert contadores["fechas_invalidas"] == 0
        assert contadores["ejemplos_fechas_invalidas"] == []
