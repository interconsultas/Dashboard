import { ETIQUETA_ESTADO, SIN_DATOS, estadoMeta, fmtPct } from "@/lib/cumplimiento/presentacion";

/** Flecha hacia arriba: acompaña a los valores que superan la meta (no depende solo del color). */
export function IconSobreMeta({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

export function IconDentroMeta({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * Porcentaje de cumplimiento para celdas de tabla.
 * Sobre la meta: flecha + color; dentro de la meta: solo el valor; sin dato: raya.
 */
export function PorcentajeMeta({ valor, className = "" }: { valor: number | null; className?: string }) {
  const estado = estadoMeta(valor);

  if (estado === "sin_datos") {
    return (
      <span title={ETIQUETA_ESTADO.sin_datos} className={`text-gray-400 `}>
        {SIN_DATOS}
      </span>
    );
  }

  if (estado === "sobre") {
    return (
      <span
        title={ETIQUETA_ESTADO.sobre}
        className={`inline-flex items-center gap-0.5 font-semibold text-red-600 tabular-nums ${className}`}
      >
        <IconSobreMeta className="w-3 h-3 flex-shrink-0" />
        {fmtPct(valor)}
        <span className="sr-only"> sobre la meta</span>
      </span>
    );
  }

  return (
    <span title={ETIQUETA_ESTADO.dentro} className={`text-gray-700 tabular-nums ${className}`}>
      {fmtPct(valor)}
      <span className="sr-only"> dentro de la meta</span>
    </span>
  );
}
