import { useId } from "react";
import { GRANULARIDADES, type Granularidad } from "@/lib/productividad/periodos";
import type { PeriodoCarga } from "@/lib/productividad/tipos";

const ETIQUETA_GRANULARIDAD: Record<Granularidad, string> = { mensual: "Mensual", semanal: "Semanal" };

/** Granularidad y carga de citas (mismo patrón que los segmentadores de Productividad). */
export function SelectorPeriodo({
  granularidad,
  periodo,
  periodos,
  onGranularidad,
  onPeriodo,
}: {
  granularidad: Granularidad;
  periodo: string | null;
  periodos: Record<Granularidad, PeriodoCarga[]>;
  onGranularidad: (g: Granularidad) => void;
  onPeriodo: (clave: string) => void;
}) {
  const id = useId();
  const lista = periodos[granularidad];
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div role="group" aria-label="Granularidad" className="inline-flex rounded-lg bg-gray-100 p-0.5">
        {GRANULARIDADES.map((g) => {
          const activo = g === granularidad;
          return (
            <button
              key={g}
              type="button"
              aria-pressed={activo}
              disabled={g === "semanal" && periodos.semanal.length === 0}
              onClick={() => !activo && onGranularidad(g)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors disabled:opacity-40 ${
                activo ? "bg-white text-brand-navy shadow-sm" : "text-gray-500 hover:text-brand-navy"
              }`}
            >
              {ETIQUETA_GRANULARIDAD[g]}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col">
        <label htmlFor={`${id}-periodo`} className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {granularidad === "mensual" ? "Mes" : "Semana"}
        </label>
        <select
          id={`${id}-periodo`}
          value={periodo ?? ""}
          onChange={(e) => onPeriodo(e.target.value)}
          disabled={lista.length === 0}
          className="mt-0.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-brand-navy"
        >
          {lista.length === 0 && <option value="">Sin cargas</option>}
          {[...lista].reverse().map((p) => (
            <option key={p.clave} value={p.clave}>
              {p.etiqueta_larga}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
