"use client";

import { useMemo } from "react";
import { opcionesSparkline } from "@/lib/productividad/graficas";
import { META_INASISTENCIA, variacion, type Indicadores } from "@/lib/productividad/metricas";
import { fmtNumero, fmtPct, fmtVariacion } from "@/lib/productividad/presentacion";
import type { RespuestaProductividad } from "@/lib/productividad/tipos";
import { TarjetaKpi, type TonoKpi } from "@/components/ui/TarjetaKpi";
import type { TonoEstado } from "@/components/ui/Estado";
import { Grafico } from "./Grafico";

interface Props {
  kpis: RespuestaProductividad["kpis"];
  profesionales: RespuestaProductividad["profesionales"];
  /** Etiqueta del periodo anterior ("Sep 2026"), para "vs …". */
  etiquetaAnterior: string | null;
}

type Sentido = "neutral" | "subir_es_malo";

interface Delta {
  valor: number;
  tipo: "relativa" | "puntos";
  sentido: Sentido;
}

interface Tile {
  titulo: string;
  valor: string;
  icono: React.ReactNode;
  tono?: TonoKpi;
  estado?: { tono: TonoEstado; texto: string };
  detalle?: React.ReactNode;
  delta?: Delta | null;
  serie?: { valores: (number | null)[]; fmt: (v: number) => string };
}

/* ── Subcomponents ───────────────────────────────── */

function TextoDelta({ delta, etiquetaAnterior }: { delta: Delta; etiquetaAnterior: string | null }) {
  const color =
    delta.sentido === "neutral" || delta.valor === 0
      ? "text-tinta-2"
      : delta.valor > 0
        ? "text-critico"
        : "text-bien";
  return (
    <>
      <span className={`font-semibold ${color}`}>{fmtVariacion(delta.valor, delta.tipo)}</span>
      {etiquetaAnterior && <span> vs {etiquetaAnterior}</span>}
    </>
  );
}

/** Estado frente a la meta de inasistencia (ícono + texto, no solo color). */
function estadoMeta(pct: number | null): Tile["estado"] {
  if (pct === null) return undefined;
  return pct < META_INASISTENCIA ? { tono: "bien", texto: "Meta" } : { tono: "atencion", texto: "Sobre meta" };
}

/* Íconos de los indicadores (trazo, 24×24) */
const trazo = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICONOS = {
  calendario: <svg {...trazo}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  check: <svg {...trazo}><path d="M20 6L9 17l-5-5" /></svg>,
  ausente: <svg {...trazo}><circle cx="12" cy="12" r="9" /><path d="M8 8l8 8" /></svg>,
  libre: <svg {...trazo}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M9 15h6" /></svg>,
  perdidas: <svg {...trazo}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  personas: <svg {...trazo}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></svg>,
};

function Sparkline({ titulo, valores, etiquetas, fmt }: { titulo: string; valores: (number | null)[]; etiquetas: string[]; fmt: (v: number) => string }) {
  const opcion = useMemo(() => opcionesSparkline(valores, etiquetas, fmt), [valores, etiquetas, fmt]);
  return <Grafico opcion={opcion} etiqueta={`Evolución de ${titulo}`} className="h-[38px] -mx-1.5" />;
}

/* ── Component ──────────────────────────────────── */

export function TarjetasKpi({ kpis, profesionales, etiquetaAnterior }: Props) {
  const actual = kpis.actual;
  const anterior = kpis.anterior;
  const etiquetas = kpis.serie.map((p) => p.etiqueta);

  if (!actual) return null;

  const delta = (
    sel: (i: Indicadores) => number | null,
    tipo: Delta["tipo"],
    sentido: Sentido
  ): Delta | null => {
    if (!anterior) return null;
    const valor = variacion(sel(actual), sel(anterior), tipo);
    return valor === null ? null : { valor, tipo, sentido };
  };
  const serie = (sel: (i: Indicadores) => number | null, fmt: (v: number) => string) => ({
    valores: kpis.serie.map(sel),
    fmt,
  });
  const fmtPctSerie = (v: number) => fmtPct(v);

  const tiles: Tile[] = [
    {
      titulo: "Citas ofertadas",
      icono: ICONOS.calendario,
      valor: fmtNumero(actual.ofertadas),
      delta: delta((i) => i.ofertadas, "relativa", "neutral"),
      serie: serie((i) => i.ofertadas, fmtNumero),
    },
    {
      titulo: "Citas asignadas",
      icono: ICONOS.check,
      valor: fmtNumero(actual.asignadas),
      detalle: `${fmtPct(actual.ofertadas > 0 ? actual.asignadas / actual.ofertadas : null)} de lo ofertado`,
      serie: serie((i) => i.asignadas, fmtNumero),
    },
    {
      titulo: "% Inasistencia",
      valor: fmtPct(actual.pct_inasistencia),
      icono: ICONOS.ausente,
      tono: "critico",
      estado: estadoMeta(actual.pct_inasistencia),
      delta: delta((i) => i.pct_inasistencia, "puntos", "subir_es_malo"),
      serie: serie((i) => i.pct_inasistencia, fmtPctSerie),
    },
    {
      titulo: "% Disponibilidad",
      icono: ICONOS.libre,
      tono: "atencion",
      valor: fmtPct(actual.pct_disponibilidad),
      delta: delta((i) => i.pct_disponibilidad, "puntos", "subir_es_malo"),
      serie: serie((i) => i.pct_disponibilidad, fmtPctSerie),
    },
    {
      titulo: "Citas perdidas",
      icono: ICONOS.perdidas,
      tono: "critico",
      valor: fmtNumero(actual.perdidas),
      detalle: anterior ? undefined : "Inasistidas + disponibles",
      delta: delta((i) => i.perdidas, "relativa", "subir_es_malo"),
      serie: serie((i) => i.perdidas, fmtNumero),
    },
    {
      titulo: "Profesionales con agenda",
      icono: ICONOS.personas,
      tono: "acento",
      valor: fmtNumero(profesionales.con_agenda),
      detalle: (
        <span title={`Con 50 o más citas asignadas e inasistencia menor al ${META_INASISTENCIA * 100} %`}>
          {fmtNumero(profesionales.destacados)} con inasistencia &lt; {META_INASISTENCIA * 100} %
        </span>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {tiles.map((t) => (
        <TarjetaKpi
          key={t.titulo}
          etiqueta={t.titulo}
          valor={t.valor}
          icono={t.icono}
          tono={t.tono}
          estado={t.estado}
          detalle={
            <>
              {t.detalle}
              {t.delta && <TextoDelta delta={t.delta} etiquetaAnterior={etiquetaAnterior} />}
            </>
          }
        >
          {t.serie ? (
            <Sparkline titulo={t.titulo} valores={t.serie.valores} etiquetas={etiquetas} fmt={t.serie.fmt} />
          ) : (
            <div className="h-[38px]" />
          )}
        </TarjetaKpi>
      ))}
    </div>
  );
}
