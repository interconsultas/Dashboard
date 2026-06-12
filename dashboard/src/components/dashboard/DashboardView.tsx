"use client";

import { useReducer, useRef, useMemo, useCallback, useState, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { postFetcher, FetchError } from "@/lib/fetcher";
import { type FiltrosBody } from "@/lib/dashboard-filters";
import CheckDropdown from "@/components/ui/CheckDropdown";
import { estadoLabel } from "@/lib/estado";
import { Spinner } from "@/components/ui/Spinner";
import TendenciaMensual from "@/components/dashboard/TendenciaMensual";
import TopProfesionales from "@/components/dashboard/TopProfesionales";

/* ── Helpers ─────────────────────────────────────── */

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function periodoLabel(p: number | null) {
  if (!p) return "—";
  return `${MESES[(p % 100) - 1]} ${Math.floor(p / 100)}`;
}

/* ── Types ───────────────────────────────────────── */

type CheckField = "estado" | "profesional" | "programa" | "tipo_convenio" | "orden_agrup" | "agrup_salud" | "diagnostico" | "prestacion";

interface Filters {
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
  touched: string[];
}

type Action =
  | { type: "SET_PERIODO"; field: "desde" | "hasta"; value: number | null }
  | { type: "TOGGLE"; field: CheckField; value: string }
  | { type: "SET_ALL"; field: CheckField; values: string[] }
  | { type: "DEFAULTS"; partial: Partial<Filters> }
  | { type: "RESET" };

interface FiltrosData {
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
  serie_actual: { periodo: number; total: number }[];
  serie_anterior: { periodo: number; total: number }[];
  top_profesionales: { nombre: string; total: number; porcentaje: number }[];
  top_prestaciones: { nombre: string; total: number; porcentaje: number }[];
  top_diagnosticos: { nombre: string; total: number; porcentaje: number }[];
  defaults_applied?: { desde: number; hasta: number; estado: string[]; touched: string[] };
}

export interface DashboardViewProps {
  title: string;
  subtitle: string;
  viewName?: string;
}

/* ── Reducer ─────────────────────────────────────── */

const initial: Filters = {
  desde: null, hasta: null,
  estado: [], profesional: [], programa: [],
  tipo_convenio: [], orden_agrup: [], agrup_salud: [],
  diagnostico: [], prestacion: [],
  touched: [],
};

function addTouched(touched: string[], field: string): string[] {
  return touched.includes(field) ? touched : [...touched, field];
}

function reducer(state: Filters, action: Action): Filters {
  switch (action.type) {
    case "RESET":
      return initial;
    case "DEFAULTS":
      return { ...state, ...action.partial, touched: action.partial.touched ?? [] };
    case "SET_PERIODO": {
      const next = { ...state, [action.field]: action.value };
      if (action.field === "desde" && action.value && next.hasta && action.value > next.hasta)
        next.hasta = null;
      if (action.field === "hasta" && action.value && next.desde && action.value < next.desde)
        next.desde = null;
      return next;
    }
    case "TOGGLE": {
      const arr = state[action.field] as string[];
      const has = arr.includes(action.value);
      return {
        ...state,
        [action.field]: has ? arr.filter((v) => v !== action.value) : [...arr, action.value],
        touched: addTouched(state.touched, action.field),
      };
    }
    case "SET_ALL":
      return { ...state, [action.field]: action.values, touched: addTouched(state.touched, action.field) };
  }
}

/* ── Body builder ───────────────────────────────── */

function buildBody(f: Filters, viewName?: string, applyDefaults?: boolean): string {
  function valFor(field: CheckField): string[] {
    return f.touched.includes(field) ? f[field] : [];
  }
  const base: FiltrosBody = {
    desde: f.desde,
    hasta: f.hasta,
    estado: valFor("estado"),
    profesional: valFor("profesional"),
    programa: valFor("programa"),
    tipo_convenio: valFor("tipo_convenio"),
    orden_agrup: valFor("orden_agrup"),
    agrup_salud: valFor("agrup_salud"),
    diagnostico: valFor("diagnostico"),
    prestacion: valFor("prestacion"),
  };
  if (viewName) base.view = viewName;
  if (applyDefaults) base.apply_defaults = true;
  return JSON.stringify(base);
}

/* ── Styles ──────────────────────────────────────── */

const selectCls = "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-brand-navy/30 focus:ring-2 focus:ring-brand-navy/10 transition-all";

/* ── Component ──────────────────────────────────── */

export default function DashboardView({ title, subtitle, viewName }: DashboardViewProps) {
  const [f, dispatch] = useReducer(reducer, initial);
  const defaultsApplied = useRef(false);
  const { mutate: globalMutate } = useSWRConfig();

  const body = useMemo(() => buildBody(f, viewName), [f, viewName]);

  const [committedBody, setCommittedBody] = useState(() => buildBody(initial, viewName, true));

  const isDirty = body !== committedBody;

  function handleApply() {
    setIsApplying(true);
    setCommittedBody(body);
  }

  const { data, error, isLoading, isValidating } = useSWR<FiltrosData>(
    ["/api/dashboard/filtros", committedBody],
    postFetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      errorRetryCount: 5,
      onErrorRetry(err, _key, _config, revalidate, { retryCount }) {
        if (err instanceof FetchError && err.status === 503 && retryCount < 5) {
          setTimeout(() => revalidate({ retryCount }), 3000 * (retryCount + 1));
          return;
        }
      },
      onSuccess(d) {
        if (!defaultsApplied.current && d.periodos.length > 0) {
          defaultsApplied.current = true;
          const da = d.defaults_applied;
          const ps = d.periodos;
          const defaults: Partial<Filters> = {
            hasta: da?.hasta ?? ps[ps.length - 1],
            desde: da?.desde ?? (ps.length >= 12 ? ps[ps.length - 12] : ps[0]),
            estado: da?.estado ?? ["ACTIVO", "INACTIVO"],
            profesional: d.opciones.profesionales,
            programa: d.opciones.programas,
            tipo_convenio: d.opciones.tipos_convenio,
            orden_agrup: d.opciones.ordenes_agrup,
            agrup_salud: d.opciones.agrups_salud,
            diagnostico: d.opciones.diagnosticos,
            prestacion: d.opciones.prestaciones,
            touched: da?.touched ?? ["estado"],
          };
          dispatch({ type: "DEFAULTS", partial: defaults });

          const defaultState: Filters = { ...initial, ...defaults };
          const defaultBody = buildBody(defaultState, viewName);

          if (da) {
            const { defaults_applied: _, ...dataWithoutDefaults } = d;
            globalMutate(["/api/dashboard/filtros", defaultBody], dataWithoutDefaults, false);
          }

          setCommittedBody(defaultBody);
        }
      },
    }
  );

  const periodos = data?.periodos ?? [];
  const o = data?.opciones;
  const revalidating = isValidating && !isLoading;

  const [isApplying, setIsApplying] = useState(false);
  const buttonLoading = isApplying || revalidating;

  useEffect(() => {
    if (isApplying && !isValidating) setIsApplying(false);
  }, [isApplying, isValidating]);

  const opcionesDesde = f.hasta ? periodos.filter((p) => p <= f.hasta!) : periodos;
  const opcionesHasta = f.desde ? periodos.filter((p) => p >= f.desde!) : periodos;

  /* ── Active filters count ── */
  const activeCount = useMemo(() => {
    let count = 0;
    const checks: { field: CheckField; sel: string[]; opts: unknown[] | undefined }[] = [
      { field: "estado", sel: f.estado, opts: o?.estados },
      { field: "profesional", sel: f.profesional, opts: o?.profesionales },
      { field: "programa", sel: f.programa, opts: o?.programas },
      { field: "tipo_convenio", sel: f.tipo_convenio, opts: o?.tipos_convenio },
      { field: "orden_agrup", sel: f.orden_agrup, opts: o?.ordenes_agrup },
      { field: "agrup_salud", sel: f.agrup_salud, opts: o?.agrups_salud },
      { field: "diagnostico", sel: f.diagnostico, opts: o?.diagnosticos },
      { field: "prestacion", sel: f.prestacion, opts: o?.prestaciones },
    ];
    for (const { field, sel, opts } of checks) {
      if (f.touched.includes(field) && sel.length > 0 && opts && sel.length < opts.length) count++;
    }
    return count;
  }, [f, o]);

  const hasCustomPeriod = f.desde !== null || f.hasta !== null;
  const hasActiveFilters = activeCount > 0 || hasCustomPeriod;

  /* ── Handlers ── */

  function setPeriodo(field: "desde" | "hasta", raw: string) {
    dispatch({ type: "SET_PERIODO", field, value: raw ? Number(raw) : null });
  }
  function toggle(field: CheckField, value: string) {
    dispatch({ type: "TOGGLE", field, value });
  }
  function setAll(field: CheckField, values: string[]) {
    dispatch({ type: "SET_ALL", field, values });
  }
  function handleReset() {
    defaultsApplied.current = false;
    dispatch({ type: "RESET" });
    setCommittedBody(buildBody(initial, viewName, true));
  }

  function isAllByDefault(field: CheckField, sel: string[], opts: unknown[] | undefined): boolean {
    if (!opts) return false;
    if (!f.touched.includes(field)) return true;
    return sel.length > 0 && sel.length >= opts.length;
  }

  /* ── Export CSV ── */
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/dashboard/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: committedBody,
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "autorizaciones.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [committedBody]);

  /* ── Filter dropdowns config ── */

  const nivel1: { field: CheckField; label: string; optsKey: keyof FiltrosData["opciones"]; mapFn?: (v: string) => { value: string; label: string } }[] = [
    { field: "estado", label: "Estado", optsKey: "estados", mapFn: (e) => ({ value: e, label: estadoLabel(e) }) },
    { field: "tipo_convenio", label: "Tipo de convenio", optsKey: "tipos_convenio" },
    { field: "orden_agrup", label: "Orden agrup prest", optsKey: "ordenes_agrup" },
    { field: "agrup_salud", label: "Agrup salud prest", optsKey: "agrups_salud" },
  ];

  const nivel2: { field: CheckField; label: string; optsKey: keyof FiltrosData["opciones"] }[] = [
    { field: "profesional", label: "Profesional", optsKey: "profesionales" },
    { field: "programa", label: "Programa / Especialidad", optsKey: "programas" },
    { field: "diagnostico", label: "Diagnostico", optsKey: "diagnosticos" },
    { field: "prestacion", label: "Prestacion", optsKey: "prestaciones" },
  ];

  const visibleNivel1 = nivel1;
  const visibleNivel2 = nivel2;

  function renderDropdown(item: typeof nivel1[number]) {
    const rawOpts = o?.[item.optsKey] ?? [];
    const options = item.mapFn
      ? (rawOpts as string[]).map(item.mapFn)
      : (rawOpts as string[]).map((v) => ({ value: v, label: v }));
    return (
      <div key={item.field}>
        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{item.label}</label>
        <CheckDropdown
          options={options}
          selected={f[item.field]}
          onChange={(v) => toggle(item.field, v)}
          onSetAll={(v) => setAll(item.field, v)}
          allByDefault={isAllByDefault(item.field, f[item.field], o?.[item.optsKey])}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-brand-navy">{title}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {exporting ? (
            <Spinner className="h-4 w-4 text-white" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          {exporting ? "Exportando..." : "Exportar CSV"}
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5 space-y-4 sticky top-4 z-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Filtros</p>
          {revalidating && <Spinner className="h-3.5 w-3.5 text-brand-navy/40" />}
          {activeCount > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-navy/10 text-brand-navy">
              {activeCount} activo{activeCount > 1 ? "s" : ""}
            </span>
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="ml-auto text-[11px] font-medium text-gray-400 hover:text-brand-navy transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpiar
            </button>
          )}
        </div>

        {/* Nivel 1: Filtros generales (baja cardinalidad) */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-x-4 gap-y-3">
            {/* Desde */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Desde</label>
              <select className={selectCls} value={f.desde ?? ""} onChange={(e) => setPeriodo("desde", e.target.value)}>
                <option value="">Seleccionar</option>
                {opcionesDesde.map((p) => (
                  <option key={p} value={p}>{periodoLabel(p)}</option>
                ))}
              </select>
            </div>

            {/* Hasta */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Hasta</label>
              <select className={selectCls} value={f.hasta ?? ""} onChange={(e) => setPeriodo("hasta", e.target.value)}>
                <option value="">Seleccionar</option>
                {opcionesHasta.map((p) => (
                  <option key={p} value={p}>{periodoLabel(p)}</option>
                ))}
              </select>
            </div>

            {visibleNivel1.map(renderDropdown)}
          </div>
        </div>

        {visibleNivel2.length > 0 && (
          <>
            {/* Separador */}
            <div className="border-t border-gray-100" />

            {/* Nivel 2: Filtros de detalle (alta cardinalidad) */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 mb-2">Detalle</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-3">
                {visibleNivel2.map(renderDropdown)}
              </div>
            </div>
          </>
        )}

        {/* Aplicar filtros */}
        <div className="border-t border-gray-100 pt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleApply}
            disabled={!isDirty || buttonLoading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {buttonLoading ? (
              <Spinner className="h-4 w-4 text-white" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            )}
            {buttonLoading ? "Consultando..." : "Aplicar filtros"}
          </button>
          {isDirty && !buttonLoading && (
            <span className="text-xs text-amber-600 font-medium">Filtros sin aplicar</span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className={`rounded-2xl border px-5 py-4 flex items-center gap-3 ${
          error instanceof FetchError && error.status === 503
            ? "border-amber-200 bg-amber-50"
            : "border-red-200 bg-red-50"
        }`}>
          {error instanceof FetchError && error.status === 503 ? (
            <Spinner className="h-5 w-5 text-amber-500 shrink-0" />
          ) : (
            <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <p className={`text-sm ${error instanceof FetchError && error.status === 503 ? "text-amber-700" : "text-red-700"}`}>
            {error instanceof FetchError && error.status === 503
              ? "Los datos se están actualizando tras la última carga. Reintentando automáticamente..."
              : `No se pudieron cargar los datos. ${error.message || "Intenta de nuevo más tarde."}`}
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 transition-opacity duration-300 ${revalidating ? "opacity-60" : ""}`}>
        {([
          {
            title: "Total autorizaciones",
            value: (data?.kpis.total_autorizaciones ?? 0).toLocaleString("es-CO"),
            sub: data?.kpis.periodo_min && data?.kpis.periodo_max
              ? `${periodoLabel(data.kpis.periodo_min)} — ${periodoLabel(data.kpis.periodo_max)}`
              : "Sin datos",
          },
          {
            title: "Promedio mensual",
            value: data?.kpis.total_periodos
              ? Math.round(data.kpis.total_autorizaciones / data.kpis.total_periodos).toLocaleString("es-CO")
              : "0",
            sub: data?.kpis.total_periodos
              ? `${data.kpis.total_periodos} ${data.kpis.total_periodos === 1 ? "periodo" : "periodos"}`
              : "Sin datos",
          },
          {
            title: "Profesionales",
            value: (data?.kpis.total_profesionales ?? 0).toLocaleString("es-CO"),
            sub: "Profesionales activos",
          },
          {
            title: "Promedio por profesional",
            value: data?.kpis.total_profesionales
              ? Math.round(data.kpis.total_autorizaciones / data.kpis.total_profesionales).toLocaleString("es-CO")
              : "0",
            sub: "Autorizaciones / profesional",
          },
        ] as const).map((card, i) => (
          <div
            key={card.title}
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${data ? `animate-fade-slide-up stagger-${i + 1}` : ""}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              {card.title}
            </p>
            {isLoading && !data ? (
              <div className="h-9 w-32 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <>
                <p className="text-3xl font-extrabold text-brand-navy transition-all duration-300">
                  {card.value}
                </p>
                <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Tendencia mensual */}
      <div className={`transition-opacity duration-300 ${revalidating ? "opacity-60" : ""}`}>
        <TendenciaMensual
          serieActual={data?.serie_actual ?? []}
          serieAnterior={data?.serie_anterior ?? []}
          loading={isLoading && !data}
        />
      </div>

      {/* Top 10 rankings */}
      <div className={`transition-opacity duration-300 ${revalidating ? "opacity-60" : ""}`}>
        <TopProfesionales
          profesionales={data?.top_profesionales ?? []}
          prestaciones={data?.top_prestaciones ?? []}
          diagnosticos={data?.top_diagnosticos ?? []}
          loading={isLoading && !data}
        />
      </div>
    </div>
  );
}
