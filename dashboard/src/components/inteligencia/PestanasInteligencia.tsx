/** Pestañas de la sección: hoy solo el mapa; Simulador y Alertas llegan en los siguientes pasos. */
const PESTANAS = [
  { clave: "mapa", etiqueta: "Mapa de relaciones", disponible: true },
  { clave: "simulador", etiqueta: "Simulador", disponible: false },
  { clave: "alertas", etiqueta: "Alertas", disponible: false },
] as const;

export function PestanasInteligencia() {
  return (
    <div role="tablist" aria-label="Herramientas de Inteligencia" className="flex flex-wrap gap-1 border-b border-gray-200">
      {PESTANAS.map((p) => {
        const activa = p.clave === "mapa";
        return (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={activa}
            disabled={!p.disponible}
            className={`-mb-px px-3 sm:px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activa
                ? "border-brand-green text-brand-navy"
                : "border-transparent text-gray-400 cursor-not-allowed"
            }`}
          >
            {p.etiqueta}
            {!p.disponible && (
              <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                Próximamente
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
