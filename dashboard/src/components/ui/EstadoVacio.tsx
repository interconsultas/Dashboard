import { cx } from "./clases";

/**
 * Mensaje cuando no hay datos: título, descripción opcional y una acción
 * (botón o enlace). `compacto` lo ajusta para ir dentro de una tarjeta.
 */
export function EstadoVacio({
  titulo,
  descripcion,
  icono,
  accion,
  compacto = false,
  className,
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  icono?: React.ReactNode;
  accion?: React.ReactNode;
  compacto?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cx(
        "flex flex-col items-center justify-center text-center",
        compacto
          ? "bg-superficie-2 border border-dashed border-borde rounded-control p-5"
          : "bg-superficie border border-borde rounded-tarjeta shadow-tarjeta p-10",
        className
      )}
    >
      {icono && (
        <div aria-hidden className="mb-3 grid h-10 w-10 place-items-center rounded-control bg-primario-suave text-primario">
          {icono}
        </div>
      )}
      <p className={cx("font-semibold text-tinta", compacto ? "text-sm" : "text-base font-titulo")}>{titulo}</p>
      {descripcion && <p className="text-sm text-tinta-2 mt-1 max-w-prose">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
