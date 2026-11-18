"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export const URL_CONTEO = "/api/inteligencia/alertas/conteo";
/** El conteo se recalcula en el servidor cada 5 minutos (caché). */
export const REFRESCO_MS = 180_000;

/** Insignia del menú con el número de prioridades (≤ 5) del último mes. Sin datos o con error no muestra nada. */
export function InsigniaAlertas() {
  const { data, error } = useSWR<{ total: number }>(URL_CONTEO, fetcher, {
    refreshInterval: REFRESCO_MS,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const total = data?.total ?? 0;
  if (error || total <= 0) return null;
  const titulo = `${total} ${total === 1 ? "prioridad" : "prioridades"}`;
  return (
    <span className="ml-auto inline-flex items-center">
      <span
        aria-hidden
        title={titulo}
        className="min-w-[20px] h-5 px-1.5 rounded-full bg-atencion-suave text-atencion text-[11px] font-bold leading-5 text-center tabular-nums"
      >
        {total > 99 ? "99+" : total}
      </span>
      <span className="sr-only">, {titulo}</span>
    </span>
  );
}
