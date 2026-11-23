import { cx } from "./clases";

export type TonoEstado = "bien" | "atencion" | "critico" | "neutral";

const CLASES: Record<TonoEstado, string> = {
  bien: "bg-bien-suave text-bien",
  atencion: "bg-atencion-suave text-atencion",
  critico: "bg-critico-suave text-critico",
  neutral: "bg-primario-suave text-primario",
};

const ICONO: Record<TonoEstado, string> = { bien: "✓", atencion: "▲", critico: "●", neutral: "•" };

/**
 * Etiqueta de estado (píldora): ícono + texto, nunca solo color.
 * `icono` reemplaza el símbolo por defecto (✓ ▲ ● •); `icono={null}` lo oculta.
 */
export function Estado({
  tono = "neutral",
  icono,
  children,
  className,
}: {
  tono?: TonoEstado;
  icono?: React.ReactNode | null;
  children: React.ReactNode;
  className?: string;
}) {
  const simbolo = icono === undefined ? ICONO[tono] : icono;
  return (
    <span
      data-tono={tono}
      className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold whitespace-nowrap", CLASES[tono], className)}
    >
      {simbolo !== null && <span aria-hidden>{simbolo}</span>}
      {children}
    </span>
  );
}
