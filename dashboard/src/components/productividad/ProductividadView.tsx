"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import useSWR from "swr";
import { fetcher, FetchError } from "@/lib/fetcher";
import {
  FILTROS_VACIOS,
  aQueryString,
  aplicarArea,
  aplicarServicio,
  leerFicha,
  leerFiltros,
  queryConFicha,
  type FiltrosProductividad,
} from "@/lib/productividad/filtros";
import type { Granularidad } from "@/lib/productividad/periodos";
import type { RespuestaProductividad } from "@/lib/productividad/tipos";
import { Spinner } from "@/components/ui/Spinner";
import { SkeletonChart, SkeletonTable } from "@/components/ui/SkeletonCard";
import { ArbolPerdidas } from "./ArbolPerdidas";
import { DispersionProfesionales } from "./DispersionProfesionales";
import { FichaProfesional } from "./FichaProfesional";
import { GraficaEmbudo } from "./GraficaEmbudo";
import { GraficaTendencia } from "./GraficaTendencia";
import { MapaCalor } from "./MapaCalor";
import { MatrizDetalle } from "./MatrizDetalle";
import { ParetoPerdidas } from "./ParetoPerdidas";
import { Segmentadores } from "./Segmentadores";
import { TarjetasKpi } from "./TarjetasKpi";

/* ── Subcomponents ───────────────────────────────── */

function Esqueleto() {
  return (
    <div data-testid="productividad-cargando" className="space-y-3">
      <div className="skeleton h-14 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[118px] rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-8"><SkeletonChart /></div>
        <div className="xl:col-span-4"><SkeletonChart /></div>
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}

/* ── Component ──────────────────────────────────── */

/**
 * Contenedor del tablero de productividad: los filtros viven en la URL
 * (compartible, botón Atrás) y cada cambio vuelve a consultar la API.
 */
export default function ProductividadView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filtros = useMemo(() => leerFiltros(new URLSearchParams(searchParams.toString())), [searchParams]);
  const qs = aQueryString(filtros);
  // La ficha abierta vive en la URL pero no es un filtro: no cambia la consulta del tablero
  const ficha = leerFicha(new URLSearchParams(searchParams.toString()));

  const { data, error, isLoading, isValidating } = useSWR<RespuestaProductividad>(
    qs ? `/api/productividad?${qs}` : "/api/productividad",
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      onErrorRetry(err, _key, _config, revalidate, { retryCount }) {
        if (err instanceof FetchError && err.status === 503 && retryCount < 5) {
          setTimeout(() => revalidate({ retryCount }), 3000 * (retryCount + 1));
        }
      },
    }
  );

  /* ── Navegación ── */

  function navegar(f: FiltrosProductividad) {
    const q = aQueryString(f);
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  const servicios = data?.opciones.servicios ?? [];
  const onGranularidad = (granularidad: Granularidad) => navegar({ ...filtros, granularidad, periodo: null });
  const onPeriodo = (periodo: string) => navegar({ ...filtros, periodo });
  const onArea = (area: string | null) => navegar(aplicarArea(filtros, area, servicios));
  const onServicio = (codigo: string | null) => navegar(aplicarServicio(filtros, codigo, servicios));
  const onProfesional = (profesional: string | null) => navegar({ ...filtros, profesional });
  const onLimpiar = () => navegar({ ...FILTROS_VACIOS, granularidad: filtros.granularidad });
  const onCelda = (area: string, periodo: string) => navegar({ ...aplicarArea(filtros, area, servicios), periodo });
  const abrirFicha = (documento: string) => router.push(`${pathname}?${queryConFicha(filtros, documento)}`, { scroll: false });
  const cerrarFicha = () => navegar(filtros);

  /* ── Render ── */

  const encabezado = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-brand-navy">Productividad</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Oferta, asignación, inasistencia y citas perdidas por área, servicio y profesional
        </p>
      </div>
      {isValidating && !isLoading && <Spinner className="h-4 w-4 text-brand-navy/40" />}
    </div>
  );

  if (error && !data) {
    return (
      <div className="space-y-4">
        {encabezado}
        <div role="alert" className="bg-white rounded-2xl border border-red-100 shadow-sm p-6 text-sm text-red-700">
          {error instanceof Error ? error.message : "Error al consultar los datos"}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        {encabezado}
        <Esqueleto />
      </div>
    );
  }

  const listaPeriodos = data.periodos[data.granularidad];
  const periodoSel = listaPeriodos.find((p) => p.clave === data.periodo) ?? null;
  const etiquetaAnterior = listaPeriodos.find((p) => p.clave === data.kpis.periodo_anterior)?.etiqueta ?? null;
  const sinCargas = data.periodo === null;

  return (
    <div className="space-y-3">
      {encabezado}

      <Segmentadores
        filtros={filtros}
        periodo={data.periodo}
        periodos={data.periodos}
        opciones={data.opciones}
        onGranularidad={onGranularidad}
        onPeriodo={onPeriodo}
        onArea={onArea}
        onServicio={onServicio}
        onProfesional={onProfesional}
        onLimpiar={onLimpiar}
        onVerFicha={abrirFicha}
      />

      {sinCargas ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-base font-semibold text-brand-navy">Aún no hay informes de citas cargados</p>
          <p className="text-sm text-gray-500 mt-1">
            El tablero se alimenta del informe detallado por profesional de Agenda Web
            {data.granularidad === "semanal" ? " (cargas semanales)" : ""}.
          </p>
          <Link href="/admin/citas" className="inline-block mt-4 text-sm font-semibold text-brand-navy underline">
            Ir a Citas
          </Link>
        </div>
      ) : (
        <>
          <TarjetasKpi kpis={data.kpis} profesionales={data.profesionales} etiquetaAnterior={etiquetaAnterior} />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-8 min-w-0">
              <GraficaTendencia serie={data.tendencia} seleccionado={data.periodo} onPeriodo={onPeriodo} />
            </div>
            <div className="xl:col-span-4 min-w-0">
              <GraficaEmbudo embudo={data.embudo} />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-7 min-w-0">
              <MapaCalor mapa={data.mapa_calor} area={filtros.area} onCelda={onCelda} />
            </div>
            <div className="xl:col-span-5 min-w-0">
              <ArbolPerdidas
                arbol={data.arbol}
                areas={data.opciones.areas}
                area={filtros.area}
                servicio={filtros.servicio}
                onArea={onArea}
                onServicio={onServicio}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-7 min-w-0">
              <DispersionProfesionales lista={data.profesionales.lista} onFicha={abrirFicha} />
            </div>
            <div className="xl:col-span-5 min-w-0">
              <ParetoPerdidas lista={data.profesionales.lista} onFicha={abrirFicha} />
            </div>
          </div>

          <MatrizDetalle
            matriz={data.matriz}
            areas={data.opciones.areas}
            area={filtros.area}
            etiquetaPeriodo={periodoSel?.etiqueta_larga ?? ""}
            onServicio={onServicio}
          />
        </>
      )}

      {ficha && <FichaProfesional documento={ficha} filtros={filtros} onCerrar={cerrarFicha} />}
    </div>
  );
}
