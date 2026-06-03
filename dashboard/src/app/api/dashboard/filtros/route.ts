import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, regionalClause } from "@/lib/middleware-roles";
import { getCached, setCache } from "@/lib/cache";
import {
  type FiltrosBody, type Parsed, type Dimension, type WB,
  wb, toW, buildAll, buildExcept, parseBody, shiftPeriodo,
} from "@/lib/dashboard-filters";
import { resolveView } from "@/lib/view-registry";

/* ── Types ───────────────────────────────────── */

interface SerieMensual {
  periodo: number;
  total: number;
}

interface TopItem {
  nombre: string;
  total: number;
  porcentaje: number;
}

interface FiltrosResponse {
  periodos: number[];
  opciones: {
    estados: string[];
    profesionales: string[];
    programas: string[];
    tipos_convenio: string[];
    ordenes_agrup: string[];
    agrups_salud: string[];
    diagnosticos: string[];
    prestaciones: string[];
  };
  kpis: {
    total_autorizaciones: number;
    valor_total: number;
    periodo_min: number | null;
    periodo_max: number | null;
    total_periodos: number;
    total_profesionales: number;
  };
  serie_actual: SerieMensual[];
  serie_anterior: SerieMensual[];
  top_profesionales: TopItem[];
  top_prestaciones: TopItem[];
  top_diagnosticos: TopItem[];
}

/* ── Constants ──────────────────────────────── */

/* ── Handler ─────────────────────────────────── */

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["admin", "direccion_medica", "coordinador"]);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body: FiltrosBody = await req.json().catch(() => ({}));
  const view = resolveView(body.view);
  const wantsDefaults = !!body.apply_defaults;

  const reg = regionalClause(user, 1, "r");

  // ── Cuando apply_defaults, resolver periodos primero para calcular defaults ──
  let p = parseBody(body);
  let defaultsApplied: Record<string, unknown> | undefined;

  if (wantsDefaults && !p.desde && !p.hasta && p.estado.length === 0) {
    const bPre = wb();
    buildExcept(bPre, p, reg, "periodo");
    const periodos = await query<{ periodo: number }>(
      `SELECT DISTINCT periodo FROM ${view} r ${toW(bPre)} ORDER BY periodo`, bPre.params
    );
    if (periodos.length > 0) {
      const ps = periodos.map((r) => r.periodo);
      const desde = ps.length >= 12 ? ps[ps.length - 12] : ps[0];
      const hasta = ps[ps.length - 1];
      p = { ...p, desde, hasta, estado: ["ACTIVO", "INACTIVO"] };
      defaultsApplied = { desde, hasta, estado: ["ACTIVO", "INACTIVO"], touched: ["estado"] };
    }
  }

  // ── Cache (usa body con defaults ya aplicados) ──
  const sortedBody = { ...body, ...(defaultsApplied ? { desde: p.desde, hasta: p.hasta, estado: p.estado } : {}) } as Record<string, unknown>;
  delete sortedBody.apply_defaults;
  for (const key of Object.keys(sortedBody)) {
    const v = sortedBody[key];
    if (Array.isArray(v)) sortedBody[key] = [...v].sort();
  }
  const cacheStr = JSON.stringify({ view, rol: user.rol, reg: user.regional, ...sortedBody });
  const cached = getCached<FiltrosResponse>(cacheStr);
  if (cached) {
    const payload = defaultsApplied ? { ...cached, defaults_applied: defaultsApplied } : cached;
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } });
  }

  // ── Periodos: sin filtro de periodo ──
  const bPer = wb(); buildExcept(bPer, p, reg, "periodo");
  const periodosQ = query<{ periodo: number }>(
    `SELECT DISTINCT periodo FROM ${view} r ${toW(bPer)} ORDER BY periodo`, bPer.params
  );

  // ── Opciones cascada: cada dimensión excluye su propio filtro ──
  function optQ(dim: Dimension, col: string) {
    const b = wb(); buildExcept(b, p, reg, dim);
    return query<{ v: string | null }>(
      `SELECT DISTINCT ${col} AS v FROM ${view} r ${toW(b)} ORDER BY v NULLS LAST`, b.params
    );
  }

  const estadosQ = optQ("estado", "estado_medico");
  const profQ = optQ("profesional", "nombre_medico");
  const progQ = optQ("programa", "programa_especialidad");
  const tcQ = optQ("tipo_convenio", "tipo_convenio_desc");
  const oaQ = optQ("orden_agrup", "orden_agrup_prest_desc");
  const asQ = optQ("agrup_salud", "agrup_salud_prest_desc");
  const diagQ = optQ("diagnostico", "diagnostico_desc");
  const prestQ = optQ("prestacion", "descripcion_prestacion");

  // ── KPIs: todos los filtros ──
  const bKpi = wb(); buildAll(bKpi, p, reg);
  const kpisQ = query<{
    total_autorizaciones: string;
    valor_total: string;
    periodo_min: number | null;
    periodo_max: number | null;
    total_periodos: string;
    total_profesionales: string;
  }>(
    `SELECT COALESCE(SUM(total_autorizaciones),0) AS total_autorizaciones,
            COALESCE(SUM(valor_total),0) AS valor_total,
            MIN(periodo) AS periodo_min, MAX(periodo) AS periodo_max,
            COUNT(DISTINCT periodo) AS total_periodos,
            COUNT(DISTINCT nombre_medico) AS total_profesionales
     FROM ${view} r ${toW(bKpi)}`, bKpi.params
  );

  // ── Series mensuales: actual + anterior ──
  const bSerie = wb(); buildAll(bSerie, p, reg);
  const serieActualQ = query<{ periodo: number; total: string }>(
    `SELECT periodo, SUM(total_autorizaciones) AS total
     FROM ${view} r ${toW(bSerie)} GROUP BY periodo ORDER BY periodo`,
    bSerie.params
  );

  // ── Top 10: profesionales, prestaciones, diagnósticos ──
  function topQ(col: string) {
    const b = wb(); buildAll(b, p, reg);
    b.clauses.push(`${col} IS NOT NULL`);
    return query<{ nombre: string; total: string }>(
      `SELECT ${col} AS nombre, SUM(total_autorizaciones)::bigint AS total
       FROM ${view} r ${toW(b)}
       GROUP BY ${col}
       ORDER BY total DESC
       LIMIT 10`,
      b.params
    );
  }
  const topProfQ = topQ("nombre_medico");
  const topPrestQ = topQ("descripcion_prestacion");
  const topDiagQ = topQ("diagnostico_desc");

  let serieAnteriorQ: Promise<{ periodo: number; total: string }[]> = Promise.resolve([]);
  if (p.desde && p.hasta) {
    const pPrev: Parsed = { ...p, desde: shiftPeriodo(p.desde, 12), hasta: shiftPeriodo(p.hasta, 12) };
    const bPrev = wb(); buildAll(bPrev, pPrev, reg);
    serieAnteriorQ = query<{ periodo: number; total: string }>(
      `SELECT periodo, SUM(total_autorizaciones) AS total
       FROM ${view} r ${toW(bPrev)} GROUP BY periodo ORDER BY periodo`,
      bPrev.params
    );
  }

  const [periodosR, estadosR, profR, progR, tcR, oaR, asR, diagR, prestR, kpisR, serieActualR, serieAnteriorR, topProfR, topPrestR, topDiagR] = await Promise.all([
    periodosQ, estadosQ, profQ, progQ, tcQ, oaQ, asQ, diagQ, prestQ, kpisQ, serieActualQ, serieAnteriorQ, topProfQ, topPrestQ, topDiagQ,
  ]);

  const notNull = (rows: { v: string | null }[]) => rows.filter((r) => r.v != null).map((r) => r.v as string);

  const k = kpisR[0];
  const result: FiltrosResponse = {
    periodos: periodosR.map((r) => r.periodo),
    opciones: {
      estados: notNull(estadosR),
      profesionales: notNull(profR),
      programas: notNull(progR),
      tipos_convenio: notNull(tcR),
      ordenes_agrup: notNull(oaR),
      agrups_salud: notNull(asR),
      diagnosticos: notNull(diagR),
      prestaciones: notNull(prestR),
    },
    kpis: {
      total_autorizaciones: Number(k?.total_autorizaciones ?? 0),
      valor_total: Number(k?.valor_total ?? 0),
      periodo_min: k?.periodo_min ?? null,
      periodo_max: k?.periodo_max ?? null,
      total_periodos: Number(k?.total_periodos ?? 0),
      total_profesionales: Number(k?.total_profesionales ?? 0),
    },
    serie_actual: serieActualR.map((r) => ({ periodo: r.periodo, total: Number(r.total) })),
    serie_anterior: serieAnteriorR.map((r) => ({ periodo: r.periodo, total: Number(r.total) })),
    ...(() => {
      const totalAut = Number(k?.total_autorizaciones ?? 0);
      const toTop = (rows: { nombre: string; total: string }[]) =>
        rows.map((r) => ({
          nombre: r.nombre,
          total: Number(r.total),
          porcentaje: totalAut > 0 ? (Number(r.total) / totalAut) * 100 : 0,
        }));
      return {
        top_profesionales: toTop(topProfR),
        top_prestaciones: toTop(topPrestR),
        top_diagnosticos: toTop(topDiagR),
      };
    })(),
  };

  setCache(cacheStr, result);

  const payload = defaultsApplied ? { ...result, defaults_applied: defaultsApplied } : result;
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
  });
}
