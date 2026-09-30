"""Tests para etl_autorizaciones.leer_y_limpiar — deteccion de multiples periodos.

Cubre el bug reportado: un archivo que abarca mas de un periodo (ej. un
corte semanal que cruza fin de mes) solo dejaba registrado el PRIMER
periodo en contadores["periodo_detectado"], perdiendo la lista completa.
"""
import pandas as pd

from etl_autorizaciones import leer_y_limpiar


def _escribir_xlsx(tmp_path, df: pd.DataFrame, nombre="archivo.xlsx"):
    ruta = tmp_path / nombre
    df.to_excel(ruta, index=False, engine="openpyxl")
    return ruta


class TestPeriodosDetectados:

    def test_un_solo_periodo(self, tmp_path, df_autorizaciones_minimo):
        ruta = _escribir_xlsx(tmp_path, df_autorizaciones_minimo)
        _df, contadores = leer_y_limpiar(ruta)

        assert contadores["periodo_detectado"] == 202603
        assert contadores["periodos_detectados"] == [202603]

    def test_multiples_periodos_quedan_todos_registrados(self, tmp_path, df_autorizaciones_minimo):
        df = df_autorizaciones_minimo.copy()
        df.loc[0, "PERIODO"] = "202602"
        df.loc[1, "PERIODO"] = "202603"
        ruta = _escribir_xlsx(tmp_path, df)

        _df, contadores = leer_y_limpiar(ruta)

        # periodo_detectado historico se queda con la lista completa (comportamiento
        # ya existente, sin cambios) — lo nuevo es periodos_detectados, ordenado.
        assert contadores["periodos_detectados"] == [202602, 202603]

    def test_periodos_detectados_queda_ordenado_sin_importar_orden_del_archivo(
        self, tmp_path, df_autorizaciones_minimo
    ):
        df = df_autorizaciones_minimo.copy()
        df.loc[0, "PERIODO"] = "202603"
        df.loc[1, "PERIODO"] = "202601"
        ruta = _escribir_xlsx(tmp_path, df)

        _df, contadores = leer_y_limpiar(ruta)

        assert contadores["periodos_detectados"] == [202601, 202603]
