"""Tests para etl_autorizaciones.cruzar_medicos"""
import pandas as pd

from etl_autorizaciones import cruzar_medicos


def _df_base(**overrides):
    """Crea un DataFrame mínimo para cruzar_medicos."""
    datos = {
        "PRESTADOR_REMITE": ["DR GARCIA MARTINEZ JUAN CARLOS"],
        "USUARIO_TXT": ["JGARCIA"],
        "NUMERO_REMITE": ["1234567"],
    }
    datos.update(overrides)
    return pd.DataFrame(datos)


class TestCruzarMedicos:

    def test_match_por_usuario_txt(self, catalogo_medicos):
        cat_nombre, cat_usuario = catalogo_medicos
        df = _df_base()
        df_result, stats = cruzar_medicos(df, cat_nombre, cat_usuario)

        assert df_result["NOMBRE"].iloc[0] == "DR GARCIA MARTINEZ JUAN CARLOS"
        assert df_result["ESTADO_MEDICO"].iloc[0] == "ACTIVO"
        assert df_result["PROGRAMA_ESPECIALIDAD"].iloc[0] == "MEDICINA GENERAL"
        assert df_result["AREA"].iloc[0] == "CONSULTA EXTERNA"

    def test_fallback_a_prestador_remite(self, catalogo_medicos):
        """Si USUARIO_TXT no existe en catálogo, usa PRESTADOR_REMITE."""
        cat_nombre, cat_usuario = catalogo_medicos
        df = _df_base(USUARIO_TXT=["USUARIO_DESCONOCIDO"])
        df_result, stats = cruzar_medicos(df, cat_nombre, cat_usuario)

        assert df_result["NOMBRE"].iloc[0] == "DR GARCIA MARTINEZ JUAN CARLOS"
        assert df_result["ESTADO_MEDICO"].iloc[0] == "ACTIVO"

    def test_medico_no_encontrado_reportado_y_externo(self, catalogo_medicos):
        """Médico no encontrado se reporta en stats Y recibe ESTADO_MEDICO='EXTERNO'."""
        cat_nombre, cat_usuario = catalogo_medicos
        df = _df_base(
            USUARIO_TXT=["XDESCONOCIDO"],
            PRESTADOR_REMITE=["DR PEREZ GOMEZ CARLOS"],
        )
        df_result, stats = cruzar_medicos(df, cat_nombre, cat_usuario)

        assert df_result["ESTADO_MEDICO"].iloc[0] == "EXTERNO"
        assert pd.isna(df_result["PROGRAMA_ESPECIALIDAD"].iloc[0])
        assert stats["total"] == 1
        assert "DR PEREZ GOMEZ CARLOS" in stats["nombres"]

    def test_usuario_especial_no_reportado(self, catalogo_medicos):
        """AUTNOPOS y MASIVO no se reportan como médico no encontrado."""
        cat_nombre, cat_usuario = catalogo_medicos
        df = _df_base(
            USUARIO_TXT=["AUTNOPOS"],
            PRESTADOR_REMITE=["ALGUN PRESTADOR"],
        )
        df_result, stats = cruzar_medicos(df, cat_nombre, cat_usuario)
        assert stats["total"] == 0

    def test_usuario_internet_no_reportado(self, catalogo_medicos):
        cat_nombre, cat_usuario = catalogo_medicos
        df = _df_base(
            USUARIO_TXT=["INTERNET"],
            PRESTADOR_REMITE=["PRESTADOR X"],
        )
        df_result, stats = cruzar_medicos(df, cat_nombre, cat_usuario)
        assert stats["total"] == 0

    def test_sin_columna_usuario_txt(self, catalogo_medicos):
        """Si no existe la columna USUARIO_TXT, se crea automáticamente."""
        cat_nombre, cat_usuario = catalogo_medicos
        df = pd.DataFrame({
            "PRESTADOR_REMITE": ["DR GARCIA MARTINEZ JUAN CARLOS"],
            "NUMERO_REMITE": ["1234567"],
        })
        df_result, stats = cruzar_medicos(df, cat_nombre, cat_usuario)
        assert "NOMBRE" in df_result.columns

    def test_multiples_filas(self, catalogo_medicos):
        cat_nombre, cat_usuario = catalogo_medicos
        df = pd.DataFrame({
            "PRESTADOR_REMITE": [
                "DR GARCIA MARTINEZ JUAN CARLOS",
                "DRA LOPEZ RUIZ MARIA ELENA",
                "DR EXTERNO DESCONOCIDO",
            ],
            "USUARIO_TXT": ["JGARCIA", "MLOPEZ", "XEXTERNO"],
            "NUMERO_REMITE": ["1234567", "7654321", "9999999"],
        })
        df_result, stats = cruzar_medicos(df, cat_nombre, cat_usuario)

        assert df_result["ESTADO_MEDICO"].iloc[0] == "ACTIVO"
        assert df_result["ESTADO_MEDICO"].iloc[1] == "ACTIVO"
        assert df_result["ESTADO_MEDICO"].iloc[2] == "EXTERNO"
        assert pd.isna(df_result["PROGRAMA_ESPECIALIDAD"].iloc[2])
        assert stats["total"] == 1

    def test_prestador_nulo(self, catalogo_medicos):
        """Fila sin PRESTADOR_REMITE no debe causar error."""
        cat_nombre, cat_usuario = catalogo_medicos
        df = _df_base(
            PRESTADOR_REMITE=[None],
            USUARIO_TXT=["JGARCIA"],
        )
        df_result, stats = cruzar_medicos(df, cat_nombre, cat_usuario)
        assert df_result["NOMBRE"].iloc[0] == "DR GARCIA MARTINEZ JUAN CARLOS"

    def test_estado_externo_para_no_encontrados(self, catalogo_medicos):
        """Médicos no encontrados en catálogo reciben estado EXTERNO."""
        cat_nombre, cat_usuario = catalogo_medicos
        df = _df_base(
            USUARIO_TXT=["XDESCONOCIDO"],
            PRESTADOR_REMITE=["DR NUEVO PROFESIONAL"],
        )
        df_result, stats = cruzar_medicos(df, cat_nombre, cat_usuario)
        assert df_result["ESTADO_MEDICO"].iloc[0] == "EXTERNO"
