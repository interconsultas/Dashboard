"""Tests para utils/validators.py"""
from utils.validators import validar_columnas, COLUMNAS_REQUERIDAS, COLUMNAS_ELIMINAR


class TestValidarColumnas:

    def test_todas_las_columnas_presentes(self):
        resultado = validar_columnas(list(COLUMNAS_REQUERIDAS))
        assert resultado["ok"] is True
        assert resultado["faltantes"] == []

    def test_columnas_faltantes_detectadas(self):
        columnas = [c for c in COLUMNAS_REQUERIDAS if c != "PERIODO"]
        resultado = validar_columnas(columnas)
        assert resultado["ok"] is False
        assert "PERIODO" in resultado["faltantes"]

    def test_multiples_columnas_faltantes(self):
        eliminar = {"PERIODO", "Afiliado_Id", "USUARIO_TXT"}
        columnas = [c for c in COLUMNAS_REQUERIDAS if c not in eliminar]
        resultado = validar_columnas(columnas)
        assert resultado["ok"] is False
        assert len(resultado["faltantes"]) == 3

    def test_columnas_extra_reportadas(self):
        """Archivos con columnas de más deben reportarse pero no bloquear."""
        columnas = list(COLUMNAS_REQUERIDAS) + ["COLUMNA_NUEVA_EPS", "OTRA_EXTRA"]
        resultado = validar_columnas(columnas)
        assert resultado["ok"] is True
        assert "COLUMNA_NUEVA_EPS" in resultado["extra"]
        assert "OTRA_EXTRA" in resultado["extra"]

    def test_columnas_extra_no_incluyen_eliminables(self):
        """Columnas de COLUMNAS_ELIMINAR no se reportan como extra."""
        columnas = list(COLUMNAS_REQUERIDAS) + [COLUMNAS_ELIMINAR[0]]
        resultado = validar_columnas(columnas)
        assert resultado["ok"] is True
        assert COLUMNAS_ELIMINAR[0] not in resultado["extra"]

    def test_columnas_extra_no_incluyen_opcionales_conocidas(self):
        """Valor_Autorizado_Prestacion, Valor_Provision, etc. no son extra."""
        columnas = list(COLUMNAS_REQUERIDAS) + [
            "Valor_Autorizado_Prestacion",
            "Valor_Provision",
            "Segundo_Apellido",
            "Segundo_Nombre",
            "Fecha_Atencion_Prestacion_IVR",
        ]
        resultado = validar_columnas(columnas)
        assert resultado["ok"] is True
        assert resultado["extra"] == []

    def test_comparacion_case_insensitive(self):
        columnas = [c.upper() for c in COLUMNAS_REQUERIDAS]
        resultado = validar_columnas(columnas)
        assert resultado["ok"] is True

    def test_columnas_con_espacios_extra(self):
        columnas = [f"  {c}  " for c in COLUMNAS_REQUERIDAS]
        resultado = validar_columnas(columnas)
        assert resultado["ok"] is True

    def test_lista_vacia_falla(self):
        resultado = validar_columnas([])
        assert resultado["ok"] is False
        assert len(resultado["faltantes"]) == len(COLUMNAS_REQUERIDAS)

    def test_columnas_extra_multiples_periodos(self):
        """Simula archivo real con columnas sobrantes de distintos periodos."""
        extras = ["IPS ASOCIADA", "COLUMNA_PERIODO_ABRIL", "DATO_EXTRA_2026"]
        columnas = list(COLUMNAS_REQUERIDAS) + extras
        resultado = validar_columnas(columnas)
        assert resultado["ok"] is True
        # IPS ASOCIADA está en COLUMNAS_ELIMINAR, no debe aparecer en extra
        assert "IPS ASOCIADA" not in resultado["extra"]
        assert "COLUMNA_PERIODO_ABRIL" in resultado["extra"]
