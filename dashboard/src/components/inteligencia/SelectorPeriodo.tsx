import { useId } from "react";
import { GRANULARIDADES, type Granularidad } from "@/lib/productividad/periodos";
import type { PeriodoCarga } from "@/lib/productividad/tipos";
import { CLASES_CAMPO, CLASES_ETIQUETA_CAMPO } from "@/components/ui/clases";
import { Segmentado } from "@/components/ui/Segmentado";

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
      <Segmentado
        etiqueta="Granularidad"
        valor={granularidad}
        onCambiar={onGranularidad}
        opciones={GRANULARIDADES.map((g) => ({
          valor: g,
          etiqueta: ETIQUETA_GRANULARIDAD[g],
          deshabilitada: g === "semanal" && periodos.semanal.length === 0,
        }))}
      />
      <div className="flex flex-col">
        <label htmlFor={`${id}-periodo`} className={CLASES_ETIQUETA_CAMPO}>
          {granularidad === "mensual" ? "Mes" : "Semana"}
        </label>
        <select
          id={`${id}-periodo`}
          value={periodo ?? ""}
          onChange={(e) => onPeriodo(e.target.value)}
          disabled={lista.length === 0}
          className={CLASES_CAMPO}
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
