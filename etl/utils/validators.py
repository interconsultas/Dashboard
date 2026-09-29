"""
validators.py
Valida la estructura y tipos del archivo EPS antes de procesar.
"""

# Columnas obligatorias en el archivo DETALLADOS EPS
# Si alguna de estas falta, se aborta la carga completa
COLUMNAS_REQUERIDAS = [
    "Afiliado_Id",
    "CODIGO_TIPO_DOCUMENTO_OP",
    "NUMERO_DE_DOCUMENTO",
    "Fecha_Nacimiento",
    "Edad_Cd",
    "Primer_Apellido",
    "Primer_Nombre",
    "COD_REGIONAL_AFILIADO",
    "DESC_REGIONAL_AFILIADO",
    "CIUDAD_AFILIADO",
    "Sexo_Cd",
    "Ind_Cotizante",
    "CODIGO_NIVEL_INGRESO_OP",
    "CODIGO_SUCURSAL_AFILIADO",
    "DESCRIPCION_SUCURSAL_AFILIADO",
    "COD_REGIONAL_IPS_AFILIADO",
    "DESC_REGIONAL_IPS_AFILIADO",
    "Numero_Consec_Orden_Serie",
    "Numero_Consec_Evento",
    "CODIGO_PRESTACION_OP",
    "DESCRIPCION_PRESTACION",
    "Agrup_Salud_Prest_Desc",
    "Orden_Agrup_Prest_Desc",
    "PERIODO",
    "Fecha_Emision",
    "Codigo_Diagnostico_EPS_Op",
    "Diagnostico_EPS_Desc",
    "CODIGO_SUCURSAL_EMITE",
    "DESCRIPCION_SUCURSAL_EMITE",
    "TIPO_REMITE",
    "NUMERO_REMITE",
    "PRESTADOR_REMITE",
    "CODIGO_SUCURSAL_ATIENDE",
    "DESCRIPCION_SUCURSAL_ATIENDE",
    "CODIGO_TIPO_IDENT_ATIENDE",
    "NUM_IDENT_PRESTADOR_ATIENDE",
    "DESCRIPCION_PRESTADOR_ATIENDE",
    "Tipo_Prestacion_Desc",
    "Origen_Servicio_Desc",
    "Producto_PAC_EPS_Desc",
    "Estado_Autorizacion_Desc",
    "Tipo_Convenio_Desc",
    "Origen_autorizacion_Desc",
    "Tipo_Evento_Desc",
    "Tipo_Cobro_Desc",
    "USUARIO_TXT",
    "CANTIDAD_AUTORIZADA",
]

# Columnas que se eliminan del archivo EPS durante la normalización
COLUMNAS_ELIMINAR = [
    "Direccion_Fisica_Resi_BHE_Txt",
    "Grupo_Etario_Desc",
    "SEXO_GRUPO_ETARIO",
    "Hora_Emision",
    "Codigo_Tipo_Ident_Remite",
    "Numero_Ident_Remite",
    "Prestador_Salud_Desc",
    "Codigo_Agrup_Salud_Prest_Op",
    "Codigo_Orden_Agrup_Prest_Op",
    "Codigo_Tipo_Prestacion_Op",
    "Codigo_Origen_Servicio_Op",
    "Codigo_Producto_PAC_EPS_Op",
    "Codigo_Estado_Autorizacion_Op",
    "Codigo_Tipo_Convenio_Op",
    "Codigo_Origen_autorizacion_Op",
    "Codigo_Tipo_Evento_Op",
    "Codigo_Tipo_Cobro_Op",
    "Fecha_Contabilizacion",
    "Numero_Radicado",
    "Valor_Reservado",
    "Valor_Pagado",
    "$",
    "IPS ASOCIADA",
]

# USUARIO_TXT especiales — no se reportan como "médico no encontrado"
USUARIOS_ESPECIALES = {"AUTNOPOS", "MASIVO"}


def validar_columnas(columnas_archivo: list) -> dict:
    """
    Compara las columnas del archivo contra las requeridas.
    Retorna: { "ok": bool, "faltantes": list, "extra": list }
    """
    cols_upper = {c.strip().upper() for c in columnas_archivo}
    requeridas_upper = {c.upper() for c in COLUMNAS_REQUERIDAS}

    faltantes = [c for c in COLUMNAS_REQUERIDAS if c.upper() not in cols_upper]
    extra = [c for c in columnas_archivo
             if c.strip().upper() not in requeridas_upper
             and c.strip() not in COLUMNAS_ELIMINAR
             and c.strip() not in [
                 "Valor_Autorizado_Prestacion", "Valor_Provision",
                 "Segundo_Apellido", "Segundo_Nombre",
                 "Fecha_Atencion_Prestacion_IVR",
             ]]

    return {
        "ok": len(faltantes) == 0,
        "faltantes": faltantes,
        "extra": extra,
    }
