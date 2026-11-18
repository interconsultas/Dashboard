import type { Pestana } from "@/lib/inteligencia/parametros";

/** Pestañas de la sección; Alertas llega en un paso siguiente. */
const PESTANAS: readonly { clave: Pestana | "alertas"; etiqueta: string; disponible: boolean }[] = [
  { clave: "mapa", etiqueta: "Mapa de relaciones", disponible: true },
  { clave: "simulador", etiqueta: "Simulador", disponible: true },
  { clave: "alertas", etiqueta: "Alertas", disponible: false },
];

export function PestanasInteligencia({ activa, onCambiar }: { activa: Pestana; onCambiar: (p: Pestana) => void }) {
  return (
    <div role="tablist" aria-label="Herramientas de Inteligencia" className="flex flex-wrap gap-1 border-b border-gray-200">
      {PESTANAS.map((p) => {
        const seleccionada = p.clave === activa;
        return (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={seleccionada}
            disabled={!p.disponible}
            onClick={() => p.disponible && !seleccionada && onCambiar(p.clave as Pestana)}
            className={`-mb-px px-3 sm:px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              seleccionada
                ? "border-brand-green text-brand-navy"
                : p.disponible
                  ? "border-transparent text-gray-500 hover:text-brand-navy"
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

/** Título de la sección, controles de la pestaña (periodo, filtros) y pestañas. */
export function EncabezadoInteligencia({
  pestana,
  onPestana,
  children,
}: {
  pestana: Pestana;
  onPestana: (p: Pestana) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-brand-navy">Inteligencia</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pestana === "simulador"
              ? "¿Qué pasa si…? Mueva las palancas de la agenda y compare con lo que pasó en el periodo"
              : "Cómo se relacionan servicios, profesionales, programas de metas y autorizaciones"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">{children}</div>
      </div>
      <PestanasInteligencia activa={pestana} onCambiar={onPestana} />
    </div>
  );
}
