"""
etl_citas.py
Carga las citas atendidas por profesional desde el Excel del cliente a la
tabla citas_atendidas. Es idempotente: se puede ejecutar múltiples veces sin
duplicar datos, y nunca elimina periodos.

Formato esperado: una hoja (por defecto 'Tabla_CitasConfirmadas') con una
columna de cédula ('ID MD') y una columna por periodo ('202601', 'ene-26' o
una fecha). Las demás columnas se ignoran.

Uso:
    python etl_citas.py --archivo "ruta/al/archivo.xlsx"
"""
import re
import sys
import json
import argparse
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import openpyxl

from config import get_db_conn


HOJA_PREFERIDA = "tabla_citasconfirmadas"
FILAS_ENCABEZADO = 10
MAX_ADVERTENCIAS = 50

# Encabezados normalizados (mayúsculas, sin tildes, espacios simples)
ENCABEZADOS_ID = {"ID MD", "CEDULA", "DOCUMENTO", "IDENTIFICACION"}
ENCABEZADOS_NOMBRE = {"PROFESIONAL", "NOMBRE", "MEDICO"}

MESES = {
    "ene": 1, "enero": 1,
    "feb": 2, "febrero": 2,
    "mar": 3, "marzo": 3,
    "abr": 4, "abril": 4,
    "may": 5, "mayo": 5,
    "jun": 6, "junio": 6,
    "jul": 7, "julio": 7,
    "ago": 8, "agosto": 8,
    "sep": 9, "sept": 9, "set": 9, "septiembre": 9, "setiembre": 9,
    "oct": 10, "octubre": 10,
    "nov": 11, "noviembre": 11,
    "dic": 12, "diciembre": 12,
}
RE_PERIODO_MES = re.compile(r"^([a-z]+)\.?[\s\-/_]*(\d{4}|\d{2})$")

ANIO_MIN, ANIO_MAX = 2000, 2100
CEDULA_MAX = 10 ** 15 - 1     # misma cota que la API del dashboard (15 dígitos)
CITAS_MAX = 2147483647        # cantidad_citas es INT

SQL_CATALOGO = """
    SELECT identificacion, nombre, programa_meta
    FROM medicos
    WHERE identificacion = ANY(%s)
"""

# El programa ya guardado para un periodo se conserva: solo se llena si es NULL
SQL_UPSERT = """
    INSERT INTO citas_atendidas (documento, periodo, cantidad_citas, nombre_medico, programa)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (documento, periodo) DO UPDATE SET
        cantidad_citas = EXCLUDED.cantidad_citas,
        nombre_medico  = EXCLUDED.nombre_medico,
        programa       = COALESCE(citas_atendidas.programa, EXCLUDED.programa)
"""


class ErrorArchivo(Exception):
    """El archivo no tiene el formato esperado. El mensaje se muestra al usuario."""

    def __init__(self, mensaje: str, tiene_cedula: bool = False):
        super().__init__(mensaje)
        self.tiene_cedula = tiene_cedula


@dataclass
class Encabezado:
    fila: int                  # número de fila en la hoja (desde 1)
    col_id: int                # índice de columna (desde 0)
    col_nombre: int | None
    periodos: dict[int, int]   # índice de columna → periodo YYYYMM


@dataclass
class Lectura:
    registros: list[tuple[int, int, int]] = field(default_factory=list)  # (documento, periodo, citas)
    nombres: dict[int, str | None] = field(default_factory=dict)         # nombre según la hoja
    advertencias: list[str] = field(default_factory=list)


# ─────────────────────────────────────────────
# Interpretación de celdas
# ─────────────────────────────────────────────

def _normalizar(valor) -> str:
    """Texto en mayúsculas, sin tildes y con espacios simples."""
    if not isinstance(valor, str):
        return ""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", valor) if unicodedata.category(c) != "Mn"
    )
    return " ".join(sin_tildes.split()).upper()


def _periodo_valido(anio: int, mes: int) -> int | None:
    if ANIO_MIN <= anio <= ANIO_MAX and 1 <= mes <= 12:
        return anio * 100 + mes
    return None


def _entero(valor) -> int | None:
    """Entero representado por la celda, o None si no es un entero sin signo."""
    if isinstance(valor, bool):
        return None
    if isinstance(valor, int):
        return valor
    if isinstance(valor, float):
        return int(valor) if valor.is_integer() else None
    if isinstance(valor, str) and re.fullmatch(r"\d+", valor.strip()):
        return int(valor.strip())
    return None


def parsear_periodo(valor) -> int | None:
    """Periodo YYYYMM de un encabezado: 202601, 'ene-26', 'ENERO 2026' o una fecha."""
    if isinstance(valor, date):   # incluye datetime
        return _periodo_valido(valor.year, valor.month)

    numero = _entero(valor)
    if numero is not None:
        return _periodo_valido(numero // 100, numero % 100) if 100000 <= numero <= 999999 else None

    if isinstance(valor, str):
        m = RE_PERIODO_MES.match(valor.strip().lower())
        if m and m.group(1) in MESES:
            anio = int(m.group(2))
            return _periodo_valido(anio + 2000 if anio < 100 else anio, MESES[m.group(1)])
    return None


def parsear_cedula(valor) -> int | None:
    """Cédula como entero positivo, o None si la celda está vacía o no es numérica."""
    numero = _entero(valor)
    if numero is None or not 0 < numero <= CEDULA_MAX:
        return None
    return numero


def parsear_cantidad(valor) -> int | None:
    """
    Cantidad de citas de una celda. Retorna None si la celda está vacía (no hay
    registro) y lanza ValueError si el valor no es un entero mayor o igual que
    cero: nunca se aproxima ni se adivina.
    """
    if valor is None or (isinstance(valor, str) and valor.strip() == ""):
        return None
    numero = _entero(valor)
    if numero is None or not 0 <= numero <= CITAS_MAX:
        raise ValueError(valor)
    return numero


# ─────────────────────────────────────────────
# Lectura de la hoja
# ─────────────────────────────────────────────

def _celda(fila: tuple, indice: int | None):
    if indice is None or indice >= len(fila):
        return None
    return fila[indice]


def detectar_encabezado(ws) -> Encabezado:
    """Busca en las primeras filas la que tiene la columna de cédula y los periodos."""
    vio_cedula = False

    for n, fila in enumerate(
        ws.iter_rows(min_row=1, max_row=FILAS_ENCABEZADO, values_only=True), start=1
    ):
        titulos = [_normalizar(v) for v in fila]
        col_id = next((i for i, t in enumerate(titulos) if t in ENCABEZADOS_ID), None)
        if col_id is None:
            continue
        vio_cedula = True

        periodos: dict[int, int] = {}
        for i, valor in enumerate(fila):
            periodo = parsear_periodo(valor) if i != col_id else None
            if periodo is None:
                continue
            if periodo in periodos.values():
                raise ErrorArchivo(
                    f"El periodo {periodo} aparece en más de una columna de la hoja "
                    f"'{ws.title}'. Deje una sola columna por periodo.",
                    tiene_cedula=True,
                )
            periodos[i] = periodo
        if not periodos:
            continue

        col_nombre = next((i for i, t in enumerate(titulos) if t in ENCABEZADOS_NOMBRE), None)
        return Encabezado(fila=n, col_id=col_id, col_nombre=col_nombre, periodos=periodos)

    if vio_cedula:
        raise ErrorArchivo(
            f"No se encontró ninguna columna de periodo en la hoja '{ws.title}'. "
            "Los encabezados de los meses deben ser como 202601 o ene-26.",
            tiene_cedula=True,
        )
    raise ErrorArchivo(
        f"No se encontró la columna de cédula en las primeras {FILAS_ENCABEZADO} filas de la "
        f"hoja '{ws.title}'. El encabezado debe ser ID MD, CÉDULA, DOCUMENTO o IDENTIFICACIÓN."
    )


def seleccionar_hoja(wb):
    """
    Retorna (hoja, encabezado). Usa la hoja 'Tabla_CitasConfirmadas' si existe;
    si no, la primera hoja cuyo encabezado tenga cédula y periodos.
    """
    for ws in wb.worksheets:
        if "".join(ws.title.split()).lower() == HOJA_PREFERIDA:
            return ws, detectar_encabezado(ws)

    errores: list[ErrorArchivo] = []
    for ws in wb.worksheets:
        try:
            return ws, detectar_encabezado(ws)
        except ErrorArchivo as e:
            errores.append(e)

    if len(errores) == 1:
        raise errores[0]
    if any(e.tiene_cedula for e in errores):
        raise ErrorArchivo(
            "Ninguna hoja del archivo tiene columnas de periodo junto a la columna de "
            "identificación. Los encabezados de los meses deben ser como 202601 o ene-26.",
            tiene_cedula=True,
        )
    raise ErrorArchivo(
        "Ninguna hoja del archivo tiene la columna de cédula. "
        "El encabezado debe ser ID MD, CÉDULA, DOCUMENTO o IDENTIFICACIÓN."
    )


def leer_registros(ws, enc: Encabezado) -> Lectura:
    """Convierte las filas de la hoja en registros (documento, periodo, citas)."""
    lectura = Lectura()
    vistas: set[int] = set()

    for n, fila in enumerate(
        ws.iter_rows(min_row=enc.fila + 1, values_only=True), start=enc.fila + 1
    ):
        documento = parsear_cedula(_celda(fila, enc.col_id))
        if documento is None:
            continue

        registros = []
        advertencias = []
        for col, periodo in enc.periodos.items():
            valor = _celda(fila, col)
            try:
                cantidad = parsear_cantidad(valor)
            except ValueError:
                advertencias.append(
                    f"Fila {n} (cédula {documento}), periodo {periodo}: el valor «{valor}» no es "
                    "un número entero mayor o igual que cero y no se cargó"
                )
                continue
            if cantidad is not None:
                registros.append((documento, periodo, cantidad))

        if not registros and not advertencias:
            continue
        if documento in vistas:
            lectura.advertencias.append(
                f"Fila {n}: la cédula {documento} está repetida; se conservó la primera fila "
                "y esta no se cargó"
            )
            continue
        vistas.add(documento)

        lectura.advertencias.extend(advertencias)
        if registros:
            lectura.registros.extend(registros)
            nombre = _celda(fila, enc.col_nombre)
            lectura.nombres[documento] = nombre.strip() if isinstance(nombre, str) else None

    return lectura


def limitar_advertencias(advertencias: list[str]) -> list[str]:
    """Como máximo MAX_ADVERTENCIAS elementos; el último indica cuántas se omiten."""
    if len(advertencias) <= MAX_ADVERTENCIAS:
        return list(advertencias)
    visibles = advertencias[:MAX_ADVERTENCIAS - 1]
    omitidas = len(advertencias) - len(visibles)
    return visibles + [f"Hay {omitidas} advertencias más que no se muestran"]


# ─────────────────────────────────────────────
# Carga
# ─────────────────────────────────────────────

def leer_archivo(archivo: Path) -> Lectura:
    wb = openpyxl.load_workbook(archivo, data_only=True, read_only=True)
    try:
        ws, encabezado = seleccionar_hoja(wb)
        print(f"[INFO] Hoja: {ws.title} — periodos: {sorted(encabezado.periodos.values())}")
        return leer_registros(ws, encabezado)
    finally:
        wb.close()


def cargar_citas(archivo: Path) -> dict:
    print(f"[INFO] Leyendo: {archivo.name}")

    lectura = leer_archivo(archivo)
    documentos = list(lectura.nombres)
    print(f"[INFO] {len(lectura.registros)} registros de {len(documentos)} profesionales en el archivo")

    conn = get_db_conn()
    try:
        cur = conn.cursor()

        # Toda cédula debe existir en el catálogo: de ahí salen el nombre y el programa
        cur.execute(SQL_CATALOGO, (documentos,))
        catalogo = {int(ident): (nombre, programa) for ident, nombre, programa in cur.fetchall()}

        cargados = [r for r in lectura.registros if r[0] in catalogo]
        for documento, periodo, cantidad in cargados:
            nombre, programa = catalogo[documento]
            cur.execute(SQL_UPSERT, (documento, periodo, cantidad, nombre, programa))

        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    importados = [d for d in documentos if d in catalogo]
    sin_catalogo = [
        {"documento": str(d), "nombre": lectura.nombres[d]}
        for d in documentos if d not in catalogo
    ]
    for medico in sin_catalogo:
        print(f"[WARN] Cédula {medico['documento']} no está en el catálogo: {medico['nombre']}")
    for advertencia in lectura.advertencias:
        print(f"[WARN] {advertencia}")

    resultado = {
        "registros": len(cargados),
        "periodos": sorted({periodo for _, periodo, _ in cargados}),
        "profesionales": len(importados),
        "sin_catalogo": sin_catalogo,
        "sin_programa": sum(1 for d in importados if catalogo[d][1] is None),
        "advertencias": limitar_advertencias(lectura.advertencias),
    }

    print()
    print("=" * 50)
    print(f"  Registros cargados : {resultado['registros']}")
    print(f"  Periodos           : {resultado['periodos']}")
    print(f"  Profesionales      : {resultado['profesionales']}")
    print(f"  Sin catálogo       : {len(sin_catalogo)}")
    print(f"  Sin programa       : {resultado['sin_programa']}")
    print(f"  Advertencias       : {len(lectura.advertencias)}")
    print("=" * 50)
    print("[OK] Carga de citas atendidas completada")

    # Linea final parseable por el caller (el endpoint Node que ejecuta este
    # script de forma sincrona y espera el resultado por stdout).
    print(f"RESULT_JSON:{json.dumps(resultado)}")

    return resultado


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Carga de citas atendidas por profesional")
    parser.add_argument("--archivo", type=str, required=True,
                        help="Ruta al archivo Excel con las citas atendidas")
    args = parser.parse_args(argv)

    archivo = Path(args.archivo)
    # Los errores van por stderr: es lo que el dashboard muestra al usuario
    if not archivo.exists():
        print(f"Archivo no encontrado: {archivo.name}", file=sys.stderr)
        return 1

    try:
        cargar_citas(archivo)
    except ErrorArchivo as e:
        print(str(e), file=sys.stderr)
        return 1
    except Exception as e:
        print(f"No se pudieron cargar las citas atendidas: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    # El dashboard lee la salida como UTF-8, también en Windows
    for flujo in (sys.stdout, sys.stderr):
        flujo.reconfigure(encoding="utf-8")
    sys.exit(main())
