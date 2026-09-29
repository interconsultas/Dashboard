"""Tests para etl_medicos.cargar_medicos"""
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd

import etl_medicos as em


def _df_medicos():
    return pd.DataFrame({
        "USUARIO TXT": ["JGARCIA", "MLOPEZ"],
        "IDENTIFICACIÓN": ["1234567", "7654321"],
        "NOMBRE": ["DR GARCIA MARTINEZ JUAN CARLOS", "DRA LOPEZ RUIZ MARIA ELENA"],
        "ESTADO": ["ACTIVO", "INACTIVO"],
        "PROGRAMA / ESPECIALIDAD": ["MEDICINA GENERAL", "LABORATORIO CLINICO"],
        "ÁREA": ["CONSULTA EXTERNA", "APOYO DIAGNOSTICO"],
    })


def _conn_mock(total_bd=2):
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.rowcount = 1
    cur.fetchone.return_value = (total_bd,)
    return conn, cur


class TestCargarMedicosResultadoJson:

    def test_imprime_una_sola_linea_result_json_al_final(self, capsys):
        conn, _ = _conn_mock(total_bd=2)
        with patch.object(em, "get_db_conn", return_value=conn), \
             patch.object(em.pd, "read_excel", return_value=_df_medicos()):
            resultado = em.cargar_medicos(Path("cualquier.xlsx"))

        salida = capsys.readouterr().out
        lineas_json = [l for l in salida.splitlines() if l.startswith("RESULT_JSON:")]
        assert len(lineas_json) == 1

        parseado = json.loads(lineas_json[0][len("RESULT_JSON:"):])
        assert parseado == resultado

    def test_resultado_json_tiene_las_claves_esperadas(self, capsys):
        conn, _ = _conn_mock(total_bd=2)
        with patch.object(em, "get_db_conn", return_value=conn), \
             patch.object(em.pd, "read_excel", return_value=_df_medicos()):
            em.cargar_medicos(Path("archivo.xlsx"))

        salida = capsys.readouterr().out
        linea = next(l for l in salida.splitlines() if l.startswith("RESULT_JSON:"))
        parseado = json.loads(linea[len("RESULT_JSON:"):])

        assert set(parseado.keys()) == {"archivo", "filas_procesadas", "registros_en_bd", "errores"}
        assert parseado["archivo"] == "archivo.xlsx"
        assert parseado["filas_procesadas"] == 2
        assert parseado["registros_en_bd"] == 2
        assert parseado["errores"] == 0

    def test_upsert_no_borra_nada_solo_inserta_actualiza(self, capsys):
        """No debe haber ningun DELETE/TRUNCATE sobre medicos, solo INSERT..ON CONFLICT."""
        conn, cur = _conn_mock(total_bd=2)
        with patch.object(em, "get_db_conn", return_value=conn), \
             patch.object(em.pd, "read_excel", return_value=_df_medicos()):
            em.cargar_medicos(Path("archivo.xlsx"))

        for call in cur.execute.call_args_list:
            sql = call.args[0].strip().upper()
            assert not sql.startswith("DELETE")
            assert not sql.startswith("TRUNCATE")

        insert_calls = [
            c for c in cur.execute.call_args_list
            if c.args[0].strip().upper().startswith("INSERT INTO MEDICOS")
        ]
        assert len(insert_calls) == 2
        assert "ON CONFLICT" in insert_calls[0].args[0].upper()
