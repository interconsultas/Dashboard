/**
 * Evaluación de las reglas de alerta y proyección del siguiente periodo.
 * Módulo puro: recibe las filas ya consultadas (GET /api/inteligencia/alertas)
 * y devuelve alertas con mensajes en español y las proyecciones por área y
 * por servicio.
 *
 * Semántica de las reglas (todas comparan "mayor que" el umbral):
 *   - inasistencia_servicio: en cada uno de los últimos `periodos` periodos
 *     cargados de la granularidad —que deben ser consecutivos en el
 *     calendario— el servicio tiene ≥ `minimo` asignadas y % inasistencia
 *     > umbral.
 *   - disponibilidad_servicio: en el último periodo, ≥ `minimo` ofertadas y
 *     % disponibilidad > umbral.
 *   - inasistencia_profesional: en el último periodo, totales del
 *     profesional (todos sus servicios) con ≥ `minimo` asignadas y
 *     % inasistencia > umbral.
 *   - proyeccion_sobre_meta: por área, inasistencia proyectada para el
 *     siguiente periodo > umbral (null = meta institucional) y tendencia en
 *     alza (ver ./proyeccion).
 * Magnitud (para ordenar): valor − umbral, en fracción.
 */
import { aQueryString, queryConFicha, type FiltrosProductividad } from "@/lib/productividad/filtros";
import { periodoCarga } from "@/lib/productividad/construir";
import { claveCarga, etiquetaCarga, etiquetaLargaCarga, type Granularidad, type RangoCarga } from "@/lib/productividad/periodos";
import { fmtNumero, fmtPct } from "@/lib/productividad/presentacion";
import type { PeriodoCarga } from "@/lib/productividad/tipos";
import { proyectarCantidad, proyectarPct, secuenciaCarga, siguienteCarga, type Proyeccion } from "./proyeccion";
import { CLAVES_REGLAS, type ClaveRegla, type Gravedad, type ReglaAlerta } from "./reglas";

/** Servicios con proyección en el panel (los de más asignadas en el último periodo). */
export const MAX_SERVICIOS_PROYECTADOS = 8;

const RUTA_PRODUCTIVIDAD = "/dashboard/productividad";

/* ── Tipos ─────────────────────────────────── */

export interface FilaServicioPeriodo {
  fecha_inicial: string;
  area: string;
  codigo_servicio: string;
  nombre_servicio: string;
  asignadas: number;
  inasistidas: number;
  ofertadas: number;
  disponibles: number;
}

export interface FilaProfesionalPeriodo {
  documento: string;
  nombre: string;
  area_principal: string | null;
  asignadas: number;
  inasistidas: number;
}

export interface EntradaAlertas {
  granularidad: Granularidad;
  /** Cargas de la granularidad, de la más antigua a la más reciente. */
  cargas: readonly RangoCarga[];
  /** Áreas en el orden de areas_servicio. */
  areas: readonly string[];
  /** Filas por periodo × servicio de todas las cargas. */
  servicios: readonly FilaServicioPeriodo[];
  /** Totales por profesional del último periodo. */
  profesionales: readonly FilaProfesionalPeriodo[];
  reglas: readonly ReglaAlerta[];
  /** Meta institucional de inasistencia (fracción). */
  meta: number;
}

export type TipoAmbito = "area" | "servicio" | "profesional";

export interface PuntoHistoria {
  clave: string;
  etiqueta: string;
  /** null si no hubo citas asignadas (u ofertadas) en el periodo. */
  valor: number | null;
}

export interface Alerta {
  regla: ClaveRegla;
  gravedad: Gravedad;
  ambito: { tipo: TipoAmbito; id: string; nombre: string; area: string | null };
  mensaje: string;
  valores: {
    actual: number;
    umbral: number;
    /** Valores que dispararon la regla, del más antiguo al más reciente. */
    serie: PuntoHistoria[];
    /** Asignadas u ofertadas del último periodo. */
    volumen?: number;
    /** Solo proyección. */
    rango?: { min: number; max: number };
  };
  magnitud: number;
  enlace: string;
}

export interface SerieProyectada {
  id: string;
  nombre: string;
  area: string | null;
  historia: PuntoHistoria[];
  /** Asignadas del último periodo. */
  asignadas_ultimo: number;
  /** null = sin datos suficientes (menos de 3 periodos con citas). */
  inasistencia: Proyeccion | null;
  asignadas: Proyeccion | null;
}

export interface ResultadoAlertas {
  periodo: PeriodoCarga | null;
  siguiente: Pick<PeriodoCarga, "clave" | "etiqueta" | "etiqueta_larga"> | null;
  alertas: Alerta[];
  conteo: Record<ClaveRegla, number>;
  total: number;
  proyeccion: { areas: SerieProyectada[]; servicios: SerieProyectada[] };
}

/* ── Formatos ─────────────────────────────────── */

/** "20 %", "12,5 %": sin decimales innecesarios. */
export function fmtUmbral(v: number): string {
  return `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
}

export function listaNatural(partes: readonly string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

const NUMEROS = ["", "", "dos", "tres", "cuatro", "cinco", "seis"];

/** "en el último mes", "en los dos últimos meses", "en las tres últimas semanas". */
export function frasePeriodos(n: number, granularidad: Granularidad): string {
  const semanal = granularidad === "semanal";
  if (n === 1) return semanal ? "en la última semana" : "en el último mes";
  const numero = NUMEROS[n] ?? String(n);
  return semanal ? `en las ${numero} últimas semanas` : `en los ${numero} últimos meses`;
}

/* ── Orden ────────────────────────────────────── */

const PESO_GRAVEDAD: Record<Gravedad, number> = { alta: 0, media: 1 };

export function ordenarAlertas(alertas: readonly Alerta[]): Alerta[] {
  return [...alertas].sort(
    (a, b) =>
      PESO_GRAVEDAD[a.gravedad] - PESO_GRAVEDAD[b.gravedad] ||
      b.magnitud - a.magnitud ||
      a.ambito.nombre.localeCompare(b.ambito.nombre, "es")
  );
}

/* ── Agregación ───────────────────────────────── */

interface Totales {
  asignadas: number;
  inasistidas: number;
  ofertadas: number;
  disponibles: number;
}

const vacio = (): Totales => ({ asignadas: 0, inasistidas: 0, ofertadas: 0, disponibles: 0 });

function sumar(t: Totales, f: Totales): void {
  t.asignadas += f.asignadas;
  t.inasistidas += f.inasistidas;
  t.ofertadas += f.ofertadas;
  t.disponibles += f.disponibles;
}

const pctInasistencia = (t: Totales | undefined) => (t && t.asignadas > 0 ? t.inasistidas / t.asignadas : null);
const pctDisponibilidad = (t: Totales | undefined) => (t && t.ofertadas > 0 ? t.disponibles / t.ofertadas : null);

interface Grupo {
  id: string;
  nombre: string;
  area: string;
  /** fecha_inicial → totales */
  porPeriodo: Map<string, Totales>;
}

function agrupar(filas: readonly FilaServicioPeriodo[], clave: (f: FilaServicioPeriodo) => string, nombre: (f: FilaServicioPeriodo) => string) {
  const grupos = new Map<string, Grupo>();
  for (const f of filas) {
    const k = clave(f);
    let g = grupos.get(k);
    if (!g) {
      g = { id: k, nombre: nombre(f), area: f.area, porPeriodo: new Map() };
      grupos.set(k, g);
    }
    let t = g.porPeriodo.get(f.fecha_inicial);
    if (!t) g.porPeriodo.set(f.fecha_inicial, (t = vacio()));
    sumar(t, f);
  }
  return grupos;
}

/* ── Evaluación ───────────────────────────────── */

interface Contexto {
  e: EntradaAlertas;
  ultima: RangoCarga;
  etiquetaUltima: string;
  filtrosBase: FiltrosProductividad;
}

const punto = (c: RangoCarga, valor: number | null): PuntoHistoria => ({ clave: claveCarga(c), etiqueta: etiquetaCarga(c), valor });

function enlaceProductividad(ctx: Contexto, area: string | null, servicio: string | null): string {
  return `${RUTA_PRODUCTIVIDAD}?${aQueryString({ ...ctx.filtrosBase, area, servicio })}`;
}

function sonConsecutivas(cargas: readonly RangoCarga[]): boolean {
  for (let i = 1; i < cargas.length; i++) {
    if (secuenciaCarga(cargas[i]) - secuenciaCarga(cargas[i - 1]) !== 1) return false;
  }
  return true;
}

function reglaInasistenciaServicio(ctx: Contexto, r: ReglaAlerta, servicios: Map<string, Grupo>): Alerta[] {
  const n = r.periodos ?? 1;
  const umbral = r.umbral ?? 0;
  const minimo = r.minimo ?? 0;
  const ventana = ctx.e.cargas.slice(-n);
  if (ventana.length < n || !sonConsecutivas(ventana)) return [];

  const alertas: Alerta[] = [];
  for (const g of Array.from(servicios.values())) {
    const valores: number[] = [];
    for (const c of ventana) {
      const t = g.porPeriodo.get(c.fecha_inicial);
      const pct = pctInasistencia(t);
      if (!t || t.asignadas < minimo || pct === null || !(pct > umbral)) break;
      valores.push(pct);
    }
    if (valores.length < n) continue;
    const actual = valores[valores.length - 1];
    alertas.push({
      regla: r.clave,
      gravedad: r.gravedad,
      ambito: { tipo: "servicio", id: g.id, nombre: g.nombre, area: g.area },
      mensaje: `${g.area} — ${g.nombre}: inasistencia ${listaNatural(valores.map((v) => fmtPct(v)))} ${frasePeriodos(n, ctx.e.granularidad)} (umbral ${fmtUmbral(umbral)})`,
      valores: {
        actual,
        umbral,
        serie: ventana.map((c, i) => punto(c, valores[i])),
        volumen: g.porPeriodo.get(ctx.ultima.fecha_inicial)!.asignadas,
      },
      magnitud: actual - umbral,
      enlace: enlaceProductividad(ctx, g.area, g.id),
    });
  }
  return alertas;
}

function reglaDisponibilidadServicio(ctx: Contexto, r: ReglaAlerta, servicios: Map<string, Grupo>): Alerta[] {
  const umbral = r.umbral ?? 0;
  const minimo = r.minimo ?? 0;
  const alertas: Alerta[] = [];
  for (const g of Array.from(servicios.values())) {
    const t = g.porPeriodo.get(ctx.ultima.fecha_inicial);
    const pct = pctDisponibilidad(t);
    if (!t || t.ofertadas < minimo || pct === null || !(pct > umbral)) continue;
    alertas.push({
      regla: r.clave,
      gravedad: r.gravedad,
      ambito: { tipo: "servicio", id: g.id, nombre: g.nombre, area: g.area },
      mensaje:
        `${g.area} — ${g.nombre}: disponibilidad ${fmtPct(pct)} en ${ctx.etiquetaUltima} (umbral ${fmtUmbral(umbral)}); ` +
        `${fmtNumero(t.disponibles)} de ${fmtNumero(t.ofertadas)} citas ofertadas sin asignar`,
      valores: { actual: pct, umbral, serie: [punto(ctx.ultima, pct)], volumen: t.ofertadas },
      magnitud: pct - umbral,
      enlace: enlaceProductividad(ctx, g.area, g.id),
    });
  }
  return alertas;
}

function reglaInasistenciaProfesional(ctx: Contexto, r: ReglaAlerta): Alerta[] {
  const umbral = r.umbral ?? 0;
  const minimo = r.minimo ?? 0;
  const alertas: Alerta[] = [];
  for (const p of ctx.e.profesionales) {
    if (p.asignadas <= 0 || p.asignadas < minimo) continue;
    const pct = p.inasistidas / p.asignadas;
    if (!(pct > umbral)) continue;
    alertas.push({
      regla: r.clave,
      gravedad: r.gravedad,
      ambito: { tipo: "profesional", id: p.documento, nombre: p.nombre, area: p.area_principal },
      mensaje:
        `${p.nombre}${p.area_principal ? ` (${p.area_principal})` : ""}: inasistencia ${fmtPct(pct)} en ${ctx.etiquetaUltima} ` +
        `(umbral ${fmtUmbral(umbral)}); ${fmtNumero(p.inasistidas)} inasistidas de ${fmtNumero(p.asignadas)} asignadas`,
      valores: { actual: pct, umbral, serie: [punto(ctx.ultima, pct)], volumen: p.asignadas },
      magnitud: pct - umbral,
      enlace: `${RUTA_PRODUCTIVIDAD}?${queryConFicha(ctx.filtrosBase, p.documento)}`,
    });
  }
  return alertas;
}

function reglaProyeccion(
  ctx: Contexto,
  r: ReglaAlerta,
  areas: readonly SerieProyectada[],
  siguiente: NonNullable<ResultadoAlertas["siguiente"]>
): Alerta[] {
  const umbral = r.umbral ?? ctx.e.meta;
  const etiquetaUmbral = r.umbral === null ? "meta" : "umbral";
  const alertas: Alerta[] = [];
  for (const a of areas) {
    const p = a.inasistencia;
    if (!p || p.direccion !== "sube" || !(p.valor > umbral)) continue;
    alertas.push({
      regla: r.clave,
      gravedad: r.gravedad,
      ambito: { tipo: "area", id: a.id, nombre: a.nombre, area: a.id },
      mensaje:
        `${a.nombre}: inasistencia proyectada ${fmtPct(p.valor)} para ${siguiente.etiqueta_larga} ` +
        `(rango ${fmtPct(p.min)}–${fmtPct(p.max)}), en alza (${etiquetaUmbral} ${fmtUmbral(umbral)})`,
      valores: { actual: p.valor, umbral, serie: a.historia, rango: { min: p.min, max: p.max } },
      magnitud: p.valor - umbral,
      enlace: enlaceProductividad(ctx, a.id, null),
    });
  }
  return alertas;
}

/* ── Proyecciones ─────────────────────────────── */

function serieProyectada(
  cargas: readonly RangoCarga[],
  g: Pick<Grupo, "id" | "nombre" | "porPeriodo">,
  area: string | null
): SerieProyectada {
  const historia = cargas.map((c) => punto(c, pctInasistencia(g.porPeriodo.get(c.fecha_inicial))));
  const pcts = historia.map((h) => h.valor).filter((v): v is number => v !== null);
  const asignadas = cargas.map((c) => g.porPeriodo.get(c.fecha_inicial)?.asignadas ?? 0);
  const ultima = cargas[cargas.length - 1];
  return {
    id: g.id,
    nombre: g.nombre,
    area,
    historia,
    asignadas_ultimo: ultima ? g.porPeriodo.get(ultima.fecha_inicial)?.asignadas ?? 0 : 0,
    inasistencia: proyectarPct(pcts),
    asignadas: proyectarCantidad(asignadas),
  };
}

/* ── Entrada principal ────────────────────────── */

const conteoVacio = () => Object.fromEntries(CLAVES_REGLAS.map((c) => [c, 0])) as Record<ClaveRegla, number>;

export function evaluarAlertas(e: EntradaAlertas): ResultadoAlertas {
  const servicios = agrupar(e.servicios, (f) => f.codigo_servicio, (f) => f.nombre_servicio);
  const porArea = agrupar(e.servicios, (f) => f.area, (f) => f.area);

  const areas = e.areas.map((a) => serieProyectada(e.cargas, porArea.get(a) ?? { id: a, nombre: a, porPeriodo: new Map() }, a));
  const ultima = e.cargas[e.cargas.length - 1];

  if (!ultima) {
    return { periodo: null, siguiente: null, alertas: [], conteo: conteoVacio(), total: 0, proyeccion: { areas, servicios: [] } };
  }

  const serviciosProyectados = Array.from(servicios.values())
    .map((g) => ({ g, asignadas: g.porPeriodo.get(ultima.fecha_inicial)?.asignadas ?? 0 }))
    .filter((x) => x.asignadas > 0)
    .sort((a, b) => b.asignadas - a.asignadas || a.g.nombre.localeCompare(b.g.nombre, "es"))
    .slice(0, MAX_SERVICIOS_PROYECTADOS)
    .map((x) => serieProyectada(e.cargas, x.g, x.g.area));

  const sig = siguienteCarga(ultima);
  const siguiente = { clave: claveCarga(sig), etiqueta: etiquetaCarga(sig), etiqueta_larga: etiquetaLargaCarga(sig) };

  const ctx: Contexto = {
    e,
    ultima,
    etiquetaUltima: etiquetaLargaCarga(ultima),
    filtrosBase: { granularidad: e.granularidad, periodo: claveCarga(ultima), area: null, servicio: null, profesional: null },
  };

  const alertas: Alerta[] = [];
  for (const r of e.reglas) {
    if (!r.activa) continue;
    if (r.clave === "inasistencia_servicio") alertas.push(...reglaInasistenciaServicio(ctx, r, servicios));
    else if (r.clave === "disponibilidad_servicio") alertas.push(...reglaDisponibilidadServicio(ctx, r, servicios));
    else if (r.clave === "inasistencia_profesional") alertas.push(...reglaInasistenciaProfesional(ctx, r));
    else if (r.clave === "proyeccion_sobre_meta") alertas.push(...reglaProyeccion(ctx, r, areas, siguiente));
  }

  const conteo = conteoVacio();
  for (const a of alertas) conteo[a.regla]++;

  return {
    periodo: periodoCarga(ultima),
    siguiente,
    alertas: ordenarAlertas(alertas),
    conteo,
    total: alertas.length,
    proyeccion: { areas, servicios: serviciosProyectados },
  };
}
