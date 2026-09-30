"""Tests para etl_autorizaciones.modo_confirm — registro de periodos_detectados.

Cubre el bug reportado: log_cargas.periodo_detectado es una columna INT de
un solo valor. Cuando un archivo abarca varios periodos (ej. un corte
semanal que cruza fin de mes), modo_confirm inserta correctamente en TODOS
los periodos reales (via particiones creadas por periodo), pero nunca
actualizaba log_cargas con la lista completa — el historial mostraba solo
el primer periodo detectado, incluso para una corrida que en la practica
solo inserto filas de otro periodo (por deduplicacion de hash).
"""
from unittest.mock import MagicMock, patch

import etl_autorizaciones as ea


def _conn_para_confirm(fila_log, periodos_staging, columnas_staging, total_staging, rowcount):
    """MagicMock de conexion que reproduce la secuencia de fetchone/fetchall
    de modo_confirm: primero el SELECT de log_cargas (fetchone), despues el
    SELECT DISTINCT periodo de staging (fetchall), despues el COUNT(*) de
    staging (fetchone), y por ultimo el SELECT de columnas de staging
    (fetchall)."""
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.side_effect = [fila_log, (total_staging,)]
    cur.fetchall.side_effect = [periodos_staging, columnas_staging]
    cur.rowcount = rowcount
    return conn, cur


class TestModoConfirmPeriodosDetectados:

    def test_guarda_todos_los_periodos_reales_de_staging(self):
        """Aunque log_cargas.periodo_detectado solo tenga el primer periodo
        (202602), el archivo trae dos periodos en staging — el UPDATE final
        debe guardar la lista completa, no solo el que ya estaba en el log."""
        fila_log = ("archivo_multi.xlsx", "hash123", 202602, 100, "esperando_confirmacion")
        periodos_staging = [(202602,), (202603,)]
        columnas_staging = [("periodo",), ("hash_fila",)]

        conn, cur = _conn_para_confirm(
            fila_log, periodos_staging, columnas_staging, total_staging=100, rowcount=100
        )

        with patch.object(ea, "get_db_conn", return_value=conn), \
             patch.object(ea, "refrescar_vistas_materializadas"):
            ea.modo_confirm("job-1")

        updates_con_periodos = [
            c for c in cur.execute.call_args_list
            if "UPDATE log_cargas" in c.args[0] and "periodos_detectados" in c.args[0]
        ]
        assert len(updates_con_periodos) == 1
        assert [202602, 202603] in updates_con_periodos[0].args[1]

    def test_guarda_ambos_periodos_aunque_solo_se_inserten_filas_de_uno(self):
        """Regresion exacta del caso real de hoy: el primer --confirm de un
        archivo multi-periodo puede insertar solo un periodo porque el otro
        ya existia como duplicado por hash (ON CONFLICT DO NOTHING). Aun asi
        periodos_detectados debe reflejar los periodos que trae el archivo
        (via staging), no cuantos terminaron insertados."""
        fila_log = ("archivo_multi.xlsx", "hash456", 202602, 100, "esperando_confirmacion")
        periodos_staging = [(202602,), (202603,)]
        columnas_staging = [("periodo",), ("hash_fila",)]

        # rowcount bajo: como si la mayoria de las filas (de 202602) hubieran
        # sido duplicadas y solo se insertaran las de 202603.
        conn, cur = _conn_para_confirm(
            fila_log, periodos_staging, columnas_staging, total_staging=100, rowcount=20
        )

        with patch.object(ea, "get_db_conn", return_value=conn), \
             patch.object(ea, "refrescar_vistas_materializadas"):
            ea.modo_confirm("job-1")

        updates_con_periodos = [
            c for c in cur.execute.call_args_list
            if "UPDATE log_cargas" in c.args[0] and "periodos_detectados" in c.args[0]
        ]
        assert len(updates_con_periodos) == 1
        assert [202602, 202603] in updates_con_periodos[0].args[1]

    def test_un_solo_periodo_sigue_funcionando(self):
        fila_log = ("archivo.xlsx", "hash789", 202603, 50, "esperando_confirmacion")
        periodos_staging = [(202603,)]
        columnas_staging = [("periodo",), ("hash_fila",)]

        conn, cur = _conn_para_confirm(
            fila_log, periodos_staging, columnas_staging, total_staging=50, rowcount=50
        )

        with patch.object(ea, "get_db_conn", return_value=conn), \
             patch.object(ea, "refrescar_vistas_materializadas"):
            resultado = ea.modo_confirm("job-1")

        updates_con_periodos = [
            c for c in cur.execute.call_args_list
            if "UPDATE log_cargas" in c.args[0] and "periodos_detectados" in c.args[0]
        ]
        assert len(updates_con_periodos) == 1
        assert [202603] in updates_con_periodos[0].args[1]
        assert resultado["periodo_detectado"] == 202603


class TestRegistrarLogPeriodosDetectados:

    def test_insert_incluye_periodos_detectados(self):
        conn = MagicMock()
        cur = conn.cursor.return_value

        informe = {
            "nombre_archivo": "archivo.xlsx",
            "hash_archivo": "abc",
            "periodo_detectado": 202602,
            "periodos_detectados": [202602, 202603],
            "filas_en_archivo": 10,
        }

        ea.registrar_log(conn, "job-1", informe, "previsualizando")

        insert_calls = [
            c for c in cur.execute.call_args_list
            if "INSERT INTO log_cargas" in c.args[0]
        ]
        assert len(insert_calls) == 1
        sql, params = insert_calls[0].args
        assert "periodos_detectados" in sql
        assert [202602, 202603] in params

    def test_on_conflict_actualiza_periodos_detectados(self):
        """A diferencia de periodo_detectado (que queda fijo tras el primer
        insert), periodos_detectados SI debe poder actualizarse en conflictos
        futuros — el ON CONFLICT DO UPDATE SET debe incluirla."""
        conn = MagicMock()
        cur = conn.cursor.return_value

        informe = {
            "nombre_archivo": "archivo.xlsx",
            "periodo_detectado": 202602,
            "periodos_detectados": [202602, 202603],
        }

        ea.registrar_log(conn, "job-1", informe, "exitoso")

        sql = cur.execute.call_args_list[0].args[0]
        on_conflict = sql.split("ON CONFLICT")[1]
        assert "periodos_detectados" in on_conflict
