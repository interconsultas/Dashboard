import { cx } from "./clases";

/**
 * Tarjeta base (superficie blanca, radio 20, sombra suave).
 *
 * - `titulo` (Sora) y `ayuda` opcionales; `acciones` va a la derecha del título.
 * - `sinRelleno` quita el padding del cuerpo (tablas a sangre).
 * - `as` permite usar `div` cuando no es una sección con título.
 */
export function Tarjeta({
  titulo,
  ayuda,
  acciones,
  children,
  className,
  sinRelleno = false,
  as: Etiqueta = "section",
  ...resto
}: {
  titulo?: React.ReactNode;
  ayuda?: React.ReactNode;
  acciones?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  sinRelleno?: boolean;
  as?: "section" | "div" | "article";
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  const conCabecera = titulo || acciones;
  return (
    <Etiqueta
      className={cx("bg-superficie border border-borde rounded-tarjeta shadow-tarjeta min-w-0 overflow-hidden flex flex-col", className)}
      {...resto}
    >
      {conCabecera && (
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4">
          <div className="min-w-0">
            {titulo && <h2 className="font-titulo text-[15px] font-bold text-tinta">{titulo}</h2>}
            {ayuda && <p className="text-xs text-tinta-3 mt-0.5">{ayuda}</p>}
          </div>
          {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
        </div>
      )}
      <div className={cx("flex-1 min-w-0 flex flex-col", !sinRelleno && (conCabecera ? "px-4 sm:px-5 pt-3 pb-4" : "p-4 sm:p-5"))}>
        {children}
      </div>
    </Etiqueta>
  );
}
