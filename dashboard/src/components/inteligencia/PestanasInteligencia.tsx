import { EncabezadoPagina } from "@/components/layout/EncabezadoPagina";
import type { Pestana } from "@/lib/inteligencia/parametros";

/** Pestañas de la sección (`disponible` permite anunciar una pestaña futura). */
const PESTANAS: readonly { clave: Pestana; etiqueta: string; disponible: boolean }[] = [
  { clave: "mapa", etiqueta: "Mapa de relaciones", disponible: true },
  { clave: "simulador", etiqueta: "Simulador", disponible: true },
  { clave: "alertas", etiqueta: "Alertas", disponible: true },
];

const SUBTITULO: Record<Pestana, string> = {
  mapa: "Cómo se relacionan servicios, profesionales, programas de metas y autorizaciones",
  simulador: "¿Qué pasa si…? Mueva las palancas de la agenda y compare con lo que pasó en el periodo",
  alertas: "Reglas que vigilan la agenda en el último periodo cargado y proyección del siguiente",
};

export function PestanasInteligencia({ activa, onCambiar }: { activa: Pestana; onCambiar: (p: Pestana) => void }) {
  return (
    <div role="tablist" aria-label="Herramientas de Inteligencia" className="flex flex-wrap gap-1">
      {PESTANAS.map((p) => {
        const seleccionada = p.clave === activa;
        return (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={seleccionada}
            disabled={!p.disponible}
            onClick={() => p.disponible && !seleccionada && onCambiar(p.clave)}
            className={`px-3 sm:px-3.5 py-2 rounded-control text-sm font-semibold transition-colors ${
              seleccionada
                ? "bg-primario text-white"
                : p.disponible
                  ? "text-tinta-2 hover:bg-primario-suave hover:text-primario"
                  : "text-tinta-3 cursor-not-allowed"
            }`}
          >
            {p.etiqueta}
            {!p.disponible && (
              <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wide bg-superficie-2 text-tinta-3 rounded px-1.5 py-0.5">
                Próximamente
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const MIGAS = [{ etiqueta: "Análisis" }, { etiqueta: "Inteligencia" }] as const;

/**
 * Cabecera de la sección (EncabezadoPagina con degradado) y, debajo, una
 * barra con las pestañas a la izquierda y los controles de la pestaña
 * (periodo, filtros) a la derecha.
 */
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
      <EncabezadoPagina migas={MIGAS} titulo="Inteligencia" subtitulo={SUBTITULO[pestana]} />
      <div className="bg-superficie border border-borde rounded-tarjeta shadow-tarjeta px-3 sm:px-4 py-3 flex flex-wrap items-end justify-between gap-3">
        <PestanasInteligencia activa={pestana} onCambiar={onPestana} />
        <div className="flex flex-wrap items-end gap-3">{children}</div>
      </div>
    </div>
  );
}
