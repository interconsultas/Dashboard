import { cx } from "./clases";

export interface OpcionSegmentado<T extends string> {
  valor: T;
  etiqueta: string;
  deshabilitada?: boolean;
  /** Ayuda al pasar el mouse (p. ej. por qué está deshabilitada). */
  titulo?: string;
}

/**
 * Control segmentado (p. ej. Mensual / Semanal): un grupo de botones con
 * aria-pressed. Elegir la opción ya activa no dispara `onCambiar`.
 */
export function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambiar,
  className,
}: {
  /** Nombre accesible del grupo. */
  etiqueta: string;
  opciones: readonly OpcionSegmentado<T>[];
  valor: T;
  onCambiar: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className={cx("inline-flex rounded-control border border-borde bg-superficie-2 p-[3px]", className)}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo}
            disabled={o.deshabilitada}
            title={o.titulo}
            onClick={() => !activo && onCambiar(o.valor)}
            className={cx(
              "px-3 py-1.5 rounded-[9px] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
              activo ? "bg-primario text-white" : "text-tinta-2 hover:text-primario"
            )}
          >
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
