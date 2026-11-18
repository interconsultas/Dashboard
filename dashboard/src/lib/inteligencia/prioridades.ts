/**
 * Prioridades de Inteligencia › Alertas: vista ejecutiva de las alertas.
 * Módulo puro: consolida las alertas evaluadas (./alertas) en pocas
 * prioridades por área, las mide en citas perdidas y las ordena.
 *
 * El umbral de cada regla decide QUÉ entra; el impacto se mide así:
 *   - inasistencia (servicio o profesional): citas por encima de la meta
 *     institucional, inasistidas − asignadas × meta, en el último periodo
 *   - proyección: (proyectado − meta) × asignadas proyectadas
 *   - disponibilidad (no hay meta institucional): disponibles − ofertadas ×
 *     umbral de la regla
 * También en profesionales equivalentes: impacto ÷ oferta promedio por
 * profesional del periodo (la misma definición del simulador).
 *
 * Consolidación: servicios con inasistencia → una prioridad por área (se
 * nombran los 3 peores); disponibilidad → una por área; profesionales → una
 * sola; proyección → una por área, salvo que el área ya tenga inasistencia
 * sostenida: entonces se fusiona en ella solo como texto (el impacto sigue
 * siendo el del periodo actual frente a la meta).
 *
 * Orden: solo las de impacto material (≥ IMPACTO_MINIMO citas), por impacto
 * descendente; Nuevo y Empeora suman un 10 % al puntaje, así desempatan
 * impactos cercanos sin saltar diferencias grandes. Máximo MAX_PRIORIDADES.
 */
import { aQueryString } from "@/lib/productividad/filtros";
import type { Granularidad } from "@/lib/productividad/periodos";
import { fmtNumero, fmtPct } from "@/lib/productividad/presentacion";
import { fmtUmbral, listaNatural, type Alerta, type ResultadoAlertas, type SerieProyectada } from "./alertas";
import { resultadoBase } from "./simulador";

/** Citas perdidas por encima del umbral para que una prioridad cuente. */
export const IMPACTO_MINIMO = 50;
export const MAX_PRIORIDADES = 5;
/** Servicios o profesionales nombrados en cada prioridad. */
export const MAX_NOMBRADOS = 3;
/** Crecimiento del impacto frente al periodo anterior para decir "Empeora". */
export const CRECIMIENTO_EMPEORA = 0.1;
/** Peso extra de Nuevo/Empeora al ordenar (desempata impactos cercanos). */
const BONO_NOVEDAD = 0.1;

const RUTA_PRODUCTIVIDAD = "/dashboard/productividad";

/* ── Tipos ─────────────────────────────────── */

export type TipoPrioridad = "inasistencia_area" | "disponibilidad_area" | "profesionales" | "proyeccion_area";
export type Novedad = "nuevo" | "empeora" | "persiste";

export interface DetallePrioridad {
  nombre: string;
  texto: string;
  enlace: string;
}

export interface Candidato {
  /** Estable entre periodos: sirve para comparar con el anterior. */
  id: string;
  tipo: TipoPrioridad;
  area: string | null;
  titular: string;
  /** Citas por encima de la referencia (enteras). */
  citas: number;
  /** Referencia del impacto: "por encima de la meta del 10 %", "sin asignar por encima del 15 %". */
  referencia: string;
  /** citas ÷ oferta promedio por profesional; null sin oferta. */
  profesionales: number | null;
  /** Qué revisar: texto fijo según el tipo. */
  revisar: string;
  /** Productividad filtrada (periodo y área). */
  enlace: string;
  detalle: DetallePrioridad[];
}

export interface Prioridad extends Candidato {
  novedad: Novedad;
  /** Impacto del mismo id en el periodo anterior; null si no apareció. */
  citas_anterior: number | null;
}

export interface EntradaPrioridades {
  granularidad: Granularidad;
  /** Clave del periodo evaluado; null sin cargas. */
  periodo: string | null;
  alertas: readonly Alerta[];
  proyeccionAreas: readonly SerieProyectada[];
  siguiente: ResultadoAlertas["siguiente"];
  ofertaPorProfesional: number | null;
  /** Meta institucional de inasistencia (fracción). */
  meta: number;
}

/* ── Impacto ───────────────────────────────── */

/** Oferta promedio por profesional del periodo (definición del simulador). */
export function ofertaPromedioPorProfesional(ofertadas: number, profesionales: number): number | null {
  return resultadoBase({ ofertadas, disponibles: 0, asignadas: 0, inasistidas: 0, profesionales }).oferta_por_profesional;
}

/**
 * Citas que representa la alerta (sin redondear): las de inasistencia, por
 * encima de la meta; las de disponibilidad, por encima del umbral de la regla.
 */
export function impactoAlerta(a: Alerta, areas: readonly SerieProyectada[], meta: number): number {
  const referencia = a.regla === "disponibilidad_servicio" ? a.valores.umbral : meta;
  const exceso = a.valores.actual - referencia;
  if (a.regla === "proyeccion_sobre_meta") {
    const s = areas.find((x) => x.id === a.ambito.id);
    if (!s) return 0;
    return exceso * (s.asignadas?.valor ?? s.asignadas_ultimo);
  }
  return exceso * (a.valores.volumen ?? 0);
}

/* ── Consolidación ─────────────────────────── */

interface Medida {
  alerta: Alerta;
  impacto: number;
}

const porImpacto = (a: Medida, b: Medida) => b.impacto - a.impacto || a.alerta.ambito.nombre.localeCompare(b.alerta.ambito.nombre, "es");

function agruparPorArea(medidas: readonly Medida[]): Map<string, Medida[]> {
  const grupos = new Map<string, Medida[]>();
  for (const m of medidas) {
    const area = m.alerta.ambito.area ?? "Sin área";
    grupos.set(area, [...(grupos.get(area) ?? []), m]);
  }
  for (const lista of Array.from(grupos.values())) lista.sort(porImpacto);
  return grupos;
}

/** "A (36 %), B (31 %), C (25 %) y 2 más" */
function nombrados(medidas: readonly Medida[]): string {
  const partes = medidas.slice(0, MAX_NOMBRADOS).map((m) => `${m.alerta.ambito.nombre} (${fmtPct(m.alerta.valores.actual, 0)})`);
  const resto = medidas.length - partes.length;
  return resto > 0 ? `${partes.join(", ")} y ${resto} más` : listaNatural(partes);
}

const cantidad = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

function detalle(m: Medida): DetallePrioridad {
  const v = m.alerta.valores;
  const sobre = m.alerta.regla === "disponibilidad_servicio" ? `sin asignar sobre el ${fmtUmbral(v.umbral)}` : "sobre la meta";
  return {
    nombre: m.alerta.ambito.nombre,
    texto: `${fmtPct(v.actual)} · ${fmtNumero(Math.max(0, Math.round(m.impacto)))} citas ${sobre}`,
    enlace: m.alerta.enlace,
  };
}

const suma = (medidas: readonly Medida[]) => medidas.reduce((s, m) => s + m.impacto, 0);

export function candidatosPrioridad(e: EntradaPrioridades): Candidato[] {
  const medidas = e.alertas.map((alerta) => ({ alerta, impacto: impactoAlerta(alerta, e.proyeccionAreas, e.meta) }));
  const sobreMeta = `por encima de la meta del ${fmtUmbral(e.meta)}`;
  const de = (regla: Alerta["regla"]) => medidas.filter((m) => m.alerta.regla === regla);
  const filtros = { granularidad: e.granularidad, periodo: e.periodo, servicio: null, profesional: null };
  const enlace = (area: string | null) => `${RUTA_PRODUCTIVIDAD}?${aQueryString({ ...filtros, area })}`;
  const crear = (c: Omit<Candidato, "citas" | "profesionales">, impacto: number): Candidato => {
    const citas = Math.max(0, Math.round(impacto));
    return { ...c, citas, profesionales: e.ofertaPorProfesional ? citas / e.ofertaPorProfesional : null };
  };

  const proyecciones = new Map(de("proyeccion_sobre_meta").map((m) => [m.alerta.ambito.id, m]));
  const fraseProyeccion = (m: Medida) =>
    `se proyecta ${fmtPct(m.alerta.valores.actual, 0)}${e.siguiente ? ` para ${e.siguiente.etiqueta_larga}` : ""}`;
  const candidatos: Candidato[] = [];

  for (const [area, lista] of Array.from(agruparPorArea(de("inasistencia_servicio")))) {
    const proy = proyecciones.get(area);
    proyecciones.delete(area);
    const n = cantidad(lista.length, "servicio", "servicios");
    let titular = `${area}: ${n} con inasistencia sostenida sobre ${fmtUmbral(lista[0].alerta.valores.umbral)} — ${nombrados(lista)}`;
    if (proy) titular += `, y ${fraseProyeccion(proy)}`;
    candidatos.push(
      crear(
        {
          id: `inasistencia|${area}`,
          tipo: "inasistencia_area",
          area,
          titular,
          referencia: sobreMeta,
          revisar: `Revisar recordatorios y sobreagenda en ${area}`,
          enlace: enlace(area),
          detalle: lista.map(detalle),
        },
        suma(lista)
      )
    );
  }

  for (const [area, lista] of Array.from(agruparPorArea(de("disponibilidad_servicio")))) {
    const n = cantidad(lista.length, "servicio", "servicios");
    candidatos.push(
      crear(
        {
          id: `disponibilidad|${area}`,
          tipo: "disponibilidad_area",
          area,
          titular: `${area}: ${n} con más de ${fmtUmbral(lista[0].alerta.valores.umbral)} de citas sin asignar — ${nombrados(lista)}`,
          referencia: `sin asignar por encima del ${fmtUmbral(lista[0].alerta.valores.umbral)}`,
          revisar: `Reasignar o reducir oferta en ${area}`,
          enlace: enlace(area),
          detalle: lista.map(detalle),
        },
        suma(lista)
      )
    );
  }

  const profesionales = de("inasistencia_profesional").sort(porImpacto);
  if (profesionales.length > 0) {
    candidatos.push(
      crear(
        {
          id: "profesionales",
          tipo: "profesionales",
          area: null,
          titular: `${cantidad(profesionales.length, "profesional", "profesionales")} con inasistencia sobre ${fmtUmbral(profesionales[0].alerta.valores.umbral)}`,
          referencia: sobreMeta,
          revisar: "Conversar con los profesionales listados",
          enlace: enlace(null),
          detalle: profesionales.slice(0, MAX_NOMBRADOS).map(detalle),
        },
        suma(profesionales)
      )
    );
  }

  for (const [area, m] of Array.from(proyecciones)) {
    const v = m.alerta.valores;
    const etiquetaUmbral = `meta ${fmtUmbral(v.umbral)}`;
    candidatos.push(
      crear(
        {
          id: `proyeccion|${area}`,
          tipo: "proyeccion_area",
          area,
          titular: `${area}: se proyecta ${fmtPct(v.actual, 0)} de inasistencia${e.siguiente ? ` para ${e.siguiente.etiqueta_larga}` : ""}, en alza (${etiquetaUmbral})`,
          referencia: `${sobreMeta} (proyectadas)`,
          revisar: `Anticipar recordatorios y sobreagenda en ${area}`,
          enlace: enlace(area),
          detalle: [],
        },
        m.impacto
      )
    );
  }

  return candidatos;
}

/* ── Priorización ──────────────────────────── */

export function priorizar(
  actuales: readonly Candidato[],
  anteriores: readonly Candidato[] | null,
  opciones: { minimo?: number; maximo?: number } = {}
): Prioridad[] {
  const minimo = opciones.minimo ?? IMPACTO_MINIMO;
  const maximo = opciones.maximo ?? MAX_PRIORIDADES;
  const previo = new Map((anteriores ?? []).map((c) => [c.id, c.citas]));

  const novedadDe = (c: Candidato): Novedad => {
    const antes = previo.get(c.id);
    if (antes === undefined || antes < minimo) return "nuevo";
    return c.citas - antes >= antes * CRECIMIENTO_EMPEORA - 1e-9 ? "empeora" : "persiste";
  };
  const puntaje = (p: Prioridad) => p.citas * (p.novedad === "persiste" ? 1 : 1 + BONO_NOVEDAD);

  return actuales
    .filter((c) => c.citas >= minimo)
    .map((c): Prioridad => ({ ...c, novedad: novedadDe(c), citas_anterior: previo.get(c.id) ?? null }))
    .sort((a, b) => puntaje(b) - puntaje(a) || b.citas - a.citas || a.titular.localeCompare(b.titular, "es"))
    .slice(0, maximo);
}
