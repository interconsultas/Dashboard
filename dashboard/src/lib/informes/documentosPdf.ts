/**
 * Contenido de cada documento PDF a partir del modelo de informe: qué
 * tablas van (y en qué orden), cuáles se recortan y con qué título.
 * Los documentos (components/informes/pdf) solo maquetan esto. Módulo puro.
 */
import type { ModeloInforme, TablaInforme, TipoInforme } from "./modelo";
import { prepararKpis, prepararTabla, type KpiPdf, type TablaPdf } from "./presentacionPdf";

/** Profesionales que se listan en el PDF; el Excel lleva el listado completo. */
export const LIMITE_PROFESIONALES = 25;

export interface EncabezadoPdf {
  titulo: string;
  subtitulo: string;
  periodo: string;
  comparado: string | null;
  filtros: { etiqueta: string; valor: string }[];
  generado: string;
  /** Nombre del archivo con extensión. */
  archivo: string;
}

export interface ContenidoPdf {
  tipo: TipoInforme;
  encabezado: EncabezadoPdf;
  kpis: KpiPdf[];
  tablas: TablaPdf[];
  notas: string[];
}

/** Tablas de cada documento, en orden, con su título en el PDF. La tendencia del tablero va en gráfica. */
const TABLAS: Record<TipoInforme, { id: string; titulo?: string; limite?: number }[]> = {
  vista: [
    { id: "areas" },
    { id: "servicios" },
    { id: "profesionales", titulo: "Profesionales con más citas asignadas", limite: LIMITE_PROFESIONALES },
  ],
  mensual: [
    { id: "prioridades" },
    { id: "proyeccion" },
    { id: "areas" },
    { id: "servicios" },
    { id: "profesionales", titulo: "Ranking de profesionales por citas inasistidas", limite: LIMITE_PROFESIONALES },
  ],
  ficha: [{ id: "servicios" }, { id: "tendencia" }],
};

export function contenidoPdf(m: ModeloInforme): ContenidoPdf {
  const porId = new Map<string, TablaInforme>(m.tablas.map((t) => [t.id, t]));
  const tablas = TABLAS[m.tipo].flatMap(({ id, titulo, limite }) => {
    const t = porId.get(id);
    return t ? [prepararTabla(titulo ? { ...t, titulo } : t, { limite })] : [];
  });

  return {
    tipo: m.tipo,
    encabezado: {
      titulo: m.titulo,
      subtitulo: m.subtitulo,
      periodo: m.periodo ?? "Sin cargas",
      comparado: m.periodo_anterior ? `Comparado con ${m.periodo_anterior}` : null,
      filtros: m.filtros,
      generado: m.generado,
      archivo: `${m.archivo}.pdf`,
    },
    kpis: prepararKpis(m.kpis),
    tablas,
    notas: m.notas,
  };
}
