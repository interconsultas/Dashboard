"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher, FetchError } from "@/lib/fetcher";
import { leerEstadoAlertas, queryEstadoAlertas, queryPestana, type Pestana } from "@/lib/inteligencia/parametros";
import type { CambioRegla } from "@/lib/inteligencia/reglas";
import type { RespuestaAlertas } from "@/lib/inteligencia/tipos";
import { GRANULARIDADES, type Granularidad } from "@/lib/productividad/periodos";
import { usePuedeEditar, usePuedeVer } from "@/components/layout/RolContext";
import { Spinner } from "@/components/ui/Spinner";
import { Segmentado } from "@/components/ui/Segmentado";
import { ListaAlertas } from "./ListaAlertas";
import { PanelPrioridades } from "./PanelPrioridades";
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
 * Inteligencia › Alertas, vista ejecutiva: primero la proyección del
 * siguiente periodo, luego las prioridades (máximo 5), la lista completa de
 * alertas plegada y las reglas. La granularidad vive en la
 * URL (`?pestana=alertas&granularidad=semanal`).
 */
export function AlertasVista() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const veProductividad = usePuedeVer("/dashboard/productividad");
  const editable = usePuedeEditar("inteligencia");
  const [verTodas, setVerTodas] = useState(false);
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
      {isValidating && !isLoading && <Spinner className="h-4 w-4 text-primario/50" />}
      {data?.periodo && <p className="text-xs text-tinta-3">Último periodo: {data.periodo.etiqueta_larga}</p>}
      <Segmentado
        etiqueta="Granularidad"
        valor={estado.granularidad}
        onCambiar={onGranularidad}
        opciones={GRANULARIDADES.map((g) => ({ valor: g, etiqueta: ETIQUETA_GRANULARIDAD[g] }))}
      />
    </EncabezadoInteligencia>
  );

  let cuerpo: React.ReactNode;
  if (error && !data) {
    cuerpo = (
      <div role="alert" className="bg-critico-suave rounded-tarjeta border border-critico/20 p-6 text-sm text-critico">
        {error instanceof Error ? error.message : "Error al consultar los datos"}
      </div>
    );
  } else if (!data) {
    cuerpo = (
      <div data-testid="alertas-cargando" className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7 skeleton h-[360px] rounded-tarjeta" />
        <div className="lg:col-span-5 skeleton h-[360px] rounded-tarjeta" />
      </div>
    );
  } else {
    cuerpo = (
      <div className="space-y-3">
        {data.periodo === null && (
          <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-6 text-center text-sm text-tinta-3">
            No hay cargas de citas {estado.granularidad === "mensual" ? "mensuales" : "semanales"}: no hay nada que evaluar.
          </div>
        )}
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
        {data.periodo && (
          <PanelPrioridades prioridades={data.prioridades} impactoMinimo={data.impacto_minimo} veProductividad={veProductividad} />
        )}
        <div className="space-y-3">
          <button
            type="button"
            aria-expanded={verTodas}
            aria-controls="todas-las-alertas"
            onClick={() => setVerTodas((v) => !v)}
            className="w-full flex items-center justify-between gap-2 bg-superficie rounded-tarjeta border border-borde shadow-tarjeta px-4 py-3 text-sm font-semibold text-brand-navy"
          >
            <span>{`${verTodas ? "Ocultar" : "Ver"} todas las alertas (${data.total})`}</span>
            <span aria-hidden className={`transition-transform ${verTodas ? "rotate-180" : ""}`}>▾</span>
          </button>
          {verTodas && (
            <div id="todas-las-alertas">
              <ListaAlertas alertas={data.alertas} reglas={data.reglas} veProductividad={veProductividad} />
            </div>
          )}
        </div>
        <PanelReglas reglas={data.reglas} editable={editable} meta={data.meta} onGuardar={onGuardar} />
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
