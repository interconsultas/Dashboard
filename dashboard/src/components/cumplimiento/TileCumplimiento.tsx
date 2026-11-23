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
  sobre: "bg-critico-suave text-critico",
  dentro: "bg-bien-suave text-bien",
  sin_datos: "bg-fondo text-tinta-3",
};

const CHIP_DESTACADO: Record<EstadoMeta, string> = {
  sobre: "bg-critico text-white",
  // Lima solo como relleno: el texto encima va oscuro (nunca blanco)
  dentro: "bg-acento-lima text-menu-activo-tinta",
  sin_datos: "bg-white/15 text-white/85",
};

/** Indicador de cumplimiento: etiqueta, porcentaje y estado frente a la meta (ícono + texto). */
export function TileCumplimiento({ etiqueta, valor, destacado = false, nota, testId }: Props) {
  const estado = estadoMeta(valor);

  return (
    <div
      data-testid={testId}
      className={`rounded-tarjeta border shadow-tarjeta animate-fade-slide-up ${
        destacado
          ? "bg-cabecera border-transparent text-white p-6 flex flex-col justify-center"
          : "bg-superficie border-borde p-4"
      }`}
    >
      <p
        className={`font-bold uppercase tracking-[0.06em] ${
          destacado ? "text-xs text-white/85 mb-2" : "text-[11px] text-tinta-3 mb-1.5"
        }`}
      >
        {etiqueta}
      </p>
      <p
        title={estado === "sin_datos" ? ETIQUETA_ESTADO.sin_datos : undefined}
        className={`font-titulo font-extrabold tracking-tight tabular-nums leading-none ${
          destacado
            ? "text-5xl sm:text-6xl text-white"
            : `text-2xl ${estado === "sin_datos" ? "text-tinta-3" : "text-primario"}`
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
          <span className={`text-xs ${destacado ? "text-white/85" : "text-tinta-3"}`}>{nota}</span>
        )}
      </div>
    </div>
  );
}
