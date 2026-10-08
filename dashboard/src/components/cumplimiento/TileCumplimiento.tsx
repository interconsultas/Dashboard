import {
  ETIQUETA_ESTADO,
  estadoMeta,
  fmtPct,
  type EstadoMeta,
} from "@/lib/cumplimiento/presentacion";
import { IconDentroMeta, IconSobreMeta } from "./PorcentajeMeta";

interface Props {
  etiqueta: string;
  /** Fracción de la meta (1.0 = 100%); null = sin datos. */
  valor: number | null;
  /** Tile principal: fondo de marca y cifra más grande. */
  destacado?: boolean;
  nota?: string;
  testId?: string;
}

const CHIP: Record<EstadoMeta, string> = {
  sobre: "bg-red-50 text-red-600",
  dentro: "bg-emerald-50 text-emerald-600",
  sin_datos: "bg-gray-100 text-gray-500",
};

const CHIP_DESTACADO: Record<EstadoMeta, string> = {
  sobre: "bg-red-500 text-white",
  dentro: "bg-brand-green text-white",
  sin_datos: "bg-white/15 text-white/70",
};

/** Indicador de cumplimiento: etiqueta, porcentaje y estado frente a la meta (ícono + texto). */
export function TileCumplimiento({ etiqueta, valor, destacado = false, nota, testId }: Props) {
  const estado = estadoMeta(valor);

  return (
    <div
      data-testid={testId}
      className={`rounded-2xl border shadow-sm animate-fade-slide-up print:shadow-none print:break-inside-avoid ${
        destacado
          ? "bg-brand-navy border-brand-navy text-white p-6 flex flex-col justify-center"
          : "bg-white border-gray-100 p-4 print:border-gray-300"
      }`}
    >
      <p
        className={`font-semibold uppercase tracking-wider ${
          destacado ? "text-xs text-white/70 mb-2" : "text-[11px] text-gray-500 mb-1.5"
        }`}
      >
        {etiqueta}
      </p>
      <p
        title={estado === "sin_datos" ? ETIQUETA_ESTADO.sin_datos : undefined}
        className={`font-extrabold leading-none ${
          destacado
            ? "text-5xl sm:text-6xl text-white"
            : `text-2xl ${estado === "sin_datos" ? "text-gray-400" : "text-brand-navy"}`
        }`}
      >
        {fmtPct(valor)}
      </p>
      <div className={`flex flex-wrap items-center gap-2 ${destacado ? "mt-4" : "mt-2.5"}`}>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            (destacado ? CHIP_DESTACADO : CHIP)[estado]
          }`}
        >
          {estado === "sobre" && <IconSobreMeta className="w-3 h-3" />}
          {estado === "dentro" && <IconDentroMeta className="w-3 h-3" />}
          {ETIQUETA_ESTADO[estado]}
        </span>
        {nota && (
          <span className={`text-xs ${destacado ? "text-white/70" : "text-gray-500"}`}>{nota}</span>
        )}
      </div>
    </div>
  );
}
