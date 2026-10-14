"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { postFetcher, FetchError } from "@/lib/fetcher";
import { fmtPeriodo } from "@/lib/periodo";
import { PROGRAMAS_META, etiquetaPrograma } from "@/lib/cumplimiento/categorias";
import { cuerpoConsulta, errorDeRango, type FiltrosCumplimiento } from "@/lib/cumplimiento/filtros";
import type { RespuestaCumplimiento } from "@/lib/cumplimiento/tipos";
import CheckDropdown from "@/components/ui/CheckDropdown";
import { Spinner } from "@/components/ui/Spinner";
import { SkeletonChart, SkeletonTable } from "@/components/ui/SkeletonCard";
import { ErrorState } from "@/components/layout/ErrorState";
import { CumplimientoContenido } from "./CumplimientoContenido";
import { SelectorProfesional } from "./SelectorProfesional";
import { TarjetasCumplimiento } from "./TarjetasCumplimiento";

/* ── Styles ──────────────────────────────────────── */

const selectCls = "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-brand-navy/30 focus:ring-2 focus:ring-brand-navy/10 transition-all";
const labelCls = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

const TODOS_LOS_PROGRAMAS: string[] = [...PROGRAMAS_META];
const OPCIONES_PROGRAMA = PROGRAMAS_META.map((p) => ({ value: p, label: etiquetaPrograma(p) }));

const ERROR_PDF = "No se pudo generar el PDF. Intente de nuevo.";

/* ── Component ──────────────────────────────────── */

export default function CumplimientoView() {
  const [form, setForm] = useState<FiltrosCumplimiento>({
    desde: null,
    hasta: null,
    programas: TODOS_LOS_PROGRAMAS,
  });
  // null: aún no se aplicó ningún filtro y el servidor resuelve el rango por defecto
  const [aplicado, setAplicado] = useState<FiltrosCumplimiento | null>(null);
  // El profesional se elige sobre los datos ya consultados: no dispara otra consulta
  const [documento, setDocumento] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);

  const committedBody = useMemo(() => cuerpoConsulta(aplicado), [aplicado]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<RespuestaCumplimiento>(
    ["/api/cumplimiento", committedBody],
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
    }
  );

  // La primera respuesta trae el rango por defecto (últimos periodos con citas)
  const desdeServidor = data?.periodo_desde ?? null;
  const hastaServidor = data?.periodo_hasta ?? null;
  useEffect(() => {
    setForm((f) =>
      f.desde === null && f.hasta === null && desdeServidor !== null && hastaServidor !== null
        ? { ...f, desde: desdeServidor, hasta: hastaServidor }
        : f
    );
  }, [desdeServidor, hastaServidor]);

  useEffect(() => {
    if (isApplying && !isValidating) setIsApplying(false);
  }, [isApplying, isValidating]);

  const periodos = data?.periodos_disponibles ?? [];
  const revalidating = isValidating && !isLoading;
  const buttonLoading = isApplying || revalidating;

  const vigente: FiltrosCumplimiento =
    aplicado ?? { desde: desdeServidor, hasta: hastaServidor, programas: TODOS_LOS_PROGRAMAS };
  const isDirty = cuerpoConsulta(form) !== cuerpoConsulta(vigente);
  const errorRango = errorDeRango(form.desde, form.hasta);

  const opcionesDesde = form.hasta ? periodos.filter((p) => p <= form.hasta!) : periodos;
  const opcionesHasta = form.desde ? periodos.filter((p) => p >= form.desde!) : periodos;

  /* ── Handlers ── */

  function setPeriodo(field: "desde" | "hasta", raw: string) {
    setForm((f) => ({ ...f, [field]: raw ? Number(raw) : null }));
  }

  function togglePrograma(programa: string) {
    setForm((f) => ({
      ...f,
      programas: f.programas.includes(programa)
        ? f.programas.filter((p) => p !== programa)
        : [...f.programas, programa],
    }));
  }

  function handleApply() {
    setIsApplying(true);
    setAplicado(form);
  }

  const sinCitas = !!data && data.periodos_disponibles.length === 0;

  /* ── Exportar a PDF ── */

  const profesional =
    documento !== null ? data?.profesionales.find((p) => p.documento === documento) ?? null : null;
  const hayContenido = !!data && !sinCitas && (documento === null || profesional !== null);

  async function exportarPdf() {
    if (!data || generandoPdf) return;
    setGenerandoPdf(true);
    setErrorPdf(null);
    try {
      // Carga diferida: el generador de PDF solo se descarga y ejecuta en el navegador al pedirlo
      const { descargarInforme } = await import("./pdf/descargarInforme");
      await descargarInforme({ datos: data, programas: aplicado?.programas ?? null, documento, generado: new Date() });
    } catch (err) {
      console.error("Error al generar el PDF de cumplimiento", err);
      setErrorPdf(ERROR_PDF);
    } finally {
      setGenerandoPdf(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-brand-navy">Cumplimiento de metas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Órdenes por cita atendida frente a la meta del programa de cada profesional
          </p>
        </div>
        {data && !sinCitas && (
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={exportarPdf}
              disabled={!hayContenido || isValidating || generandoPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {generandoPdf ? (
                <Spinner className="h-4 w-4 text-white" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M6 20h12a2 2 0 002-2V8.414a1 1 0 00-.293-.707l-4.414-4.414A1 1 0 0014.586 3H6a2 2 0 00-2 2v13a2 2 0 002 2z" />
                </svg>
              )}
              {generandoPdf ? "Generando PDF..." : "Exportar PDF"}
            </button>
            {errorPdf && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {errorPdf}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      {data && !sinCitas && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5 space-y-4 sticky top-4 z-10">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Filtros</p>
            {revalidating && <Spinner className="h-3.5 w-3.5 text-brand-navy/40" />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-3">
            <div>
              <label htmlFor="cumplimiento-desde" className={labelCls}>Desde</label>
              <select
                id="cumplimiento-desde"
                className={selectCls}
                value={form.desde ?? ""}
                onChange={(e) => setPeriodo("desde", e.target.value)}
              >
                {form.desde === null && <option value="">Seleccionar</option>}
                {opcionesDesde.map((p) => (
                  <option key={p} value={p}>{fmtPeriodo(p)}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cumplimiento-hasta" className={labelCls}>Hasta</label>
              <select
                id="cumplimiento-hasta"
                className={selectCls}
                value={form.hasta ?? ""}
                onChange={(e) => setPeriodo("hasta", e.target.value)}
              >
                {form.hasta === null && <option value="">Seleccionar</option>}
                {opcionesHasta.map((p) => (
                  <option key={p} value={p}>{fmtPeriodo(p)}</option>
                ))}
              </select>
            </div>

            <div>
              <span className={labelCls}>Programa</span>
              <CheckDropdown
                options={OPCIONES_PROGRAMA}
                selected={form.programas}
                onChange={togglePrograma}
                onSetAll={(programas) => setForm((f) => ({ ...f, programas }))}
                allByDefault={form.programas.length === 0}
              />
            </div>

            <div>
              <span className={labelCls}>Profesional</span>
              <SelectorProfesional
                profesionales={data.profesionales}
                seleccionado={documento}
                onCambiar={setDocumento}
              />
            </div>
          </div>

          {/* Aplicar filtros */}
          <div className="border-t border-gray-100 pt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleApply}
              disabled={!isDirty || buttonLoading || errorRango !== null}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {buttonLoading ? (
                <Spinner className="h-4 w-4 text-white" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              )}
              {buttonLoading ? "Consultando..." : "Aplicar filtros"}
            </button>
            {isDirty && !buttonLoading && errorRango === null && (
              <span className="text-xs text-amber-600 font-medium">Filtros sin aplicar</span>
            )}
            {isDirty && errorRango !== null && (
              <span className="text-xs text-red-600 font-medium">{errorRango}</span>
            )}
            <span className="text-xs text-gray-500 sm:ml-auto">
              El periodo y el programa se consultan al aplicar; el profesional se muestra de inmediato.
            </span>
          </div>
        </div>
      )}

      {/* Error con datos previos en pantalla */}
      {error && data && (
        <div className={`rounded-2xl border px-5 py-4 flex items-center gap-3 ${
          error instanceof FetchError && error.status === 503
            ? "border-amber-200 bg-amber-50"
            : "border-red-200 bg-red-50"
        }`}>
          <p className={`text-sm ${error instanceof FetchError && error.status === 503 ? "text-amber-700" : "text-red-700"}`}>
            {error instanceof FetchError && error.status === 503
              ? "Los datos se están actualizando tras la última carga. Reintentando automáticamente..."
              : `No se pudieron cargar los datos. ${error.message || "Intente de nuevo más tarde."}`}
          </p>
        </div>
      )}

      {error && !data ? (
        <ErrorState error={error} reset={() => mutate()} titulo="No se pudo cargar el cumplimiento" />
      ) : !data ? (
        <div className="space-y-6">
          <TarjetasCumplimiento resumen={null} loading />
          <SkeletonChart />
          <SkeletonTable rows={8} />
        </div>
      ) : (
        <div className={`transition-opacity duration-300 ${revalidating ? "opacity-60" : ""}`}>
          <CumplimientoContenido datos={data} documento={documento} onSeleccionar={setDocumento} />
        </div>
      )}
    </div>
  );
}
