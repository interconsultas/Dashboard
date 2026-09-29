"""Tests para etl_autorizaciones.refrescar_vistas_materializadas"""
from unittest.mock import MagicMock

from etl_autorizaciones import refrescar_vistas_materializadas

VISTAS_ESPERADAS = [
    "vm_filtros_dashboard",
    "vm_dash_laboratorios",
    "vm_dash_rx",
    "vm_dash_ecografias",
    "vm_dash_remisiones_cap",
    "vm_dash_medicamentos",
    "vm_dash_remisiones_ext",
    "vm_dash_proc_dx",
]


class TestRefrescarVistasMaterializadas:

    def test_refresca_las_8_vistas_en_orden(self):
        conn = MagicMock()
        cur = conn.cursor.return_value

        refrescar_vistas_materializadas(conn)

        queries = [call.args[0] for call in cur.execute.call_args_list]
        assert len(queries) == len(VISTAS_ESPERADAS)
        for vista, query in zip(VISTAS_ESPERADAS, queries):
            assert f"REFRESH MATERIALIZED VIEW CONCURRENTLY {vista}" == query

    def test_hace_commit_despues_de_cada_vista(self):
        conn = MagicMock()

        refrescar_vistas_materializadas(conn)

        assert conn.commit.call_count == len(VISTAS_ESPERADAS)

    def test_tolera_error_en_una_vista_y_sigue_con_las_demas(self):
        conn = MagicMock()
        cur = conn.cursor.return_value
        cur.execute.side_effect = [None, Exception("vista no existe")] + [None] * 6

        # No debe propagar la excepción
        refrescar_vistas_materializadas(conn)

        assert cur.execute.call_count == len(VISTAS_ESPERADAS)
        assert conn.rollback.call_count == 1
        assert conn.commit.call_count == len(VISTAS_ESPERADAS) - 1

    def test_cierra_el_cursor_al_final(self):
        conn = MagicMock()
        cur = conn.cursor.return_value

        refrescar_vistas_materializadas(conn)

        cur.close.assert_called_once()
