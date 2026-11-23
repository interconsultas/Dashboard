"""
citas_detallado.py
Carga el "INFORME GENERAL DE CITAS DETALLADO POR PROFESIONAL" de Agenda Web
(Sura). Es la única fuente de citas por profesional: el informe general por
servicio nunca se carga.

El archivo que descarga Agenda Web no es un Excel: es texto separado por
tabuladores, en latin-1, con fin de línea CRLF y extensión .xls. También se
acepta el mismo informe abierto y guardado como .xlsx o .xls.

Estructura: unas filas de título con FECHA INICIAL y FECHA FINAL (d/m/aaaa),
la fila de encabezado (primera celda "IDENTIFICACION PROFESIONAL") y luego un
bloque por profesional, cerrado por una fila TOTALES y una fila vacía. Las
filas TOTALES no se cargan: solo se usan para validar la suma del bloque.

Carga (una sola transacción, desde etl_citas.py):
- servicios_citas: catálogo por codigo_servicio.
- citas_profesional_servicio: reemplaza las filas del mismo rango de fechas.
  Un rango distinto que se solapa con otro de la misma granularidad se
  rechaza. Las cargas mensuales y semanales conviven.
- citas_atendidas (solo cargas mensuales): SUM(confirmadas) por documento,
  para los profesionales del catálogo de médicos, como la carga anterior.
"""
import calendar
import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

from python_calamine import CalamineError, CalamineWorkbook

from citas_comun import (
    CEDULA_MAX, CITAS_MAX, SQL_CATALOGO, SQL_UPSERT_CITAS_ATENDIDAS, ErrorArchivo,
    limitar_advertencias, normalizar,
)
from config import get_db_conn


TITULO_INFORME = "INFORME GENERAL DE CITAS DETALLADO POR PROFESIONAL"
COLUMNA_ID = "IDENTIFICACION PROFESIONAL"
FILAS_ENCABEZADO = 30   # el encabezado se busca en estas primeras filas

FIRMA_XLSX = b"PK\x03\x04"
FIRMA_XLS = b"\xd0\xcf\x11\xe0"

# Encabezado normalizado → atributo
COLUMNAS = {
    COLUMNA_ID: "identificacion",
    "NOMBRE PROFESIONAL": "nombre_profesional",
    "CODIGO IPS": "codigo_ips",
    "NOMBRE IPS": "nombre_ips",
    "CODIGO SERVICIO": "codigo_servicio",
    "NOMBRE SERVICIO": "nombre_servicio",
    "PLAN AGRUPADOR": "plan_agrupador",
    "TIEMPO SERVICIO": "tiempo_servicio",
}
# Encabezado normalizado → (columna en la BD, nombre corto para los mensajes)
METRICAS = {
    "TOTAL CITAS CREADAS": ("creadas", "CREADAS"),
    "TOTAL CITAS BLOQUEADAS": ("bloqueadas", "BLOQUEADAS"),
    "TOTAL CITAS OFERTADAS": ("ofertadas", "OFERTADAS"),
    "TOTAL CITAS DISPONIBLES": ("disponibles", "DISPONIBLES"),
    "TOTAL CITAS ASIGNADAS": ("asignadas", "ASIGNADAS"),
    "TOTAL CITAS CONFIRMADAS": ("confirmadas", "CONFIRMADAS"),
    "TOTAL CITAS CONFIRMADAS SIN ATENCION": ("confirmadas_sin_atencion", "CONFIRMADAS SIN ATENCION"),
    "TOTAL CITAS INASISTIDAS": ("inasistidas", "INASISTIDAS"),
    "TOTAL CITAS CANCELADAS": ("canceladas", "CANCELADAS"),
    "TOTAL CITAS PENDIENTES POR ASISTIR": ("pendientes_por_asistir", "PENDIENTES POR ASISTIR"),
}
IDX_CONFIRMADAS = list(METRICAS).index("TOTAL CITAS CONFIRMADAS")

RE_IDENTIFICACION = re.compile(r"^([A-Z]{1,4})\s*(\d+)$")
RE_ETIQUETA_FECHA = re.compile(r"^(FECHA INICIAL|FECHA FINAL)\s*:?\s*(.*)$")
RE_FECHA_DMA = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")
RE_FECHA_AMD = re.compile(r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$")
# Prefijo que pone el dashboard al archivo temporal (citas_<uuid>_<nombre>)
RE_PREFIJO_TEMPORAL = re.compile(r"^citas_[0-9a-fA-F-]{36}_")

SQL_BLOQUEO = "SELECT pg_advisory_xact_lock(hashtext('carga_citas_detallado'))"

SQL_SOLAPADOS = """
    SELECT DISTINCT fecha_inicial, fecha_final
    FROM citas_profesional_servicio
    WHERE granularidad = %s AND fecha_inicial <= %s AND fecha_final >= %s
      AND NOT (fecha_inicial = %s AND fecha_final = %s)
    ORDER BY 1, 2
"""

SQL_SERVICIOS_EXISTENTES = """
    SELECT codigo_servicio FROM servicios_citas WHERE codigo_servicio = ANY(%s)
"""

# El nombre del servicio es el de su carga más reciente; los periodos solo se amplían
SQL_UPSERT_SERVICIO = """
    INSERT INTO servicios_citas (codigo_servicio, nombre_servicio, primer_periodo, ultimo_periodo)
    VALUES (%s, %s, %s, %s)
    ON CONFLICT (codigo_servicio) DO UPDATE SET
        nombre_servicio = CASE WHEN EXCLUDED.ultimo_periodo >= servicios_citas.ultimo_periodo
                               THEN EXCLUDED.nombre_servicio
                               ELSE servicios_citas.nombre_servicio END,
        primer_periodo  = LEAST(servicios_citas.primer_periodo, EXCLUDED.primer_periodo),
        ultimo_periodo  = GREATEST(servicios_citas.ultimo_periodo, EXCLUDED.ultimo_periodo)
"""

SQL_BORRAR_RANGO = """
    DELETE FROM citas_profesional_servicio
    WHERE fecha_inicial = %s AND fecha_final = %s
"""

_COLUMNAS_DETALLE = (
    ["tipo_documento", "documento", "nombre_profesional", "codigo_ips", "nombre_ips",
     "codigo_servicio", "plan_agrupador", "tiempo_servicio"]
    + [col for col, _ in METRICAS.values()]
    + ["fecha_inicial", "fecha_final", "periodo", "granularidad", "archivo_fuente"]
)
SQL_INSERT_DETALLE = (
    f"INSERT INTO citas_profesional_servicio ({', '.join(_COLUMNAS_DETALLE)}) "
    f"VALUES ({', '.join(['%s'] * len(_COLUMNAS_DETALLE))})"
)


@dataclass
class Registro:
    tipo_documento: str
    documento: int
    nombre_profesional: str
    codigo_ips: str
    nombre_ips: str
    codigo_servicio: str
    plan_agrupador: str
    tiempo_servicio: int
    metricas: tuple[int, ...]

    @property
    def llave(self) -> tuple:
        return (self.tipo_documento, self.documento, self.codigo_ips,
                self.codigo_servicio, self.plan_agrupador, self.tiempo_servicio)


@dataclass
class Informe:
    fecha_inicial: date
    fecha_final: date
    registros: list[Registro] = field(default_factory=list)
    filas: int = 0                 # filas de datos leídas (sin TOTALES ni vacías)
    filas_agrupadas: int = 0       # filas sumadas a otra con la misma llave natural
    advertencias: list[str] = field(default_factory=list)
    profesionales: dict[int, str] = field(default_factory=dict)   # documento → nombre
    servicios: dict[str, str] = field(default_factory=dict)       # código → nombre

    @property
    def periodo(self) -> int:
        return self.fecha_inicial.year * 100 + self.fecha_inicial.month

    @property
    def granularidad(self) -> str:
        return granularidad(self.fecha_inicial, self.fecha_final)

    def confirmadas_por_documento(self) -> dict[int, int]:
        totales: dict[int, int] = {}
        for r in self.registros:
            totales[r.documento] = totales.get(r.documento, 0) + r.metricas[IDX_CONFIRMADAS]
        return totales


# ─────────────────────────────────────────────
# Lectura del archivo
# ─────────────────────────────────────────────

def _es_encabezado(fila) -> bool:
    return bool(fila) and normalizar(fila[0]) == COLUMNA_ID


def _tiene_encabezado(filas: list[list]) -> bool:
    return any(_es_encabezado(f) for f in filas[:FILAS_ENCABEZADO])


def _filas_de_texto(contenido: bytes) -> list[list]:
    try:
        texto = contenido.decode("utf-8-sig")
    except UnicodeDecodeError:
        texto = contenido.decode("latin-1")
    return [linea.split("\t") for linea in texto.splitlines()]


def leer_filas_detallado(archivo: Path) -> list[list] | None:
    """
    Filas del informe detallado, o None si el archivo es un .xlsx de otro
    formato (lo procesa la carga anterior de etl_citas.py). Lanza ErrorArchivo
    si el archivo no es un Excel ni el informe detallado.
    """
    contenido = Path(archivo).read_bytes()
    firma = contenido[:4]

    if firma not in (FIRMA_XLSX, FIRMA_XLS):
        filas = _filas_de_texto(contenido)
        if _tiene_encabezado(filas):
            return filas
        if any(normalizar(c).startswith("INFORME GENERAL DE CITAS")
               for f in filas[:5] for c in f[:1]):
            raise ErrorArchivo(
                "Este archivo es el informe general de citas. Cargue el informe detallado "
                f"por profesional («{TITULO_INFORME}») de Agenda Web."
            )
        raise ErrorArchivo(
            "El archivo no es un Excel ni el informe de citas detallado por profesional: "
            f"no se encontró la fila de encabezado «{COLUMNA_ID}»."
        )

    try:
        wb = CalamineWorkbook.from_path(str(archivo))
        hojas = [wb.get_sheet_by_name(nombre).to_python() for nombre in wb.sheet_names]
    except CalamineError as e:
        if firma == FIRMA_XLS:
            raise ErrorArchivo(f"No se pudo leer el archivo .xls: {e}") from e
        return None   # que la carga anterior informe el problema del .xlsx

    for filas in hojas:
        if _tiene_encabezado(filas):
            return filas
    if firma == FIRMA_XLS:
        raise ErrorArchivo(
            "El archivo .xls no contiene el informe de citas detallado por profesional "
            f"(fila de encabezado «{COLUMNA_ID}»). Si es el Excel de citas por médico, "
            "guárdelo como .xlsx."
        )
    return None


# ─────────────────────────────────────────────
# Interpretación de celdas
# ─────────────────────────────────────────────

def parsear_fecha(valor) -> date | None:
    """Fecha de una celda: d/m/aaaa (con hora opcional), aaaa/mm/dd o un valor fecha."""
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    if not isinstance(valor, str) or not valor.strip():
        return None
    texto = valor.strip().split()[0]
    try:
        if m := RE_FECHA_DMA.match(texto):
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if m := RE_FECHA_AMD.match(texto):
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None
    return None


def granularidad(fecha_inicial: date, fecha_final: date) -> str:
    """'mensual' si el rango es exactamente un mes calendario; si no, 'semanal'."""
    ultimo_dia = calendar.monthrange(fecha_inicial.year, fecha_inicial.month)[1]
    es_mes = (
        fecha_inicial.day == 1
        and fecha_final == fecha_inicial.replace(day=ultimo_dia)
    )
    return "mensual" if es_mes else "semanal"


def _texto(valor) -> str:
    """Celda como texto con espacios simples; los números enteros sin '.0'."""
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    return " ".join(str(valor).split())


def _entero(valor) -> int | None:
    """Entero entre 0 y CITAS_MAX, o None si la celda no lo es."""
    if isinstance(valor, bool):
        return None
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    if isinstance(valor, str) and re.fullmatch(r"\d+", valor.strip()):
        valor = int(valor.strip())
    if isinstance(valor, int) and 0 <= valor <= CITAS_MAX:
        return valor
    return None


def _celda(fila: list, indice: int):
    return fila[indice] if indice < len(fila) else None


def _vacia(fila: list) -> bool:
    return all(_texto(c) == "" for c in fila)


# ─────────────────────────────────────────────
# Interpretación del informe
# ─────────────────────────────────────────────

def _fechas(filas_titulo: list[list]) -> tuple[date, date]:
    valores: dict[str, object] = {}
    for fila in filas_titulo:
        if not fila or not isinstance(fila[0], str):
            continue
        m = RE_ETIQUETA_FECHA.match(normalizar(fila[0]))
        if not m:
            continue
        resto = fila[0].split(":", 1)[1] if ":" in fila[0] else ""
        valor = resto.strip() or next((c for c in fila[1:] if _texto(c)), None)
        valores[m.group(1)] = valor

    fechas = []
    for etiqueta in ("FECHA INICIAL", "FECHA FINAL"):
        if etiqueta not in valores:
            raise ErrorArchivo(
                f"No se encontró la {etiqueta} del informe encima del encabezado de columnas."
            )
        fecha = parsear_fecha(valores[etiqueta])
        if fecha is None:
            raise ErrorArchivo(
                f"La {etiqueta} del informe («{valores[etiqueta]}») no es una fecha válida (d/m/aaaa)."
            )
        fechas.append(fecha)

    inicial, final = fechas
    if final < inicial:
        raise ErrorArchivo(
            f"La FECHA FINAL ({final:%d/%m/%Y}) es anterior a la FECHA INICIAL "
            f"({inicial:%d/%m/%Y})."
        )
    return inicial, final


def _indices(encabezado: list) -> tuple[dict[str, int], list[int]]:
    posiciones = {normalizar(c): i for i, c in enumerate(encabezado) if normalizar(c)}
    faltantes = [c for c in [*COLUMNAS, *METRICAS] if c not in posiciones]
    if faltantes:
        raise ErrorArchivo(
            "Al informe le faltan columnas: " + ", ".join(faltantes) + "."
        )
    return (
        {atributo: posiciones[c] for c, atributo in COLUMNAS.items()},
        [posiciones[c] for c in METRICAS],
    )


def _validar_totales(fila_totales: list, idx_metricas: list[int], bloque: list[tuple],
                     n: int, advertencias: list[str]) -> None:
    """Compara la fila TOTALES con la suma de las filas del bloque."""
    if not bloque:
        return
    suma = [sum(m[i] for _, m in bloque) for i in range(len(METRICAS))]
    diferencias = []
    for i, (indice, (_, corto)) in enumerate(zip(idx_metricas, METRICAS.values())):
        esperado = _entero(_celda(fila_totales, indice))
        if esperado != suma[i]:
            diferencias.append(f"{corto} (archivo {_texto(_celda(fila_totales, indice))}, suma {suma[i]})")
    if diferencias:
        advertencias.append(
            f"Fila {n}: la fila TOTALES de {bloque[0][0]} no coincide con la suma del bloque en "
            + "; ".join(diferencias)
        )


def parsear_informe(filas: list[list]) -> Informe:
    """Convierte las filas del informe en registros agrupados por llave natural."""
    fila_encabezado = next(
        (i for i, f in enumerate(filas[:FILAS_ENCABEZADO]) if _es_encabezado(f)), None
    )
    if fila_encabezado is None:
        raise ErrorArchivo(f"No se encontró la fila de encabezado «{COLUMNA_ID}».")

    inicial, final = _fechas(filas[:fila_encabezado])
    idx, idx_metricas = _indices(filas[fila_encabezado])
    informe = Informe(fecha_inicial=inicial, fecha_final=final)
    por_llave: dict[tuple, Registro] = {}
    bloque: list[tuple[str, tuple]] = []   # (profesional, métricas) desde el último TOTALES

    for n, fila in enumerate(filas[fila_encabezado + 1:], start=fila_encabezado + 2):
        if _vacia(fila):
            continue
        if normalizar(_texto(_celda(fila, 0))) == "TOTALES":
            _validar_totales(fila, idx_metricas, bloque, n, informe.advertencias)
            bloque = []
            continue

        informe.filas += 1
        valor = lambda atributo: _texto(_celda(fila, idx[atributo]))   # noqa: E731
        identificacion = valor("identificacion")
        metricas = tuple(_entero(_celda(fila, i)) for i in idx_metricas)
        if None in metricas:
            invalidas = [
                f"{corto} «{_texto(_celda(fila, i))}»"
                for i, (_, corto), m in zip(idx_metricas, METRICAS.values(), metricas) if m is None
            ]
            informe.advertencias.append(
                f"Fila {n} ({identificacion}): valores que no son enteros mayores o iguales que "
                f"cero en {', '.join(invalidas)}; la fila no se cargó"
            )
            continue
        bloque.append((identificacion, metricas))

        m = RE_IDENTIFICACION.match(normalizar(identificacion))
        tiempo = _entero(_celda(fila, idx["tiempo_servicio"]))
        codigo = valor("codigo_servicio")
        if not m or not 0 < int(m.group(2)) <= CEDULA_MAX:
            informe.advertencias.append(
                f"Fila {n}: la identificación «{identificacion}» no tiene el formato "
                "«CC 123456»; la fila no se cargó"
            )
            continue
        if tiempo is None or not codigo:
            informe.advertencias.append(
                f"Fila {n} ({identificacion}): falta el código de servicio o el tiempo de "
                "servicio no es un entero; la fila no se cargó"
            )
            continue

        registro = Registro(
            tipo_documento=m.group(1),
            documento=int(m.group(2)),
            nombre_profesional=valor("nombre_profesional"),
            codigo_ips=valor("codigo_ips"),
            nombre_ips=valor("nombre_ips"),
            codigo_servicio=codigo,
            plan_agrupador=valor("plan_agrupador"),
            tiempo_servicio=tiempo,
            metricas=metricas,
        )
        informe.profesionales.setdefault(registro.documento, registro.nombre_profesional)
        informe.servicios.setdefault(codigo, valor("nombre_servicio"))

        previo = por_llave.get(registro.llave)
        if previo is None:
            por_llave[registro.llave] = registro
        else:
            previo.metricas = tuple(a + b for a, b in zip(previo.metricas, metricas))
            informe.filas_agrupadas += 1

    if bloque:
        informe.advertencias.append(
            f"Las últimas filas del informe ({bloque[0][0]}) no terminan en una fila TOTALES"
        )

    informe.registros = list(por_llave.values())
    if not informe.registros:
        raise ErrorArchivo("El informe no tiene filas de profesionales para cargar.")
    return informe


# ─────────────────────────────────────────────
# Carga
# ─────────────────────────────────────────────

def _nombre_fuente(archivo: Path) -> str:
    return RE_PREFIJO_TEMPORAL.sub("", Path(archivo).name)[:255]


def _periodo(fecha: date) -> int:
    return fecha.year * 100 + fecha.month


def _rechazar_solapados(cur, informe: Informe) -> None:
    ini, fin = informe.fecha_inicial, informe.fecha_final
    cur.execute(SQL_SOLAPADOS, (informe.granularidad, fin, ini, ini, fin))
    solapados = cur.fetchall()
    if solapados:
        rangos = ", ".join(f"{a:%d/%m/%Y} – {b:%d/%m/%Y}" for a, b in solapados)
        raise ErrorArchivo(
            f"El rango del informe ({ini:%d/%m/%Y} – {fin:%d/%m/%Y}, {informe.granularidad}) "
            f"se solapa con cargas {informe.granularidad}es que ya existen: {rangos}. "
            "Solo se puede volver a cargar exactamente el mismo rango."
        )


def cargar_detallado(archivo: Path, filas: list[list]) -> dict:
    informe = parsear_informe(filas)
    ini, fin = informe.fecha_inicial, informe.fecha_final
    print(
        f"[INFO] Informe detallado: {ini:%d/%m/%Y} – {fin:%d/%m/%Y} ({informe.granularidad}), "
        f"{informe.filas} filas, {len(informe.profesionales)} profesionales"
    )

    mensual = informe.granularidad == "mensual"
    codigos = sorted(informe.servicios)
    documentos = list(informe.profesionales)
    fuente = _nombre_fuente(archivo)

    conn = get_db_conn()
    try:
        cur = conn.cursor()
        # Dos cargas simultáneas no deben validar solapamientos sobre datos viejos
        cur.execute(SQL_BLOQUEO)
        _rechazar_solapados(cur, informe)

        cur.execute(SQL_SERVICIOS_EXISTENTES, (codigos,))
        existentes = {fila[0] for fila in cur.fetchall()}
        cur.executemany(SQL_UPSERT_SERVICIO, [
            (codigo, informe.servicios[codigo], _periodo(ini), _periodo(fin)) for codigo in codigos
        ])

        cur.execute(SQL_BORRAR_RANGO, (ini, fin))
        cur.executemany(SQL_INSERT_DETALLE, [
            (r.tipo_documento, r.documento, r.nombre_profesional, r.codigo_ips, r.nombre_ips,
             r.codigo_servicio, r.plan_agrupador, r.tiempo_servicio, *r.metricas,
             ini, fin, informe.periodo, informe.granularidad, fuente)
            for r in informe.registros
        ])

        cur.execute(SQL_CATALOGO, (documentos,))
        catalogo = {int(ident): (nombre, programa) for ident, nombre, programa in cur.fetchall()}

        # Mismo criterio que la carga anterior: solo profesionales del catálogo,
        # con el nombre del catálogo. Las semanas no alimentan citas_atendidas.
        citas = []
        if mensual:
            citas = [
                (documento, informe.periodo, cantidad, catalogo[documento][0])
                for documento, cantidad in informe.confirmadas_por_documento().items()
                if documento in catalogo
            ]
            cur.executemany(SQL_UPSERT_CITAS_ATENDIDAS, citas)

        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    sin_catalogo = [
        {"documento": str(d), "nombre": informe.profesionales[d]}
        for d in documentos if d not in catalogo
    ]
    for advertencia in informe.advertencias:
        print(f"[WARN] {advertencia}")

    resultado = {
        "formato": "detallado",
        "periodo": informe.periodo,
        "fecha_inicial": ini.isoformat(),
        "fecha_final": fin.isoformat(),
        "granularidad": informe.granularidad,
        "filas": informe.filas,
        "registros": len(informe.registros),
        "filas_agrupadas": informe.filas_agrupadas,
        "profesionales": len(documentos),
        "servicios": len(codigos),
        "servicios_nuevos": [
            {"codigo": c, "nombre": informe.servicios[c]} for c in codigos if c not in existentes
        ],
        "citas_atendidas": len(citas),
        "periodos": [informe.periodo] if mensual else [],
        "sin_catalogo": sin_catalogo,
        "sin_programa": sum(1 for d in documentos if d in catalogo and catalogo[d][1] is None),
        "advertencias": limitar_advertencias(informe.advertencias),
    }

    print()
    print("=" * 50)
    print(f"  Rango              : {ini:%d/%m/%Y} – {fin:%d/%m/%Y} ({informe.granularidad})")
    print(f"  Filas / registros  : {informe.filas} / {len(informe.registros)}")
    print(f"  Profesionales      : {len(documentos)}")
    print(f"  Servicios (nuevos) : {len(codigos)} ({len(resultado['servicios_nuevos'])})")
    print(f"  Citas atendidas    : {len(citas)}")
    print(f"  Sin catálogo       : {len(sin_catalogo)}")
    print(f"  Advertencias       : {len(informe.advertencias)}")
    print("=" * 50)
    print("[OK] Carga del informe detallado completada")

    # Linea final parseable por el caller (el endpoint Node que ejecuta este
    # script de forma sincrona y espera el resultado por stdout).
    print(f"RESULT_JSON:{json.dumps(resultado)}")

    return resultado
