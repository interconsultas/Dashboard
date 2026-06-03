"""
Fixtures compartidos para los tests del ETL.
"""
import sys
from pathlib import Path

import pytest
import pandas as pd

# Agregar la carpeta etl al path para que los imports funcionen
ETL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ETL_DIR))


@pytest.fixture
def df_autorizaciones_minimo():
    """DataFrame con las columnas mínimas requeridas para el flujo de autorizaciones."""
    return pd.DataFrame({
        "Afiliado_Id": ["100001", "100002"],
        "CODIGO_TIPO_DOCUMENTO_OP": ["CC", "CC"],
        "NUMERO_DE_DOCUMENTO": ["12345678", "87654321"],
        "Fecha_Nacimiento": ["1990-01-15", "1985-06-20"],
        "Edad_Cd": ["34", "39"],
        "Primer_Apellido": ["GARCIA", "LOPEZ"],
        "Segundo_Apellido": ["MARTINEZ", "RUIZ"],
        "Primer_Nombre": ["JUAN", "MARIA"],
        "Segundo_Nombre": ["CARLOS", "ELENA"],
        "COD_REGIONAL_AFILIADO": ["11", "11"],
        "DESC_REGIONAL_AFILIADO": ["BOGOTA", "BOGOTA"],
        "CIUDAD_AFILIADO": ["BOGOTA", "BOGOTA"],
        "Sexo_Cd": ["M", "F"],
        "Ind_Cotizante": ["S", "N"],
        "CODIGO_NIVEL_INGRESO_OP": ["1", "2"],
        "CODIGO_SUCURSAL_AFILIADO": ["1712", "1712"],
        "DESCRIPCION_SUCURSAL_AFILIADO": ["IPS CENTRAL", "IPS CENTRAL"],
        "COD_REGIONAL_IPS_AFILIADO": ["11", "11"],
        "DESC_REGIONAL_IPS_AFILIADO": ["BOGOTA", "BOGOTA"],
        "Numero_Consec_Orden_Serie": ["900001", "900002"],
        "Numero_Consec_Evento": ["1", "2"],
        "CODIGO_PRESTACION_OP": ["890201", "890301"],
        "DESCRIPCION_PRESTACION": ["CONSULTA MEDICINA GENERAL", "LABORATORIO CLINICO"],
        "Agrup_Salud_Prest_Desc": ["CONSULTA", "LABORATORIO"],
        "Orden_Agrup_Prest_Desc": ["CONSULTAS MEDICAS", "LABORATORIOS"],
        "PERIODO": ["202603", "202603"],
        "Fecha_Emision": ["2026-03-01", "2026-03-02"],
        "Fecha_Atencion_Prestacion_IVR": [None, None],
        "Codigo_Diagnostico_EPS_Op": ["Z000", "Z001"],
        "Diagnostico_EPS_Desc": ["EXAMEN GENERAL", "CONTROL GENERAL"],
        "CODIGO_SUCURSAL_EMITE": ["1712", "1712"],
        "DESCRIPCION_SUCURSAL_EMITE": ["IPS CENTRAL", "IPS CENTRAL"],
        "TIPO_REMITE": ["1", "1"],
        "NUMERO_REMITE": ["1234567", "7654321"],
        "PRESTADOR_REMITE": ["DR GARCIA MARTINEZ JUAN CARLOS", "DRA LOPEZ RUIZ MARIA ELENA"],
        "CODIGO_SUCURSAL_ATIENDE": ["1712", "1712"],
        "DESCRIPCION_SUCURSAL_ATIENDE": ["IPS CENTRAL", "IPS CENTRAL"],
        "CODIGO_TIPO_IDENT_ATIENDE": ["NI", "NI"],
        "NUM_IDENT_PRESTADOR_ATIENDE": ["900123456", "900123456"],
        "DESCRIPCION_PRESTADOR_ATIENDE": ["IPS INTERCONSULTAS", "IPS INTERCONSULTAS"],
        "Tipo_Prestacion_Desc": ["Consulta", "Laboratorio"],
        "Origen_Servicio_Desc": ["Ambulatorio", "Ambulatorio"],
        "Producto_PAC_EPS_Desc": ["POS", "POS"],
        "Estado_Autorizacion_Desc": ["Autorizada", "Autorizada"],
        "Tipo_Convenio_Desc": ["Capitado", "Capitado"],
        "Origen_autorizacion_Desc": ["Manual", "Manual"],
        "Tipo_Evento_Desc": ["Consulta", "Procedimiento"],
        "Tipo_Cobro_Desc": ["Evento", "Evento"],
        "USUARIO_TXT": ["JGARCIA", "MLOPEZ"],
        "CANTIDAD_AUTORIZADA": ["1", "3"],
        "Valor_Autorizado_Prestacion": ["50000.00", "120000.50"],
        "Valor_Provision": ["45000.00", "110000.00"],
    })


@pytest.fixture
def catalogo_medicos():
    """Par de diccionarios simulando el catálogo de médicos en memoria."""
    registro_garcia = {
        "usuario_txt": "JGARCIA",
        "identificacion": "1234567",
        "nombre": "DR GARCIA MARTINEZ JUAN CARLOS",
        "estado": "ACTIVO",
        "programa_especialidad": "MEDICINA GENERAL",
        "area": "CONSULTA EXTERNA",
    }
    registro_lopez = {
        "usuario_txt": "MLOPEZ",
        "identificacion": "7654321",
        "nombre": "DRA LOPEZ RUIZ MARIA ELENA",
        "estado": "ACTIVO",
        "programa_especialidad": "LABORATORIO CLINICO",
        "area": "APOYO DIAGNOSTICO",
    }

    catalogo_nombre = {
        "DR GARCIA MARTINEZ JUAN CARLOS": registro_garcia,
        "DRA LOPEZ RUIZ MARIA ELENA": registro_lopez,
    }
    catalogo_usuario = {
        "JGARCIA": registro_garcia,
        "MLOPEZ": registro_lopez,
    }
    return catalogo_nombre, catalogo_usuario
