/* ── Types ───────────────────────────────────── */

export interface FiltrosBody {
  desde?: number | null;
  hasta?: number | null;
  estado?: string[];
  profesional?: string[];
  programa?: string[];
  tipo_convenio?: string[];
  orden_agrup?: string[];
  agrup_salud?: string[];
  diagnostico?: string[];
  prestacion?: string[];
  exclude_orden_agrup?: string[];
  apply_defaults?: boolean;
  view?: string;
}

export interface Parsed {
  desde: number | null;
  hasta: number | null;
  estado: string[];
  profesional: string[];
  programa: string[];
  tipo_convenio: string[];
  orden_agrup: string[];
  agrup_salud: string[];
  diagnostico: string[];
  prestacion: string[];
  exclude_orden_agrup: string[];
}

export type Dimension = keyof Omit<Parsed, "desde" | "hasta" | "exclude_orden_agrup">;

/* ── Query builder ───────────────────────────── */

export interface WB { clauses: string[]; params: unknown[]; }

export function wb(): WB { return { clauses: ["1=1"], params: [] }; }

export function addPeriodo(b: WB, desde: number | null, hasta: number | null) {
  if (desde) { b.clauses.push(`periodo >= $${b.params.length + 1}`); b.params.push(desde); }
  if (hasta) { b.clauses.push(`periodo <= $${b.params.length + 1}`); b.params.push(hasta); }
}

export function addEstado(b: WB, vals: string[], alias = "r") {
  if (vals.length === 0) return;
  addIn(b, `${alias}.estado_medico`, vals);
}

export function addIn(b: WB, col: string, vals: string[]) {
  if (vals.length === 0) return;
  const ph = vals.map((_, i) => `$${b.params.length + 1 + i}`);
  b.clauses.push(`${col} IN (${ph.join(",")})`);
  b.params.push(...vals);
}

export function addNotIn(b: WB, col: string, vals: string[]) {
  if (vals.length === 0) return;
  const ph = vals.map((_, i) => `$${b.params.length + 1 + i}`);
  b.clauses.push(`${col} NOT IN (${ph.join(",")})`);
  b.params.push(...vals);
}

export function addRegional(b: WB, clause: string, params: (string | null)[]) {
  if (!clause) return;
  let idx = b.params.length;
  const reindexed = clause.replace(/\$\d+/g, () => `$${++idx}`);
  b.clauses.push(reindexed.replace(/^AND\s+/i, ""));
  b.params.push(...params);
}

export function toW(b: WB): string { return `WHERE ${b.clauses.join(" AND ")}`; }

export const DIM_COL: Record<Dimension, string> = {
  estado: "r.estado_medico",
  profesional: "r.nombre_medico",
  programa: "r.programa_especialidad",
  tipo_convenio: "r.tipo_convenio_desc",
  orden_agrup: "r.orden_agrup_prest_desc",
  agrup_salud: "r.agrup_salud_prest_desc",
  diagnostico: "r.diagnostico_desc",
  prestacion: "r.descripcion_prestacion",
};

export function applyDimension(b: WB, dim: Dimension, vals: string[], alias = "r") {
  if (dim === "estado") return addEstado(b, vals, alias);
  addIn(b, DIM_COL[dim].replace(/^r\./, `${alias}.`), vals);
}

export function buildAll(b: WB, p: Parsed, reg: { clause: string; params: (string | null)[] }, alias = "r") {
  addPeriodo(b, p.desde, p.hasta);
  addRegional(b, reg.clause, reg.params);
  for (const dim of Object.keys(DIM_COL) as Dimension[]) {
    if (p[dim].length > 0) applyDimension(b, dim, p[dim], alias);
  }
  if (p.exclude_orden_agrup.length > 0) addNotIn(b, `${alias}.orden_agrup_prest_desc`, p.exclude_orden_agrup);
}

export function buildExcept(b: WB, p: Parsed, reg: { clause: string; params: (string | null)[] }, skip: string) {
  if (skip !== "periodo") addPeriodo(b, p.desde, p.hasta);
  addRegional(b, reg.clause, reg.params);
  for (const dim of Object.keys(DIM_COL) as Dimension[]) {
    if (dim !== skip && p[dim].length > 0) applyDimension(b, dim, p[dim]);
  }
  if (skip !== "orden_agrup" && p.exclude_orden_agrup.length > 0) addNotIn(b, "r.orden_agrup_prest_desc", p.exclude_orden_agrup);
}

export function parseBody(body: FiltrosBody): Parsed {
  return {
    desde: body.desde ?? null,
    hasta: body.hasta ?? null,
    estado: body.estado ?? [],
    profesional: body.profesional ?? [],
    programa: body.programa ?? [],
    tipo_convenio: body.tipo_convenio ?? [],
    orden_agrup: body.orden_agrup ?? [],
    agrup_salud: body.agrup_salud ?? [],
    diagnostico: body.diagnostico ?? [],
    prestacion: body.prestacion ?? [],
    exclude_orden_agrup: body.exclude_orden_agrup ?? [],
  };
}

export function shiftPeriodo(p: number, months: number): number {
  const y = Math.floor(p / 100);
  const m = (p % 100) - 1;
  const total = y * 12 + m - months;
  return Math.floor(total / 12) * 100 + (total % 12) + 1;
}
