"""Tests para el chequeo de duplicado por hash en modo_preview.

Cubre la corrección del issue #3: recargar el mismo archivo después de
eliminarlo no debe seguir bloqueado como 'ya_procesado'.
"""
from unittest.mock import MagicMock, patch

import etl_autorizaciones as ea


class TestChequeoDuplicadoExcluyeEliminado:

    def test_la_query_de_chequeo_excluye_estado_eliminado(self, tmp_path):
        conn = MagicMock()
        cur = conn.cursor.return_value
        cur.fetchone.return_value = None  # no se encuentra duplicado bloqueante

        archivo = tmp_path / "archivo.xlsx"
        archivo.write_bytes(b"contenido-de-prueba")

        with patch.object(ea, "get_db_conn", return_value=conn), \
             patch.object(ea, "hash_archivo", return_value="a" * 64), \
             patch.object(ea, "leer_y_limpiar", side_effect=ValueError("detener test aqui")):
            ea.modo_preview(archivo, force=False)

        queries_chequeo = [
            c.args[0] for c in cur.execute.call_args_list
            if "FROM log_cargas" in c.args[0] and "hash_archivo" in c.args[0]
        ]
        assert len(queries_chequeo) == 1
        assert "'eliminado'" in queries_chequeo[0]
        assert "'cancelado'" in queries_chequeo[0]
        assert "'error_fatal'" in queries_chequeo[0]
