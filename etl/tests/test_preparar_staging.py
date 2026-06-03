"""Tests para etl_autorizaciones.preparar_para_staging"""
import pandas as pd

from etl_autorizaciones import (
    preparar_para_staging,
    COLUMNAS_STAGING_ORDERED,
    MAPA_COLUMNAS,
)


def _df_minimo():
    """DataFrame con columnas ya cruzadas listas para staging."""
    return pd.DataFrame({
        "Afiliado_Id": ["100001"],
        "CODIGO_TIPO_DOCUMENTO_OP": ["CC"],
        "NUMERO_DE_DOCUMENTO": ["12345678"],
        "Fecha_Nacimiento": [pd.Timestamp("1990-01-15")],
        "Edad_Cd": [34],
        "Primer_Apellido": ["GARCIA"],
        "Segundo_Apellido": ["MARTINEZ"],
        "Primer_Nombre": ["JUAN"],
        "Segundo_Nombre": ["CARLOS"],
        "COD_REGIONAL_AFILIADO": [11],
        "DESC_REGIONAL_AFILIADO": ["BOGOTA"],
        "CIUDAD_AFILIADO": ["BOGOTA"],
        "Sexo_Cd": ["M"],
        "Ind_Cotizante": ["S"],
        "CODIGO_NIVEL_INGRESO_OP": ["1"],
        "CODIGO_SUCURSAL_AFILIADO": [1712],
        "DESCRIPCION_SUCURSAL_AFILIADO": ["IPS CENTRAL"],
        "COD_REGIONAL_IPS_AFILIADO": [11],
        "DESC_REGIONAL_IPS_AFILIADO": ["BOGOTA"],
        "Numero_Consec_Orden_Serie": ["900001"],
        "Numero_Consec_Evento": [1],
        "CODIGO_PRESTACION_OP": ["890201"],
        "DESCRIPCION_PRESTACION": ["CONSULTA"],
        "Agrup_Salud_Prest_Desc": ["CONSULTA"],
        "Orden_Agrup_Prest_Desc": ["CONSULTAS MEDICAS"],
        "PERIODO": [202603],
        "Fecha_Emision": [pd.Timestamp("2026-03-01")],
        "Fecha_Atencion_Prestacion_IVR": [None],
        "fecha_digitacion": [None],
        "FECHA_PROGRAMACION": [None],
        "FECHA_ATENCION": [None],
        "Codigo_Diagnostico_EPS_Op": ["Z000"],
        "Diagnostico_EPS_Desc": ["EXAMEN"],
        "CODIGO_SUCURSAL_EMITE": [1712],
        "DESCRIPCION_SUCURSAL_EMITE": ["IPS CENTRAL"],
        "TIPO_REMITE": ["1"],
        "NUMERO_REMITE": [1234567],
        "PRESTADOR_REMITE": ["DR GARCIA"],
        "CODIGO_ESPECIALIDAD_OP_REMITE": [None],
        "ESPECIALIDAD_DESC_REMITE": [None],
        "USUARIO_TXT": ["JGARCIA"],
        "NOMBRE": ["DR GARCIA MARTINEZ JUAN CARLOS"],
        "ESTADO_MEDICO": ["ACTIVO"],
        "PROGRAMA_ESPECIALIDAD": ["MEDICINA GENERAL"],
        "AREA": ["CONSULTA EXTERNA"],
        "CODIGO_SUCURSAL_ATIENDE": [1712],
        "DESCRIPCION_SUCURSAL_ATIENDE": ["IPS CENTRAL"],
        "CODIGO_TIPO_IDENT_ATIENDE": ["NI"],
        "NUM_IDENT_PRESTADOR_ATIENDE": [900123456],
        "DESCRIPCION_PRESTADOR_ATIENDE": ["IPS INTERCONSULTAS"],
        "Tipo_Prestacion_Desc": ["Consulta"],
        "Origen_Servicio_Desc": ["Ambulatorio"],
        "Producto_PAC_EPS_Desc": ["POS"],
        "Estado_Autorizacion_Desc": ["Autorizada"],
        "Tipo_Convenio_Desc": ["Capitado"],
        "Origen_autorizacion_Desc": ["Manual"],
        "Tipo_Evento_Desc": ["Consulta"],
        "Tipo_Cobro_Desc": ["Evento"],
        "CANTIDAD_AUTORIZADA": [1],
        "Valor_Autorizado_Prestacion": [50000.0],
        "Valor_Provision": [45000.0],
    })


class TestPrepararParaStaging:

    def test_columnas_resultado_son_las_del_staging(self):
        df = _df_minimo()
        resultado = preparar_para_staging(df)
        assert list(resultado.columns) == COLUMNAS_STAGING_ORDERED

    def test_hash_fila_generado(self):
        df = _df_minimo()
        resultado = preparar_para_staging(df)
        assert resultado["hash_fila"].iloc[0] is not None
        assert len(resultado["hash_fila"].iloc[0]) == 64

    def test_renombrado_correcto(self):
        df = _df_minimo()
        resultado = preparar_para_staging(df)
        assert resultado["afiliado_id"].iloc[0] == "100001"
        assert resultado["nombre_medico"].iloc[0] == "DR GARCIA MARTINEZ JUAN CARLOS"
        assert resultado["estado_medico"].iloc[0] == "ACTIVO"

    def test_columnas_extra_ignoradas(self):
        """Columnas adicionales del archivo EPS deben eliminarse en el resultado."""
        df = _df_minimo()
        df["COLUMNA_EXTRA_EPS"] = ["valor_extra"]
        df["OTRA_COLUMNA_PERIODO"] = ["dato"]
        resultado = preparar_para_staging(df)

        assert "COLUMNA_EXTRA_EPS" not in resultado.columns
        assert "OTRA_COLUMNA_PERIODO" not in resultado.columns
        assert list(resultado.columns) == COLUMNAS_STAGING_ORDERED

    def test_columnas_faltantes_rellenadas_con_none(self):
        """Si faltan columnas opcionales, se rellenan con None."""
        df = pd.DataFrame({
            "Numero_Consec_Orden_Serie": ["900001"],
            "Numero_Consec_Evento": [1],
            "CODIGO_PRESTACION_OP": ["890201"],
            "PERIODO": [202603],
        })
        resultado = preparar_para_staging(df)
        assert list(resultado.columns) == COLUMNAS_STAGING_ORDERED
        assert resultado["hash_fila"].iloc[0] is not None

    def test_hash_fila_deterministico(self):
        df1 = _df_minimo()
        df2 = _df_minimo()
        r1 = preparar_para_staging(df1)
        r2 = preparar_para_staging(df2)
        assert r1["hash_fila"].iloc[0] == r2["hash_fila"].iloc[0]

    def test_hash_fila_diferente_para_datos_diferentes(self):
        df1 = _df_minimo()
        df2 = _df_minimo()
        df2["Numero_Consec_Orden_Serie"] = ["999999"]
        r1 = preparar_para_staging(df1)
        r2 = preparar_para_staging(df2)
        assert r1["hash_fila"].iloc[0] != r2["hash_fila"].iloc[0]
