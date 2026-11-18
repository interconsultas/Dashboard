/**
 * Estilos compartidos de los informes en PDF: A4 horizontal, banda de marca
 * (azul oscuro sólido con línea lima: @react-pdf no pinta degradados),
 * Sora en títulos y DM Sans en el texto. Colores de lib/tema/tokens.
 */
import { StyleSheet } from "@react-pdf/renderer";
import { COLORES } from "@/lib/tema/tokens";
import { FAMILIA_TEXTO, FAMILIA_TITULO } from "./fuentes";

/* ── Medidas: A4 horizontal (842 × 595 pt) ── */
export const ANCHO_PAGINA = 842;
export const MARGEN = 28;
export const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;
const ALTO_BANDA = 50;
const ALTO_ACENTO = 3;

export const C = {
  banda: COLORES["primario-oscuro"],
  acento: COLORES["acento-lima"],
  primario: COLORES.primario,
  tinta: COLORES.tinta,
  tinta2: COLORES["tinta-2"],
  tinta3: COLORES["tinta-3"],
  borde: COLORES.borde,
  fondo: COLORES.fondo,
  suave: COLORES["superficie-2"],
  primarioSuave: COLORES["primario-suave"],
  blanco: "#FFFFFF",
  atencion: COLORES.atencion,
  atencionSuave: COLORES["atencion-suave"],
} as const;

export const s = StyleSheet.create({
  pagina: {
    paddingTop: ALTO_BANDA + ALTO_ACENTO + 16,
    paddingBottom: MARGEN + 16,
    paddingHorizontal: MARGEN,
    fontFamily: FAMILIA_TEXTO,
    fontSize: 8.5,
    color: C.tinta2,
    backgroundColor: C.blanco,
  },

  /* Banda de marca (fija en cada página) */
  banda: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ALTO_BANDA,
    backgroundColor: C.banda,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: MARGEN,
  },
  acento: { position: "absolute", top: ALTO_BANDA, left: 0, right: 0, height: ALTO_ACENTO, backgroundColor: C.acento },
  // El logo es a color: va sobre una placa blanca para leerse sobre el azul
  placaLogo: { backgroundColor: C.blanco, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  logo: { width: 96, height: 28, objectFit: "contain" },
  bandaTextos: { alignItems: "flex-end" },
  bandaTitulo: { fontFamily: FAMILIA_TITULO, fontWeight: 600, fontSize: 11, color: C.blanco },
  bandaPeriodo: { fontSize: 8.5, color: C.acento, marginTop: 2, fontWeight: 500 },

  /* Pie (fijo) */
  pie: {
    position: "absolute",
    bottom: MARGEN - 8,
    left: MARGEN,
    right: MARGEN,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderTopColor: C.borde,
    paddingTop: 5,
    fontSize: 7,
    color: C.tinta3,
  },

  /* Introducción de la primera página */
  intro: { marginBottom: 12 },
  titulo: { fontFamily: FAMILIA_TITULO, fontWeight: 700, fontSize: 18, color: C.tinta },
  subtitulo: { fontSize: 9, color: C.tinta3, marginTop: 3 },
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  filtro: {
    flexDirection: "row",
    backgroundColor: C.primarioSuave,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    fontSize: 7.5,
    color: C.primario,
  },
  filtroEtiqueta: { fontWeight: 700 },
  generado: { fontSize: 7.5, color: C.tinta3, marginTop: 6 },

  /* Portada del informe mensual */
  portada: { marginTop: 2, marginBottom: 8 },
  portadaEtiqueta: { fontSize: 8, color: C.tinta3, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 },
  portadaTitulo: { fontFamily: FAMILIA_TITULO, fontWeight: 700, fontSize: 24, color: C.tinta, marginTop: 4 },
  portadaPeriodo: { fontFamily: FAMILIA_TITULO, fontWeight: 600, fontSize: 18, color: C.primario, marginTop: 2 },

  /* Secciones */
  seccion: { marginBottom: 14 },
  tituloSeccion: { fontFamily: FAMILIA_TITULO, fontWeight: 600, fontSize: 11, color: C.tinta },
  notaSeccion: { fontSize: 7.5, color: C.tinta3, marginTop: 2 },
  cabeceraSeccion: { marginBottom: 6 },
  aviso: {
    backgroundColor: C.atencionSuave,
    color: C.atencion,
    borderRadius: 6,
    padding: 8,
    fontSize: 8,
    marginBottom: 12,
  },

  /* Indicadores */
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  kpi: { borderWidth: 0.75, borderColor: C.borde, borderRadius: 8, padding: 8, backgroundColor: C.blanco },
  kpiEtiqueta: { fontSize: 6.8, color: C.tinta3, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: 700 },
  kpiValor: { fontFamily: FAMILIA_TITULO, fontWeight: 700, fontSize: 15, color: C.primario, marginTop: 3 },
  kpiPie: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, minHeight: 10 },
  kpiVariacion: { fontSize: 7, color: C.tinta2, fontWeight: 500 },
  chip: { borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, fontSize: 6.5, fontWeight: 700 },

  /* Gráficas */
  graficas: { flexDirection: "row", gap: 8, marginBottom: 14 },
  grafica: { borderWidth: 0.75, borderColor: C.borde, borderRadius: 8, padding: 8 },
  imagenGrafica: { width: "100%", objectFit: "contain", marginTop: 4 },
  sinGrafica: { fontSize: 8, color: C.tinta3, marginTop: 8 },

  /* Tablas */
  tabla: { borderTopWidth: 0.75, borderTopColor: C.borde },
  filaEncabezado: { flexDirection: "row", backgroundColor: C.primario },
  th: { fontSize: 6.6, fontWeight: 700, color: C.blanco, paddingVertical: 4, paddingHorizontal: 3 },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.borde },
  filaPar: { backgroundColor: C.suave },
  filaTotal: { borderTopWidth: 1, borderTopColor: C.tinta, borderBottomWidth: 0 },
  td: { fontSize: 7.3, paddingVertical: 3, paddingHorizontal: 3, color: C.tinta },
  tdTotal: { fontWeight: 700 },
  derecha: { textAlign: "right" },
  semaforo: { borderRadius: 3, marginVertical: 1, marginHorizontal: 1 },
  etiquetaSemaforo: { fontSize: 5.8, fontWeight: 700 },
});
