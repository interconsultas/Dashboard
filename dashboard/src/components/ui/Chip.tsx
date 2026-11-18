import { cx } from "./clases";

/**
 * Píldora informativa (filtro activo, periodo…). Con `onQuitar` muestra una
 * × accesible ("Quitar <texto>" o `etiquetaQuitar`).
 */
export function Chip({
  children,
  onQuitar,
  etiquetaQuitar,
  className,
}: {
  children: React.ReactNode;
  onQuitar?: () => void;
  etiquetaQuitar?: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full bg-primario-suave text-primario px-2.5 py-1 text-xs font-bold max-w-full",
        className
      )}
    >
      <span className="truncate">{children}</span>
      {onQuitar && (
        <button
          type="button"
          onClick={onQuitar}
          aria-label={etiquetaQuitar ?? `Quitar ${typeof children === "string" ? children : "filtro"}`}
          className="shrink-0 text-[15px] leading-none text-primario/70 hover:text-primario"
        >
          ×
        </button>
      )}
    </span>
  );
}
