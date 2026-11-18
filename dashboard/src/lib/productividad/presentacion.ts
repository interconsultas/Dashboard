/**
 * Colores y formatos del tablero de productividad (prototipo aprobado por
 * el cliente). La paleta categórica pasa el validador de daltonismo; las
 * etiquetas visibles y la matriz cubren el contraste de los tonos claros.
 */
import { COLORES, FUENTE_TEXTO, PALETA_CATEGORICA } from "@/lib/tema/tokens";

/* ── Colores (salen de los tokens de diseño: lib/tema/tokens) ── */

export const TINTA = COLORES.tinta;
export const TINTA_2 = COLORES["tinta-2"];
export const TINTA_3 = COLORES["tinta-3"];
export const REJILLA = COLORES.borde;
export const AZUL_SERIE = COLORES.primario;
export const NAVY = COLORES["primario-oscuro"];
export const ROJO_MALO = COLORES.critico;

/** Orden fijo: el color sigue al área (su posición en areas_servicio.orden). */
export const COLORES_AREA: readonly string[] = PALETA_CATEGORICA;
const GRIS_NEUTRO = COLORES.referencia;

/** Escala secuencial de un solo tono, de claro a oscuro. */
export const ESCALA_SECUENCIAL = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
/** Desde este paso de la escala la tinta del texto es blanca. */
const PASO_TINTA_CLARA = 4;

export const FUENTE = FUENTE_TEXTO;

export function colorArea(area: string, areas: readonly string[]): string {
  const i = areas.indexOf(area);
  return i >= 0 && i < COLORES_AREA.length ? COLORES_AREA[i] : GRIS_NEUTRO;
}

/** Formato condicional: tono de la escala según la posición de v entre lo y hi. */
export function celdaCalor(v: number | null, lo: number, hi: number): { fondo: string; tinta: string } | null {
  if (v === null) return null;
  const t = hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 0;
  const i = Math.round(t * (ESCALA_SECUENCIAL.length - 1));
  return { fondo: ESCALA_SECUENCIAL[i], tinta: i >= PASO_TINTA_CLARA ? "#fff" : TINTA };
}

/* ── Formatos ───────────────────────────────── */

const nf = new Intl.NumberFormat("es-CO");

export function fmtNumero(v: number): string {
  return nf.format(v);
}

export function fmtPct(v: number | null, decimales = 1): string {
  if (v === null) return "—";
  return `${(v * 100).toLocaleString("es-CO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} %`;
}

/** "▲ 2,1 pp" / "▼ 10 %" / "= 0 %" */
export function fmtVariacion(v: number, tipo: "relativa" | "puntos"): string {
  const flecha = v > 0 ? "▲" : v < 0 ? "▼" : "=";
  const abs = Math.abs(v).toLocaleString("es-CO", { maximumFractionDigits: 1 });
  return `${flecha} ${abs}${tipo === "puntos" ? " pp" : " %"}`;
}

/* ── Buscador de profesional ────────────────── */

export interface OpcionProfesional {
  documento: string;
  nombre: string;
}

/** Valor de la opción del datalist. */
export function etiquetaProfesional(p: OpcionProfesional): string {
  return `${p.nombre} · ${p.documento}`;
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Documento del profesional que corresponde exactamente al texto, o null. */
export function buscarProfesional(texto: string, opciones: readonly OpcionProfesional[]): string | null {
  const t = normalizar(texto);
  if (!t) return null;
  const encontrado =
    opciones.find((p) => normalizar(etiquetaProfesional(p)) === t) ??
    opciones.find((p) => p.documento === t) ??
    (() => {
      const porNombre = opciones.filter((p) => normalizar(p.nombre) === t);
      return porNombre.length === 1 ? porNombre[0] : undefined;
    })();
  return encontrado?.documento ?? null;
}
