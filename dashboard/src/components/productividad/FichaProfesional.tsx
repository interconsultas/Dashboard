"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { aQueryString, type FiltrosProductividad } from "@/lib/productividad/filtros";
import { opcionesServiciosFicha, opcionesTendenciaFicha } from "@/lib/productividad/graficas";
import { fmtNumero, fmtPct } from "@/lib/productividad/presentacion";
import type { RespuestaFichaProfesional } from "@/lib/productividad/tipos";
import { Grafico } from "./Grafico";

interface Props {
  documento: string;
  /** Filtros activos del tablero: la ficha se calcula con los mismos. */
  filtros: FiltrosProductividad;
  onCerrar: () => void;
}

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-control border border-borde bg-superficie px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-tinta-3">{titulo}</p>
      <p className="text-xl font-bold text-brand-navy tabular-nums mt-0.5">{valor}</p>
      <p className="text-xs text-tinta-3 mt-0.5">{detalle}</p>
    </div>
  );
}

/**
 * Ficha individual de un profesional en un panel lateral modal: indicadores
 * del periodo, percentil frente a sus pares, servicios y tendencia.
 */
export function FichaProfesional({ documento, filtros, onCerrar }: Props) {
  const tituloId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  const params = new URLSearchParams(aQueryString(filtros));
  params.set("documento", documento);
  const { data, error, isLoading } = useSWR<RespuestaFichaProfesional>(
    `/api/productividad/profesional?${params.toString()}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Foco al panel al abrir y de vuelta a quien lo abrió al cerrar; Escape cierra
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar.current();
    };
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      previo?.focus?.();
    };
  }, []);

  const opcionServicios = useMemo(() => (data ? opcionesServiciosFicha(data.servicios) : null), [data]);
  const opcionTendencia = useMemo(() => (data ? opcionesTendenciaFicha(data.tendencia, data.periodo) : null), [data]);

  const a = data?.actual;

  // Portal a <body>: dentro del layout, un contenedor con scroll desplazaba el panel
  // y dejaba una franja sin cubrir arriba.
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div data-testid="ficha-fondo" className="absolute inset-0 bg-brand-navy/30" onClick={onCerrar} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className="absolute right-0 top-0 h-full w-full max-w-[680px] overflow-y-auto bg-surface-app shadow-2xl p-5 focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={tituloId} className="text-xl font-bold text-brand-navy">
              {data?.nombre ?? "Ficha del profesional"}
            </h2>
            <p className="text-sm text-tinta-3 mt-0.5">
              CC {documento}
              {data?.area_principal ? ` · ${data.area_principal}` : ""}
              {data?.etiqueta_periodo ? ` · ${data.etiqueta_periodo}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="shrink-0 rounded-lg bg-brand-blue-soft text-brand-navy px-3 py-1.5 text-sm font-semibold hover:bg-brand-blue-soft-2"
          >
            Cerrar ✕
          </button>
        </div>

        {error ? (
          <div role="alert" className="mt-4 rounded-xl border border-critico/20 bg-critico-suave p-4 text-sm text-critico">
            {error instanceof Error ? error.message : "Error al consultar la ficha"}
          </div>
        ) : isLoading || !data ? (
          <p className="mt-6 text-sm text-tinta-3">Cargando ficha…</p>
        ) : !a ? (
          <p className="mt-6 text-sm text-tinta-3">El profesional no tiene agenda en el periodo con los filtros activos.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
              <Indicador titulo="Asignadas" valor={fmtNumero(a.asignadas)} detalle={`${fmtNumero(a.ofertadas)} ofertadas`} />
              <Indicador
                titulo="% Inasistencia"
                valor={fmtPct(a.pct_inasistencia)}
                detalle={`Institución ${fmtPct(data.institucion.pct_inasistencia)}`}
              />
              <Indicador
                titulo="Percentil"
                valor={data.percentil === null ? "—" : `P${data.percentil}`}
                detalle={
                  data.percentil === null
                    ? "Menos de 50 citas asignadas"
                    : `Mejor que el ${data.percentil} % de ${fmtNumero(data.pares)} pares`
                }
              />
              <Indicador
                titulo="Confirmadas"
                valor={fmtNumero(a.confirmadas)}
                detalle={`${fmtNumero(a.confirmadas_sin_atencion)} sin atención`}
              />
              <Indicador
                titulo="% Disponibilidad"
                valor={fmtPct(a.pct_disponibilidad)}
                detalle={`${fmtNumero(a.disponibles)} sin asignar`}
              />
              <Indicador titulo="Canceladas" valor={fmtNumero(a.canceladas)} detalle={`${fmtNumero(a.bloqueadas)} bloqueadas`} />
            </div>

            <section className="mt-4 rounded-tarjeta border border-borde bg-superficie p-4">
              <h3 className="text-[15px] font-semibold text-brand-navy">Servicios que atiende</h3>
              <p className="text-xs text-tinta-3 mb-2">Atendidas e inasistidas por servicio</p>
              {opcionServicios && (
                <div style={{ height: Math.max(160, data.servicios.length * 38 + 50) }}>
                  <Grafico opcion={opcionServicios} etiqueta="Servicios del profesional" className="h-full" />
                </div>
              )}
            </section>

            <section className="mt-3 rounded-tarjeta border border-borde bg-superficie p-4">
              <h3 className="text-[15px] font-semibold text-brand-navy">Inasistencia en el tiempo</h3>
              <p className="text-xs text-tinta-3 mb-2">% de inasistencia del profesional en cada periodo cargado, contra la meta</p>
              {opcionTendencia && (
                <Grafico opcion={opcionTendencia} etiqueta="Tendencia de inasistencia del profesional" className="h-[220px]" />
              )}
            </section>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
