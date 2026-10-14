/**
 * Modelo del informe de cumplimiento en PDF: textos ya formateados (igual que en
 * pantalla) y series listas para dibujar, a partir de los datos ya consultados.
 * El documento (`components/cumplimiento/pdf`) solo se encarga de la maquetación.
 */
import { fmtPeriodo } from "@/lib/periodo";
import { CATEGORIAS } from "./categorias";
import type { FilaCumplimiento, ResumenCumplimiento } from "./calcular";
import { fmtFechaGeneracion, programasFiltrados, rangoPeriodos } from "./impresion";
import {
  ETIQUETA_ESTADO,
  SIN_DATOS,
  contarSinPrograma,
  estadoMeta,
  fmtPct,
  fmtTasa,
  ordenarRanking,
  puntosGrafica,
  serieDeCategoria,
  serieDeFilas,
  serieGlobal,
  techoEje,
  type EstadoMeta,
  type PuntoGrafica,
  type ValorPeriodo,
} from "./presentacion";
import type { RespuestaCumplimiento } from "./tipos";

/* ── Tipos ───────────────────────────────────── */

export interface CeldaPct {
  texto: string;
  estado: EstadoMeta;
}

export interface IndicadorInforme extends CeldaPct {
  etiqueta: string;
  estadoTexto: string;
}

export interface FiltroInforme {
  etiqueta: string;
  valor: string;
}

export interface GraficaInforme {
  titulo: string;
  subtitulo: string;
  puntos: PuntoGrafica[];
  /** Techo del eje Y en puntos porcentuales. */
  techo: number;
  marcas: number[];
  /** Con muchas barras las etiquetas se pisan y se omiten. */
  conEtiquetas: boolean;
  hayDatos: boolean;
}

export interface TendenciaInforme {
  etiqueta: string;
  puntos: PuntoGrafica[];
  techo: number;
  marcas: number[];
  /** Último mes con dato; null si el indicador no tiene datos en el rango. */
  ultimo: (CeldaPct & { periodo: string }) | null;
}

export interface FilaRankingInforme {
  nombre: string;
  documento: string;
  programa: string | null;
  citas: string;
  global: CeldaPct;
  categorias: CeldaPct[];
}

export interface FilaHistorialInforme {
  periodo: string;
  citas: string;
  programa: string | null;
  global: CeldaPct;
  categorias: { tasa: string; meta: string; pct: CeldaPct }[];
}

export type DetalleInforme =
  | { tipo: "general"; ranking: FilaRankingInforme[] }
  | {
      tipo: "profesional";
      profesional: { nombre: string; documento: string; programa: string | null };
      tendencias: TendenciaInforme[];
      historial: FilaHistorialInforme[];
    };

export interface InformeCumplimiento {
  titulo: string;
  periodo: string | null;
  filtros: FiltroInforme[];
  atribucion: string;
  generado: string;
  resumen: { global: IndicadorInforme; categorias: IndicadorInforme[]; notaMeta: string };
  graficaGlobal: GraficaInforme;
  aviso: string | null;
  detalle: DetalleInforme;
  nombreArchivo: string;
}

export interface EntradaInforme {
  datos: RespuestaCumplimiento;
  /** Programas del filtro aplicado; null = aún no se aplicó ningún filtro. */
  programas: string[] | null;
  /** Cédula del profesional en detalle; null = vista general. */
  documento: string | null;
  generado: Date;
}

/* ── Constantes ──────────────────────────────── */

export const TITULO_INFORME = "Informe de cumplimiento";

export const TEXTO_ATRIBUCION: Record<RespuestaCumplimiento["atribucion"], string> = {
  ordenador: "Órdenes atribuidas al médico ordenador",
  digitador: "Órdenes atribuidas al usuario que digitó",
  nombre: "Órdenes atribuidas por nombre del profesional",
};

/** Con más barras que estas, las etiquetas sobre cada barra se pisan. */
export const MAX_BARRAS_CON_ETIQUETA = 12;

const PASOS_EJE = [20, 50, 100, 200, 500, 1000, 2000, 5000];
const MAX_DIVISIONES_EJE = 8;

/* ── Utilidades ──────────────────────────────── */

/** Texto apto para un nombre de archivo: sin tildes, en minúsculas y con guiones. */
export function slugArchivo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function nombreArchivoInforme(desde: number | null, hasta: number | null, profesional: string | null): string {
  const partes = ["cumplimiento", String(desde ?? ""), String(hasta ?? "")];
  if (profesional) partes.push(slugArchivo(profesional));
  return `${partes.join("_")}.pdf`;
}

/** Marcas del eje Y: múltiplos de un paso redondo, sin pasar del techo. */
export function marcasEje(techo: number): number[] {
  const paso = PASOS_EJE.find((p) => techo / p <= MAX_DIVISIONES_EJE) ?? PASOS_EJE[PASOS_EJE.length - 1];
  const marcas: number[] = [];
  for (let v = 0; v <= techo; v += paso) marcas.push(v);
  return marcas;
}

function celda(valor: number | null): CeldaPct {
  return { texto: fmtPct(valor), estado: estadoMeta(valor) };
}

function indicador(etiqueta: string, valor: number | null): IndicadorInforme {
  const c = celda(valor);
  return { etiqueta, ...c, estadoTexto: ETIQUETA_ESTADO[c.estado] };
}

function techoDe(puntos: PuntoGrafica[]): number {
  return techoEje(Math.max(0, ...puntos.map((p) => p.pct ?? 0)));
}

function grafica(serie: ValorPeriodo[], subtitulo: string): GraficaInforme {
  const puntos = puntosGrafica(serie);
  const techo = techoDe(puntos);
  return {
    titulo: "Cumplimiento global por mes",
    subtitulo,
    puntos,
    techo,
    marcas: marcasEje(techo),
    conEtiquetas: puntos.length <= MAX_BARRAS_CON_ETIQUETA,
    hayDatos: puntos.some((p) => p.pct !== null),
  };
}

function tendencia(etiqueta: string, serie: ValorPeriodo[]): TendenciaInforme {
  const puntos = puntosGrafica(serie);
  const techo = techoDe(puntos);
  const conDato = [...serie].sort((a, b) => a.periodo - b.periodo).filter((s) => s.valor !== null);
  const ultimo = conDato[conDato.length - 1];
  return {
    etiqueta,
    puntos,
    techo,
    marcas: marcasEje(techo),
    ultimo: ultimo ? { ...celda(ultimo.valor), periodo: fmtPeriodo(ultimo.periodo) } : null,
  };
}

function resumenDe(resumen: ResumenCumplimiento): InformeCumplimiento["resumen"] {
  return {
    global: indicador("Cumplimiento global", resumen.global),
    categorias: CATEGORIAS.map((c) => indicador(c.etiqueta, resumen.pct[c.clave] ?? null)),
    notaMeta: "Meta <100% (menor es mejor)",
  };
}

function filaHistorial(f: FilaCumplimiento): FilaHistorialInforme {
  return {
    periodo: fmtPeriodo(f.periodo),
    citas: f.citas === null ? SIN_DATOS : f.citas.toLocaleString("es-CO"),
    programa: f.programa,
    global: celda(f.global),
    categorias: CATEGORIAS.map((c) => {
      const d = f.categorias[c.clave];
      return { tasa: fmtTasa(d.tasa), meta: fmtTasa(d.meta), pct: celda(d.pct) };
    }),
  };
}

function avisoGeneral(sinPrograma: number): string | null {
  if (sinPrograma === 0) return null;
  const inicio =
    sinPrograma === 1
      ? "1 profesional del listado tiene citas atendidas pero no tiene programa asignado."
      : `${sinPrograma} profesionales del listado tienen citas atendidas pero no tienen programa asignado.`;
  return `${inicio} Sin programa no hay meta y no se calcula su porcentaje.`;
}

const AVISO_PROFESIONAL =
  "Este profesional tiene citas atendidas en periodos sin programa asignado. Sin programa no hay meta y no se calcula el porcentaje de esos periodos.";

/* ── Construcción ────────────────────────────── */

export function construirInforme({ datos, programas, documento, generado }: EntradaInforme): InformeCumplimiento {
  const filtros: FiltroInforme[] = [];
  const programa = programasFiltrados(programas);
  if (programa) filtros.push({ etiqueta: "Programa", valor: programa });

  const base = {
    titulo: TITULO_INFORME,
    periodo: rangoPeriodos(datos.periodo_desde, datos.periodo_hasta),
    atribucion: TEXTO_ATRIBUCION[datos.atribucion],
    generado: fmtFechaGeneracion(generado),
  };

  if (documento === null) {
    return {
      ...base,
      filtros,
      resumen: resumenDe(datos.resumen),
      graficaGlobal: grafica(
        serieGlobal(datos.serieMensual),
        "Promedio de los profesionales con datos en cada mes"
      ),
      aviso: avisoGeneral(contarSinPrograma(datos.filas)),
      detalle: {
        tipo: "general",
        ranking: ordenarRanking(datos.profesionales, "global", "desc").map((p) => ({
          nombre: p.nombre,
          documento: p.documento,
          programa: p.programa,
          citas: p.citas.toLocaleString("es-CO"),
          global: celda(p.global),
          categorias: CATEGORIAS.map((c) => celda(p.pct[c.clave] ?? null)),
        })),
      },
      nombreArchivo: nombreArchivoInforme(datos.periodo_desde, datos.periodo_hasta, null),
    };
  }

  const profesional = datos.profesionales.find((p) => p.documento === documento);
  if (!profesional) throw new Error("El profesional seleccionado no tiene datos en el rango consultado");

  const filas = datos.filas
    .filter((f) => f.documento === documento)
    .sort((a, b) => a.periodo - b.periodo);
  const serie = serieDeFilas(filas);

  filtros.push({
    etiqueta: "Profesional",
    valor: `${profesional.nombre} · Cédula ${profesional.documento} · ${
      profesional.programa ? `Programa ${profesional.programa}` : "Sin programa"
    }`,
  });

  return {
    ...base,
    filtros,
    resumen: resumenDe(profesional),
    graficaGlobal: grafica(serieGlobal(serie), "Promedio de las categorías con meta en cada mes"),
    aviso: contarSinPrograma(filas) > 0 ? AVISO_PROFESIONAL : null,
    detalle: {
      tipo: "profesional",
      profesional: { nombre: profesional.nombre, documento: profesional.documento, programa: profesional.programa },
      tendencias: CATEGORIAS.map((c) => tendencia(c.etiqueta, serieDeCategoria(serie, c.clave))),
      historial: filas.map(filaHistorial),
    },
    nombreArchivo: nombreArchivoInforme(datos.periodo_desde, datos.periodo_hasta, profesional.nombre),
  };
}

/** Separación entre la cifra y el tope de la barra o la línea de la meta (puntos PDF). */
const SEPARACION_ETIQUETA = 4;
/** Alto aproximado de la cifra sobre su línea base y margen bajo ella (puntos PDF). */
const ALTO_ETIQUETA = 8;
const MARGEN_BAJO_ETIQUETA = 3;

/**
 * Línea base de la cifra de una barra (coordenadas SVG: y crece hacia abajo).
 * Va justo encima de la barra, salvo que la línea de la meta la tache:
 * en ese caso sube por encima de la meta para que se lea completa.
 */
export function yEtiquetaBarra(yTope: number, yMeta: number): number {
  const base = yTope - SEPARACION_ETIQUETA;
  const tachada = yMeta >= base - ALTO_ETIQUETA && yMeta <= base + MARGEN_BAJO_ETIQUETA;
  return tachada ? yMeta - SEPARACION_ETIQUETA : base;
}
