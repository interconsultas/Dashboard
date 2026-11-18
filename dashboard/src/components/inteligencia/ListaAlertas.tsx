"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { Alerta, TipoAmbito } from "@/lib/inteligencia/alertas";
import type { ClaveRegla, Gravedad, ReglaAlerta } from "@/lib/inteligencia/reglas";

const ESTILO_GRAVEDAD: Record<Gravedad, { etiqueta: string; clase: string }> = {
  alta: { etiqueta: "Alta", clase: "bg-red-50 text-red-700 ring-red-200" },
  media: { etiqueta: "Media", clase: "bg-amber-50 text-amber-800 ring-amber-200" },
};

const ETIQUETA_AMBITO: Record<TipoAmbito, string> = { area: "Área", servicio: "Servicio", profesional: "Profesional" };

function IconoGravedad({ gravedad }: { gravedad: Gravedad }) {
  // Alta: triángulo de advertencia; media: círculo con signo de exclamación (la forma también distingue)
  return gravedad === "alta" ? (
    <svg data-testid="icono-gravedad" aria-hidden viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
      <path d="M8 1.5l7 12.5H1L8 1.5z" opacity=".2" />
      <path d="M8 1.5l7 12.5H1L8 1.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11.8" r=".9" />
    </svg>
  ) : (
    <svg data-testid="icono-gravedad" aria-hidden viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="6.3" />
      <path d="M8 4.8v3.6" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11" r=".8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function InsigniaGravedad({ gravedad }: { gravedad: Gravedad }) {
  const e = ESTILO_GRAVEDAD[gravedad];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${e.clase}`}>
      <IconoGravedad gravedad={gravedad} />
      {e.etiqueta}
    </span>
  );
}

function Selector({
  etiqueta,
  valor,
  opciones,
  onCambiar,
}: {
  etiqueta: string;
  valor: string;
  opciones: { valor: string; texto: string }[];
  onCambiar: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        className="mt-0.5 max-w-[240px] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-brand-navy"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Lista de alertas activas con filtros por gravedad y regla. */
export function ListaAlertas({
  alertas,
  reglas,
  veProductividad,
}: {
  alertas: readonly Alerta[];
  reglas: readonly ReglaAlerta[];
  veProductividad: boolean;
}) {
  const [gravedad, setGravedad] = useState<"" | Gravedad>("");
  const [regla, setRegla] = useState<"" | ClaveRegla>("");
  const nombreRegla = useMemo(() => new Map(reglas.map((r) => [r.clave, r.nombre])), [reglas]);
  const visibles = alertas.filter((a) => (!gravedad || a.gravedad === gravedad) && (!regla || a.regla === regla));

  return (
    <section aria-label="Alertas activas" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold text-brand-navy">
          Alertas activas <span className="text-gray-400 font-normal">({alertas.length})</span>
        </h2>
        {alertas.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <Selector
              etiqueta="Gravedad"
              valor={gravedad}
              onCambiar={(v) => setGravedad(v as "" | Gravedad)}
              opciones={[
                { valor: "", texto: "Todas" },
                { valor: "alta", texto: "Alta" },
                { valor: "media", texto: "Media" },
              ]}
            />
            <Selector
              etiqueta="Regla"
              valor={regla}
              onCambiar={(v) => setRegla(v as "" | ClaveRegla)}
              opciones={[{ valor: "", texto: "Todas" }, ...reglas.map((r) => ({ valor: r.clave, texto: r.nombre }))]}
            />
          </div>
        )}
      </div>

      {alertas.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm font-semibold text-brand-navy">Sin alertas activas</p>
          <p className="text-xs text-gray-500 mt-1">Ninguna regla activa se cumple en el último periodo cargado.</p>
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Ninguna alerta coincide con el filtro</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visibles.map((a) => (
            <li key={`${a.regla}|${a.ambito.tipo}|${a.ambito.id}`} className="py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
              <div className="flex-shrink-0 sm:w-20">
                <InsigniaGravedad gravedad={a.gravedad} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">
                  {ETIQUETA_AMBITO[a.ambito.tipo]}
                  {a.ambito.tipo !== "area" && a.ambito.area ? ` · ${a.ambito.area}` : ""} · {nombreRegla.get(a.regla) ?? a.regla}
                </p>
                <p className="text-sm text-brand-navy mt-0.5 break-words">{a.mensaje}</p>
              </div>
              {veProductividad && (
                <Link href={a.enlace} className="flex-shrink-0 text-xs font-semibold text-brand-navy underline whitespace-nowrap">
                  Ver en Productividad
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
