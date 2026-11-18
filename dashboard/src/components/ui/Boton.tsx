import { forwardRef } from "react";
import { cx } from "./clases";

export type VarianteBoton = "primario" | "secundario" | "fantasma" | "peligro";
export type TamanoBoton = "sm" | "md";

const VARIANTES: Record<VarianteBoton, string> = {
  primario: "bg-primario text-white border-transparent hover:bg-primario-oscuro",
  secundario: "bg-superficie text-primario border-borde hover:bg-primario-suave",
  fantasma: "bg-transparent text-primario border-transparent hover:bg-primario-suave",
  // Acciones destructivas (eliminar, cancelar una carga…)
  peligro: "bg-critico text-white border-transparent hover:bg-critico/90",
};

const TAMANOS: Record<TamanoBoton, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
};

/** Clases del botón, para aplicarlas a un <Link> o <a> con el mismo aspecto. */
export function clasesBoton({ variante = "primario", tamano = "md" }: { variante?: VarianteBoton; tamano?: TamanoBoton } = {}) {
  return cx(
    "inline-flex items-center justify-center rounded-control border font-bold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40 focus-visible:ring-offset-1",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    VARIANTES[variante],
    TAMANOS[tamano]
  );
}

/** Botón de la app: `variante` primario | secundario | fantasma | peligro, `tamano` sm | md. type="button" por defecto. */
export const Boton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton; tamano?: TamanoBoton }
>(function Boton({ variante = "primario", tamano = "md", className, type = "button", ...resto }, ref) {
  return <button ref={ref} type={type} className={cx(clasesBoton({ variante, tamano }), className)} {...resto} />;
});
