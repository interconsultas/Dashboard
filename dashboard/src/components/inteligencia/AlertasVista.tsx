"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import useSWR from "swr";
import { fetcher, FetchError } from "@/lib/fetcher";
import { leerEstadoAlertas, queryEstadoAlertas, queryPestana, type Pestana } from "@/lib/inteligencia/parametros";
import type { CambioRegla } from "@/lib/inteligencia/reglas";
import type { RespuestaAlertas } from "@/lib/inteligencia/tipos";
import { GRANULARIDADES, type Granularidad } from "@/lib/productividad/periodos";
import { usePuedeEditar, usePuedeVer } from "@/components/layout/RolContext";
import { Spinner } from "@/components/ui/Spinner";
import { ListaAlertas } from "./ListaAlertas";
import { PanelProyeccion } from "./PanelProyeccion";
import { PanelReglas } from "./PanelReglas";
import { EncabezadoInteligencia } from "./PestanasInteligencia";

const API = "/api/inteligencia/alertas";
const API_REGLAS = "/api/inteligencia/reglas";
const ETIQUETA_GRANULARIDAD: Record<Granularidad, string> = { mensual: "Mensual", semanal: "Semanal" };

const opcionesSWR = {
  keepPreviousData: true,
  revalidateOnFocus: false,
  onErrorRetry(err: unknown, _key: string, _config: unknown, revalidate: (o: { retryCount: number }) => void, { retryCount }: { retryCount: number }) {
    if (err instanceof FetchError && err.status === 503 && retryCount < 5) {
      setTimeout(() => revalidate({ retryCount }), 3000 * (retryCount + 1));
    }
  },
};

async function guardarReglas(cambios: CambioRegla[]): Promise<void> {
  const res = await fetch(API_REGLAS, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reglas: cambios }),
  });
  if (!res.ok) {
    const info = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(info?.error ?? "No se pudieron guardar las reglas");
  }
}

/**
 * Inteligencia › Alertas: reglas evaluadas sobre el último periodo cargado
 * de la granularidad y proyección del siguiente. La granularidad vive en la
 * URL (`?pestana=alertas&granularidad=semanal`).
 */
export function AlertasVista() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const veProductividad = usePuedeVer("/dashboard/productividad");
  const editable = usePuedeEditar("inteligencia");
  const estado = useMemo(() => leerEstadoAlertas(new URLSearchParams(searchParams.toString())), [searchParams]);

  const { data, error, isValidating, isLoading, mutate } = useSWR<RespuestaAlertas>(
    `${API}?granularidad=${estado.granularidad}`,
    fetcher,
    opcionesSWR
  );

  const onPestana = (p: Pestana) => {
    if (p === "alertas") return;
    const qs = queryPestana(p, { granularidad: estado.granularidad, periodo: null });
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const onGranularidad = (granularidad: Granularidad) =>
    router.push(`${pathname}?${queryEstadoAlertas({ granularidad })}`, { scroll: false });

  const onGuardar = async (cambios: CambioRegla[]) => {
    await guardarReglas(cambios);
    await mutate();
  };

  const encabezado = (
    <EncabezadoInteligencia pestana="alertas" onPestana={onPestana}>
      {isValidating && !isLoading && <Spinner className="h-4 w-4 text-brand-navy/40" />}
      {data?.periodo && <p className="text-xs text-gray-500">Último periodo: {data.periodo.etiqueta_larga}</p>}
      <div role="group" aria-label="Granularidad" className="inline-flex rounded-lg bg-gray-100 p-0.5">
        {GRANULARIDADES.map((g) => {
          const activo = g === estado.granularidad;
          return (
            <button
              key={g}
              type="button"
              aria-pressed={activo}
              onClick={() => !activo && onGranularidad(g)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activo ? "bg-white text-brand-navy shadow-sm" : "text-gray-500 hover:text-brand-navy"
              }`}
            >
              {ETIQUETA_GRANULARIDAD[g]}
            </button>
          );
        })}
      </div>
    </EncabezadoInteligencia>
  );

  let cuerpo: React.ReactNode;
  if (error && !data) {
    cuerpo = (
      <div role="alert" className="bg-white rounded-2xl border border-red-100 shadow-sm p-6 text-sm text-red-700">
        {error instanceof Error ? error.message : "Error al consultar los datos"}
      </div>
    );
  } else if (!data) {
    cuerpo = (
      <div data-testid="alertas-cargando" className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7 skeleton h-[360px] rounded-2xl" />
        <div className="lg:col-span-5 skeleton h-[360px] rounded-2xl" />
      </div>
    );
  } else {
    cuerpo = (
      <div className="space-y-3">
        {data.periodo === null && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-sm text-gray-500">
            No hay cargas de citas {estado.granularidad === "mensual" ? "mensuales" : "semanales"}: no hay nada que evaluar.
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          <div className="lg:col-span-7 min-w-0">
            <ListaAlertas alertas={data.alertas} reglas={data.reglas} veProductividad={veProductividad} />
          </div>
          <div className="lg:col-span-5 min-w-0">
            <PanelReglas reglas={data.reglas} editable={editable} meta={data.meta} onGuardar={onGuardar} />
          </div>
        </div>
        {data.periodo && (
          <PanelProyeccion
            areas={data.proyeccion.areas}
            servicios={data.proyeccion.servicios}
            siguiente={data.siguiente}
            meta={data.meta}
            minPeriodos={data.min_periodos_proyeccion}
            periodosCargados={data.periodos_cargados}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {encabezado}
      {cuerpo}
    </div>
  );
}
