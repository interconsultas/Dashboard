import { cx } from "./clases";
import { Estado, type TonoEstado } from "./Estado";

export type TonoKpi = "primario" | "acento" | "bien" | "atencion" | "critico";

const TONO_ICONO: Record<TonoKpi, string> = {
  primario: "bg-primario-suave text-primario",
  acento: "bg-acento-suave text-bien",
  bien: "bg-bien-suave text-bien",
  atencion: "bg-atencion-suave text-atencion",
  critico: "bg-critico-suave text-critico",
};

/**
 * Indicador: ícono en mosaico + etiqueta, valor grande (Sora, cifras
 * tabulares), detalle y estado opcionales. `children` va al pie (p. ej. una
 * sparkline). Se anuncia como grupo con el nombre de la etiqueta.
 */
export function TarjetaKpi({
  etiqueta,
  valor,
  icono,
  tono = "primario",
  detalle,
  estado,
  children,
  className,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  icono?: React.ReactNode;
  tono?: TonoKpi;
  detalle?: React.ReactNode;
  estado?: { tono: TonoEstado; texto: React.ReactNode };
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={cx("bg-superficie border border-borde rounded-tarjeta shadow-tarjeta px-4 pt-3.5 pb-2 min-w-0 flex flex-col", className)}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icono && (
          <span aria-hidden className={cx("grid h-[34px] w-[34px] shrink-0 place-items-center rounded-control [&_svg]:h-[18px] [&_svg]:w-[18px]", TONO_ICONO[tono])}>
            {icono}
          </span>
        )}
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-3 leading-tight">{etiqueta}</p>
      </div>
      <p className="font-titulo text-[26px] font-extrabold tracking-tight text-tinta tabular-nums mt-2 leading-none">{valor}</p>
      {(detalle || estado) && (
        <p className="text-xs text-tinta-2 mt-1.5 min-h-[18px] flex flex-wrap items-center gap-1">
          {estado && <Estado tono={estado.tono}>{estado.texto}</Estado>}
          {detalle}
        </p>
      )}
      {children}
    </div>
  );
}
