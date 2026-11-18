/**
 * Constructores del modelo de informe (./modelo) a partir de las respuestas
 * de productividad, la ficha del profesional y las alertas de Inteligencia.
 * Módulo puro: sin BD ni APIs de Node.
 */
import type { FiltrosProductividad } from "@/lib/productividad/filtros";
import type { Indicadores } from "@/lib/productividad/metricas";
import type {
  NodoServicio,
  PeriodoCarga,
  PuntoSerie,
  RespuestaFichaProfesional,
  RespuestaProductividad,
  ResumenProfesional,
} from "@/lib/productividad/tipos";
import type { RespuestaAlertas } from "@/lib/inteligencia/tipos";
import type { Novedad } from "@/lib/inteligencia/prioridades";
import type { Direccion } from "@/lib/inteligencia/proyeccion";
import type { SerieProyectada } from "@/lib/inteligencia/alertas";
import type { ColumnaInforme, FilaInforme, KpiInforme, ModeloInforme, SerieInforme, TablaInforme } from "./modelo";

/* ── Formatos ─────────────────────────────────── */

/** Nombre de archivo portable: partes unidas con "_", sin tildes ni símbolos. */
export function nombreArchivo(...partes: string[]): string {
  return partes
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^A-Za-z0-9-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const FORMATO_GENERADO = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "18/11/2026, 10:32" en hora de Colombia. */
export function fmtGenerado(fecha: Date): string {
  const p = Object.fromEntries(FORMATO_GENERADO.formatToParts(fecha).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year}, ${p.hour}:${p.minute}`;
}

/* ── Columnas e indicadores ────────────────────── */

const INASISTENCIA = { numerador: "inasistidas", denominador: "asignadas" };
const DISPONIBILIDAD = { numerador: "disponibles", denominador: "ofertadas" };

/** Columnas de conteos y razones de cada fila (las razones se escriben como fórmula). */
const COLUMNAS_INDICADORES: ColumnaInforme[] = [
  { clave: "ofertadas", etiqueta: "Ofertadas", tipo: "entero" },
  { clave: "asignadas", etiqueta: "Asignadas", tipo: "entero" },
  { clave: "atendidas", etiqueta: "Atendidas", tipo: "entero" },
  { clave: "inasistidas", etiqueta: "Inasistidas", tipo: "entero" },
  { clave: "pct_inasistencia", etiqueta: "% inasistencia", tipo: "porcentaje", formula: INASISTENCIA, semaforo: true },
  { clave: "disponibles", etiqueta: "Sin asignar", tipo: "entero" },
  { clave: "pct_disponibilidad", etiqueta: "% disponibilidad", tipo: "porcentaje", formula: DISPONIBILIDAD },
  { clave: "perdidas", etiqueta: "Citas perdidas", tipo: "entero" },
];

function valoresIndicadores(i: Indicadores): FilaInforme {
  return Object.fromEntries(COLUMNAS_INDICADORES.map((c) => [c.clave, i[c.clave as keyof Indicadores]]));
}

const KPIS_INDICADORES: Omit<KpiInforme, "valor" | "anterior">[] = [
  { clave: "ofertadas", etiqueta: "Citas ofertadas", tipo: "entero", variacion: "relativa" },
  { clave: "asignadas", etiqueta: "Citas asignadas", tipo: "entero", variacion: "relativa" },
  { clave: "atendidas", etiqueta: "Citas atendidas", tipo: "entero", variacion: "relativa" },
  { clave: "inasistidas", etiqueta: "Citas inasistidas", tipo: "entero", variacion: "relativa" },
  { clave: "pct_inasistencia", etiqueta: "% inasistencia", tipo: "porcentaje", variacion: "puntos", formula: INASISTENCIA, semaforo: true },
  { clave: "disponibles", etiqueta: "Citas sin asignar", tipo: "entero", variacion: "relativa" },
  { clave: "pct_disponibilidad", etiqueta: "% disponibilidad", tipo: "porcentaje", variacion: "puntos", formula: DISPONIBILIDAD },
  { clave: "perdidas", etiqueta: "Citas perdidas (inasistidas + sin asignar)", tipo: "entero", variacion: "relativa" },
];

function kpisIndicadores(actual: Indicadores | null, anterior: Indicadores | null): KpiInforme[] {
  const de = (i: Indicadores | null, clave: string) => (i ? (i[clave as keyof Indicadores] as number | null) : null);
  return KPIS_INDICADORES.map((k) => ({ ...k, valor: de(actual, k.clave), anterior: de(anterior, k.clave) }));
}

const kpiSimple = (clave: string, etiqueta: string, tipo: KpiInforme["tipo"], valor: number | null): KpiInforme => ({
  clave,
  etiqueta,
  tipo,
  valor,
  anterior: null,
  variacion: null,
});

/* ── Tablas comunes ───────────────────────────── */

function tablaAreas(datos: RespuestaProductividad): TablaInforme {
  return {
    id: "areas",
    titulo: "Por área",
    columnas: [{ clave: "area", etiqueta: "Área", tipo: "texto" }, ...COLUMNAS_INDICADORES],
    filas: datos.matriz.areas.map((a) => ({ area: a.area, ...valoresIndicadores(a) })),
    totales: true,
  };
}

const COLUMNAS_SERVICIO: ColumnaInforme[] = [
  { clave: "codigo", etiqueta: "Código", tipo: "texto" },
  { clave: "servicio", etiqueta: "Servicio", tipo: "texto" },
];

const filaServicio = (s: NodoServicio): FilaInforme => ({ codigo: s.codigo, servicio: s.nombre, ...valoresIndicadores(s) });

function tablaServicios(datos: RespuestaProductividad): TablaInforme {
  return {
    id: "servicios",
    titulo: "Por servicio",
    columnas: [{ clave: "area", etiqueta: "Área", tipo: "texto" }, ...COLUMNAS_SERVICIO, ...COLUMNAS_INDICADORES],
    filas: datos.matriz.areas.flatMap((a) => a.servicios.map((s) => ({ area: a.area, ...filaServicio(s) }))),
    totales: true,
  };
}

const COLUMNAS_PROFESIONAL: ColumnaInforme[] = [
  { clave: "documento", etiqueta: "Documento", tipo: "texto" },
  { clave: "nombre", etiqueta: "Profesional", tipo: "texto" },
  { clave: "area_principal", etiqueta: "Área principal", tipo: "texto" },
];

const filaProfesional = (p: ResumenProfesional): FilaInforme => ({
  documento: p.documento,
  nombre: p.nombre,
  area_principal: p.area_principal ?? "",
  ...valoresIndicadores(p),
});

function tablaTendencia(puntos: readonly PuntoSerie[], nota?: string): TablaInforme {
  return {
    id: "tendencia",
    titulo: "Tendencia",
    columnas: [{ clave: "periodo", etiqueta: "Periodo", tipo: "texto" }, ...COLUMNAS_INDICADORES],
    filas: puntos.map((p) => ({ periodo: p.etiqueta, ...valoresIndicadores(p) })),
    totales: false,
    nota,
  };
}

function serieTendencia(puntos: readonly PuntoSerie[]): SerieInforme {
  return {
    id: "tendencia",
    titulo: "Asignadas e inasistencia por periodo",
    etiquetas: puntos.map((p) => p.etiqueta),
    series: [
      { nombre: "Asignadas", tipo: "entero", valores: puntos.map((p) => p.asignadas) },
      { nombre: "% inasistencia", tipo: "porcentaje", valores: puntos.map((p) => p.pct_inasistencia) },
    ],
  };
}

/* ── Contexto de periodo ──────────────────────── */

function periodoDe(datos: RespuestaProductividad, clave: string | null): PeriodoCarga | null {
  return clave === null ? null : (datos.periodos[datos.granularidad].find((p) => p.clave === clave) ?? null);
}

function kpisTablero(datos: RespuestaProductividad): KpiInforme[] {
  const hay = datos.kpis.actual !== null;
  return [
    ...kpisIndicadores(datos.kpis.actual, datos.kpis.anterior),
    kpiSimple("con_agenda", "Profesionales con agenda", "entero", hay ? datos.profesionales.con_agenda : null),
    kpiSimple("destacados", "Profesionales bajo la meta (≥ 50 asignadas)", "entero", hay ? datos.profesionales.destacados : null),
  ];
}

const porAsignadas = (a: ResumenProfesional, b: ResumenProfesional) => b.asignadas - a.asignadas;

/* ── Informe: lo que se ve ─────────────────────── */

/** "Exportar lo que ves": el tablero de productividad con los filtros activos. */
export function informeVista(
  datos: RespuestaProductividad,
  filtros: FiltrosProductividad,
  generado: Date
): ModeloInforme {
  const periodo = periodoDe(datos, datos.periodo);
  const anterior = periodoDe(datos, datos.kpis.periodo_anterior);
  const servicio = datos.opciones.servicios.find((s) => s.codigo === filtros.servicio);
  const profesional = datos.opciones.profesionales.find((p) => p.documento === filtros.profesional);

  return {
    tipo: "vista",
    titulo: "Productividad de la agenda",
    subtitulo: "Oferta, asignación, inasistencia y citas perdidas por área, servicio y profesional",
    periodo: periodo?.etiqueta_larga ?? null,
    periodo_anterior: anterior?.etiqueta_larga ?? null,
    filtros: [
      { etiqueta: "Granularidad", valor: datos.granularidad === "mensual" ? "Mensual" : "Semanal" },
      { etiqueta: "Periodo", valor: periodo?.etiqueta_larga ?? "Sin cargas" },
      { etiqueta: "Área", valor: filtros.area ?? "Todas" },
      { etiqueta: "Servicio", valor: filtros.servicio ? `${servicio?.nombre ?? "Servicio"} (${filtros.servicio})` : "Todos" },
      {
        etiqueta: "Profesional",
        valor: filtros.profesional ? `${profesional?.nombre ?? "Profesional"} (CC ${filtros.profesional})` : "Todos",
      },
    ],
    generado: fmtGenerado(generado),
    archivo: periodo ? nombreArchivo("Productividad", periodo.etiqueta_larga) : "Productividad",
    hoja_resumen: "Resumen",
    kpis: kpisTablero(datos),
    tablas: [
      tablaAreas(datos),
      tablaServicios(datos),
      {
        id: "profesionales",
        titulo: "Por profesional",
        columnas: [...COLUMNAS_PROFESIONAL, ...COLUMNAS_INDICADORES],
        filas: [...datos.profesionales.lista].sort(porAsignadas).map(filaProfesional),
        totales: true,
      },
      tablaTendencia(datos.tendencia),
    ],
    series: [serieTendencia(datos.tendencia)],
    notas: [],
  };
}

/* ── Informe mensual ──────────────────────────── */

const NOVEDAD: Record<Novedad, string> = { nuevo: "Nuevo", empeora: "Empeora", persiste: "Persiste" };
const DIRECCION: Record<Direccion, string> = { sube: "Sube", baja: "Baja", estable: "Estable" };

function tablaPrioridades(alertas: RespuestaAlertas, periodoInforme: string | null): TablaInforme {
  const evaluado = alertas.periodo;
  const nota =
    evaluado && evaluado.clave !== periodoInforme
      ? `Prioridades evaluadas sobre ${evaluado.etiqueta_larga}, el último periodo cargado.`
      : "Cada prioridad cuenta las citas por encima de su referencia; Nuevo / Empeora / Persiste frente al periodo anterior.";
  return {
    id: "prioridades",
    titulo: "Prioridades",
    columnas: [
      { clave: "posicion", etiqueta: "N.º", tipo: "entero" },
      { clave: "prioridad", etiqueta: "Prioridad", tipo: "texto" },
      { clave: "area", etiqueta: "Área", tipo: "texto" },
      { clave: "citas", etiqueta: "Citas", tipo: "entero" },
      { clave: "referencia", etiqueta: "Referencia", tipo: "texto" },
      { clave: "profesionales", etiqueta: "Profesionales equivalentes", tipo: "decimal" },
      { clave: "novedad", etiqueta: "Novedad", tipo: "texto" },
      { clave: "citas_anterior", etiqueta: "Citas periodo anterior", tipo: "entero" },
      { clave: "revisar", etiqueta: "Qué revisar", tipo: "texto" },
      { clave: "detalle", etiqueta: "Detalle", tipo: "texto" },
    ],
    filas: alertas.prioridades.map((p, i) => ({
      posicion: i + 1,
      prioridad: p.titular,
      area: p.area ?? "",
      citas: p.citas,
      referencia: p.referencia,
      profesionales: p.profesionales,
      novedad: NOVEDAD[p.novedad],
      citas_anterior: p.citas_anterior,
      revisar: p.revisar,
      detalle: p.detalle.map((d) => d.texto).join("; "),
    })),
    totales: false,
    nota,
  };
}

function filaProyeccion(s: SerieProyectada, ambito: string): FilaInforme {
  const ultimo = s.historia.length > 0 ? s.historia[s.historia.length - 1].valor : null;
  return {
    ambito,
    area: s.area ?? s.nombre,
    nombre: s.nombre,
    pct_ultimo: ultimo,
    pct_proyectado: s.inasistencia?.valor ?? null,
    pct_min: s.inasistencia?.min ?? null,
    pct_max: s.inasistencia?.max ?? null,
    direccion: s.inasistencia ? DIRECCION[s.inasistencia.direccion] : "Sin datos suficientes",
    asignadas_ultimo: s.asignadas_ultimo,
    asignadas_proyectadas: s.asignadas ? Math.round(s.asignadas.valor) : null,
  };
}

function tablaProyeccion(alertas: RespuestaAlertas): TablaInforme {
  return {
    id: "proyeccion",
    titulo: "Proyección",
    columnas: [
      { clave: "ambito", etiqueta: "Ámbito", tipo: "texto" },
      { clave: "area", etiqueta: "Área", tipo: "texto" },
      { clave: "nombre", etiqueta: "Nombre", tipo: "texto" },
      { clave: "pct_ultimo", etiqueta: "% inasistencia último periodo", tipo: "porcentaje", semaforo: true },
      { clave: "pct_proyectado", etiqueta: "% inasistencia proyectado", tipo: "porcentaje", semaforo: true },
      { clave: "pct_min", etiqueta: "Rango mínimo", tipo: "porcentaje" },
      { clave: "pct_max", etiqueta: "Rango máximo", tipo: "porcentaje" },
      { clave: "direccion", etiqueta: "Tendencia", tipo: "texto" },
      { clave: "asignadas_ultimo", etiqueta: "Asignadas último periodo", tipo: "entero" },
      { clave: "asignadas_proyectadas", etiqueta: "Asignadas proyectadas", tipo: "entero" },
    ],
    filas: [
      ...alertas.proyeccion.areas.map((s) => filaProyeccion(s, "Área")),
      ...alertas.proyeccion.servicios.map((s) => filaProyeccion(s, "Servicio")),
    ],
    totales: false,
    nota: alertas.siguiente
      ? `Proyección de ${alertas.siguiente.etiqueta_larga} con la tendencia de los últimos periodos (rango = error medio del método).`
      : "Sin periodos suficientes para proyectar.",
  };
}

/**
 * Informe mensual de citas para gerencia y líderes: indicadores del periodo
 * contra el anterior, tendencia de 12 periodos, detalle por área y servicio,
 * ranking de profesionales y, si hay acceso a Inteligencia, prioridades y
 * proyección. `alertas` null = sin acceso: esas hojas se omiten.
 */
export function informeMensual(
  datos: RespuestaProductividad,
  alertas: RespuestaAlertas | null,
  generado: Date
): ModeloInforme {
  const periodo = periodoDe(datos, datos.periodo);
  const anterior = periodoDe(datos, datos.kpis.periodo_anterior);
  const ranking = [...datos.profesionales.lista].sort((a, b) => b.inasistidas - a.inasistidas || porAsignadas(a, b));

  const tablas: TablaInforme[] = [
    tablaAreas(datos),
    tablaServicios(datos),
    {
      id: "profesionales",
      titulo: "Por profesional",
      columnas: [{ clave: "posicion", etiqueta: "Posición", tipo: "entero" }, ...COLUMNAS_PROFESIONAL, ...COLUMNAS_INDICADORES],
      filas: ranking.map((p, i) => ({ posicion: i + 1, ...filaProfesional(p) })),
      totales: true,
      nota: "Ordenado de más a menos citas inasistidas.",
    },
    tablaTendencia(datos.kpis.serie, "Hasta 12 periodos que terminan en el del informe."),
  ];
  if (alertas) tablas.push(tablaPrioridades(alertas, datos.periodo), tablaProyeccion(alertas));

  return {
    tipo: "mensual",
    titulo: "Informe mensual de citas",
    subtitulo: "Indicadores de la agenda, prioridades y proyección para gerencia y líderes",
    periodo: periodo?.etiqueta_larga ?? null,
    periodo_anterior: anterior?.etiqueta_larga ?? null,
    filtros: [
      { etiqueta: "Periodo", valor: periodo?.etiqueta_larga ?? "Sin cargas" },
      { etiqueta: "Comparado con", valor: anterior?.etiqueta_larga ?? "Sin periodo anterior" },
    ],
    generado: fmtGenerado(generado),
    archivo: periodo ? nombreArchivo("Informe mensual", periodo.etiqueta_larga) : "Informe_mensual",
    hoja_resumen: "Resumen",
    kpis: kpisTablero(datos),
    tablas,
    series: [serieTendencia(datos.kpis.serie)],
    notas: alertas ? [] : ["Prioridades y proyección omitidas: requieren acceso a Inteligencia."],
  };
}

/* ── Ficha del profesional ────────────────────── */

/** Ficha individual: indicadores del periodo, institución, percentil, servicios y tendencia. */
export function informeFicha(ficha: RespuestaFichaProfesional, generado: Date): ModeloInforme {
  const i = ficha.tendencia.findIndex((p) => p.clave === ficha.periodo);
  const previo = i > 0 ? ficha.tendencia[i - 1] : null;
  const a = ficha.actual;

  return {
    tipo: "ficha",
    titulo: "Ficha del profesional",
    subtitulo: [ficha.nombre, `CC ${ficha.documento}`, ficha.area_principal].filter(Boolean).join(" · "),
    periodo: ficha.etiqueta_periodo,
    periodo_anterior: previo?.etiqueta ?? null,
    filtros: [
      { etiqueta: "Granularidad", valor: ficha.granularidad === "mensual" ? "Mensual" : "Semanal" },
      { etiqueta: "Periodo", valor: ficha.etiqueta_periodo ?? "Sin cargas" },
    ],
    generado: fmtGenerado(generado),
    archivo: nombreArchivo("Ficha", ficha.documento, ficha.etiqueta_periodo ?? ""),
    hoja_resumen: "Ficha",
    kpis: [
      ...kpisIndicadores(a, previo),
      kpiSimple("confirmadas", "Citas confirmadas", "entero", a?.confirmadas ?? null),
      kpiSimple("canceladas", "Citas canceladas", "entero", a?.canceladas ?? null),
      kpiSimple("institucion", "% inasistencia de la institución", "porcentaje", ficha.institucion.pct_inasistencia),
      kpiSimple("percentil", "Percentil (mejor que el % de pares)", "entero", ficha.percentil),
      kpiSimple("pares", "Pares comparados (≥ 50 asignadas)", "entero", ficha.pares),
    ],
    tablas: [
      {
        id: "servicios",
        titulo: "Servicios",
        columnas: [...COLUMNAS_SERVICIO, ...COLUMNAS_INDICADORES],
        filas: ficha.servicios.map(filaServicio),
        totales: true,
      },
      tablaTendencia(ficha.tendencia),
    ],
    series: [serieTendencia(ficha.tendencia)],
    notas: ficha.percentil === null ? ["Sin percentil: el profesional tiene menos de 50 citas asignadas."] : [],
  };
}
