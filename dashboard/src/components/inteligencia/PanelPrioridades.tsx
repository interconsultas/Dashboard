"use client";

import Link from "next/link";
import { useState } from "react";
import type { Novedad, Prioridad } from "@/lib/inteligencia/prioridades";
import { fmtNumero } from "@/lib/productividad/presentacion";

const NOVEDAD: Record<Novedad, { etiqueta: string; clase: string }> = {
  nuevo: { etiqueta: "Nuevo", clase: "bg-sky-50 text-sky-800 ring-sky-200" },
  empeora: { etiqueta: "Empeora", clase: "bg-red-50 text-red-700 ring-red-200" },
  persiste: { etiqueta: "Persiste", clase: "bg-gray-50 text-gray-600 ring-gray-200" },
};

function IconoNovedad({ novedad }: { novedad: Novedad }) {
  // Nuevo: estrella; Empeora: flecha hacia arriba; Persiste: reloj (la forma también distingue)
  const comun = { "data-testid": "icono-novedad", "aria-hidden": true, viewBox: "0 0 16 16", className: "w-3.5 h-3.5" } as const;
  if (novedad === "nuevo") {
    return (
      <svg {...comun} fill="currentColor">
        <path d="M8 1.5l1.9 4.1 4.4.5-3.3 3 .9 4.4L8 11.3l-3.9 2.2.9-4.4-3.3-3 4.4-.5L8 1.5z" />
      </svg>
    );
  }
  if (novedad === "empeora") {
    return (
      <svg {...comun} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 13.5V3M3.5 7.5L8 3l4.5 4.5" />
      </svg>
    );
  }
  return (
    <svg {...comun} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8V8l2.2 1.4" />
    </svg>
  );
}

function InsigniaNovedad({ novedad }: { novedad: Novedad }) {
  const e = NOVEDAD[novedad];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${e.clase}`}>
      <IconoNovedad novedad={novedad} />
      {e.etiqueta}
    </span>
  );
}

const fmtProfesionales = (v: number) => v.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function TarjetaPrioridad({ p, orden, veProductividad }: { p: Prioridad; orden: number; veProductividad: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const idDetalle = `detalle-prioridad-${orden}`;
  const esProfesionales = p.tipo === "profesionales";
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold leading-6 text-center">
          {orden}
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <InsigniaNovedad novedad={p.novedad} />
            {p.novedad !== "nuevo" && p.citas_anterior !== null && (
              <span className="text-[11px] text-gray-400">antes {fmtNumero(p.citas_anterior)} citas</span>
            )}
          </div>
          <p className="text-sm font-semibold text-brand-navy break-words">{p.titular}</p>
          <p className="text-sm text-gray-700">
            <span className="font-semibold tabular-nums">≈ {fmtNumero(p.citas)} citas {p.referencia}</span>
            {p.profesionales !== null && (
              <>
                <span className="text-gray-300"> · </span>
                <span className="tabular-nums">≈ {fmtProfesionales(p.profesionales)} profesionales equivalentes</span>
              </>
            )}
          </p>
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-600">Qué revisar: </span>
            <span>{p.revisar}</span>
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-0.5">
            {veProductividad && (
              <Link href={p.enlace} className="text-xs font-semibold text-brand-navy underline">
                Ver en Productividad
              </Link>
            )}
            {p.detalle.length > 0 && (
              <button
                type="button"
                aria-expanded={abierta}
                aria-controls={idDetalle}
                onClick={() => setAbierta((v) => !v)}
                className="text-xs font-semibold text-gray-500 hover:text-brand-navy"
              >
                {abierta ? "Ocultar detalle" : `Ver detalle (${p.detalle.length})`}
              </button>
            )}
          </div>
          {abierta && (
            <ul id={idDetalle} aria-label={`Detalle: ${p.titular}`} className="mt-1 rounded-lg bg-gray-50 px-3 py-2 space-y-1">
              {p.detalle.map((d) => (
                <li key={d.enlace} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                  <span className="text-brand-navy font-medium">{d.nombre}</span>
                  <span className="text-gray-500 tabular-nums">{d.texto}</span>
                  {veProductividad && (
                    <Link
                      href={d.enlace}
                      aria-label={esProfesionales ? `Ver ficha de ${d.nombre}` : `Ver ${d.nombre} en Productividad`}
                      className="font-semibold text-brand-navy underline"
                    >
                      {esProfesionales ? "Ver ficha" : "Ver en Productividad"}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

/** Prioridades del periodo (máximo 5): alertas consolidadas y medidas en citas perdidas. */
export function PanelPrioridades({
  prioridades,
  impactoMinimo,
  veProductividad,
}: {
  prioridades: readonly Prioridad[];
  impactoMinimo: number;
  veProductividad: boolean;
}) {
  return (
    <section aria-labelledby="titulo-prioridades" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="mb-3">
        <h2 id="titulo-prioridades" className="text-base font-semibold text-brand-navy">
          Prioridades
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Alertas agrupadas por área. La inasistencia se mide en citas por encima de la meta institucional; la
          disponibilidad, en citas sin asignar por encima del umbral de su regla.
        </p>
      </div>
      {prioridades.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm font-semibold text-emerald-700">Sin prioridades: nada supera el impacto mínimo este periodo</p>
          <p className="text-xs text-gray-500 mt-1">Impacto mínimo: {fmtNumero(impactoMinimo)} citas.</p>
        </div>
      ) : (
        <ul aria-label="Prioridades" className="divide-y divide-gray-100">
          {prioridades.map((p, i) => (
            <TarjetaPrioridad key={p.id} p={p} orden={i + 1} veProductividad={veProductividad} />
          ))}
        </ul>
      )}
    </section>
  );
}
