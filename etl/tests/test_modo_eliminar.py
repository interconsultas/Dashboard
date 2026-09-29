"""Tests para etl_autorizaciones.modo_eliminar"""
from unittest.mock import MagicMock, patch

import pytest

import etl_autorizaciones as ea


def _conn_con_fila(fila):
    """MagicMock de conexión cuyo cursor().fetchone() retorna `fila`."""
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.return_value = fila
    cur.rowcount = 42
    return conn, cur


class TestModoEliminar:

    def test_sale_con_error_si_job_no_existe(self):
        conn, _ = _conn_con_fila(None)
        with patch.object(ea, "get_db_conn", return_value=conn):
            with pytest.raises(SystemExit):
                ea.modo_eliminar("job-inexistente")

    @pytest.mark.parametrize("estado", ["cancelado", "error_fatal", "procesando", "esperando_confirmacion"])
    def test_sale_con_error_si_estado_no_es_eliminable(self, estado):
        conn, _ = _conn_con_fila(("archivo.xlsx", 202603, estado))
        with patch.object(ea, "get_db_conn", return_value=conn):
            with pytest.raises(SystemExit):
                ea.modo_eliminar("job-1")

    def test_sale_con_error_si_no_hay_periodo_detectado(self):
        conn, _ = _conn_con_fila(("archivo.xlsx", None, "exitoso"))
        with patch.object(ea, "get_db_conn", return_value=conn):
            with pytest.raises(SystemExit):
                ea.modo_eliminar("job-1")

    @pytest.mark.parametrize("estado", ["exitoso", "exitoso_con_advertencias", "eliminando"])
    def test_elimina_filas_de_autorizaciones_por_periodo_y_archivo(self, estado):
        conn, cur = _conn_con_fila(("archivo_marzo.xlsx", 202603, estado))
        with patch.object(ea, "get_db_conn", return_value=conn), \
             patch.object(ea, "refrescar_vistas_materializadas") as mock_refresh:
            resultado = ea.modo_eliminar("job-1")

        delete_calls = [
            c for c in cur.execute.call_args_list
            if c.args[0].strip().startswith("DELETE FROM autorizaciones")
        ]
        assert len(delete_calls) == 1
        assert delete_calls[0].args[1] == (202603, "archivo_marzo.xlsx")
        assert resultado["filas_eliminadas"] == 42
        assert resultado["estado"] == "eliminado"
        mock_refresh.assert_called_once_with(conn)

    def test_refresca_vistas_despues_de_eliminar(self):
        conn, cur = _conn_con_fila(("archivo.xlsx", 202603, "exitoso"))
        llamadas = []

        def registrar_delete(*args, **kwargs):
            llamadas.append(("execute", args[0]))

        def registrar_refresh(conn_arg):
            llamadas.append(("refresh", None))

        with patch.object(ea, "get_db_conn", return_value=conn), \
             patch.object(ea, "refrescar_vistas_materializadas", side_effect=registrar_refresh):
            cur.execute.side_effect = lambda *a, **k: registrar_delete(*a, **k)
            ea.modo_eliminar("job-1")

        indices_delete = [i for i, (tipo, q) in enumerate(llamadas) if tipo == "execute" and "DELETE FROM autorizaciones" in q]
        indices_refresh = [i for i, (tipo, _) in enumerate(llamadas) if tipo == "refresh"]
        assert indices_delete and indices_refresh
        assert indices_delete[0] < indices_refresh[0]

    def test_marca_estado_eliminado_al_final(self):
        conn, cur = _conn_con_fila(("archivo.xlsx", 202603, "exitoso"))
        with patch.object(ea, "get_db_conn", return_value=conn), \
             patch.object(ea, "refrescar_vistas_materializadas"):
            ea.modo_eliminar("job-1")

        update_calls = [
            c for c in cur.execute.call_args_list
            if c.args[0].strip().startswith("UPDATE log_cargas")
        ]
        assert len(update_calls) == 1
        assert update_calls[0].args[1][0] == "job-1" or "job-1" in update_calls[0].args[1]

    def test_cierra_conexion_al_final(self):
        conn, cur = _conn_con_fila(("archivo.xlsx", 202603, "exitoso"))
        with patch.object(ea, "get_db_conn", return_value=conn), \
             patch.object(ea, "refrescar_vistas_materializadas"):
            ea.modo_eliminar("job-1")

        conn.close.assert_called_once()
