import { forwardRef, useId } from "react";
import { CLASES_CAMPO, CLASES_ETIQUETA_CAMPO, cx } from "./clases";

/** <select> con el estilo de la app. */
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...resto },
  ref
) {
  return <select ref={ref} className={cx(CLASES_CAMPO, "appearance-none min-w-[150px]", className)} {...resto} />;
});

/** <input> con el estilo de la app. */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...resto },
  ref
) {
  return <input ref={ref} className={cx(CLASES_CAMPO, className)} {...resto} />;
});

/**
 * Etiqueta + control de un filtro. `children` recibe el id para enlazar la
 * etiqueta: <Campo etiqueta="Mes">{(id) => <Select id={id} …/>}</Campo>
 */
export function Campo({
  etiqueta,
  children,
  className,
}: {
  etiqueta: string;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx("flex flex-col", className)}>
      <label htmlFor={id} className={CLASES_ETIQUETA_CAMPO}>
        {etiqueta}
      </label>
      {children(id)}
    </div>
  );
}
