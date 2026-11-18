"use client";

import { useMemo } from "react";
import { opcionesSparkline } from "@/lib/productividad/graficas";
import { META_INASISTENCIA, variacion, type Indicadores } from "@/lib/productividad/metricas";
import { fmtNumero, fmtPct, fmtVariacion } from "@/lib/productividad/presentacion";
import type { RespuestaProductividad } from "@/lib/productividad/tipos";
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
  detalle?: React.ReactNode;
  delta?: Delta | null;
  serie?: { valores: (number | null)[]; fmt: (v: number) => string };
}

/* ── Subcomponents ───────────────────────────────── */

function TextoDelta({ delta, etiquetaAnterior }: { delta: Delta; etiquetaAnterior: string | null }) {
  const color =
    delta.sentido === "neutral" || delta.valor === 0
      ? "text-gray-600"
      : delta.valor > 0
        ? "text-red-700"
        : "text-green-700";
  return (
    <>
      <span className={`font-semibold ${color}`}>{fmtVariacion(delta.valor, delta.tipo)}</span>
      {etiquetaAnterior && <span> vs {etiquetaAnterior}</span>}
    </>
  );
}

function InsigniaMeta({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const cumple = pct < META_INASISTENCIA;
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-px text-[11px] font-semibold mr-1 ${
        cumple ? "bg-[#EAF6E4] text-[#2F7A1F]" : "bg-[#FFF6E5] text-[#9A6200]"
      }`}
    >
      {cumple ? "✓ Meta" : "▲ Sobre meta"}
    </span>
  );
}

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
      valor: fmtNumero(actual.ofertadas),
      delta: delta((i) => i.ofertadas, "relativa", "neutral"),
      serie: serie((i) => i.ofertadas, fmtNumero),
    },
    {
      titulo: "Citas asignadas",
      valor: fmtNumero(actual.asignadas),
      detalle: `${fmtPct(actual.ofertadas > 0 ? actual.asignadas / actual.ofertadas : null)} de lo ofertado`,
      serie: serie((i) => i.asignadas, fmtNumero),
    },
    {
      titulo: "% Inasistencia",
      valor: fmtPct(actual.pct_inasistencia),
      detalle: <InsigniaMeta pct={actual.pct_inasistencia} />,
      delta: delta((i) => i.pct_inasistencia, "puntos", "subir_es_malo"),
      serie: serie((i) => i.pct_inasistencia, fmtPctSerie),
    },
    {
      titulo: "% Disponibilidad",
      valor: fmtPct(actual.pct_disponibilidad),
      delta: delta((i) => i.pct_disponibilidad, "puntos", "subir_es_malo"),
      serie: serie((i) => i.pct_disponibilidad, fmtPctSerie),
    },
    {
      titulo: "Citas perdidas",
      valor: fmtNumero(actual.perdidas),
      detalle: anterior ? undefined : "Inasistidas + disponibles",
      delta: delta((i) => i.perdidas, "relativa", "subir_es_malo"),
      serie: serie((i) => i.perdidas, fmtNumero),
    },
    {
      titulo: "Profesionales con agenda",
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
        <div
          key={t.titulo}
          role="group"
          aria-label={t.titulo}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3.5 pt-3 pb-1 min-w-0 flex flex-col"
        >
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t.titulo}</p>
          <p className="text-2xl font-bold text-[#0F2A4A] tabular-nums mt-1">{t.valor}</p>
          <p className="text-xs text-gray-500 min-h-[18px]">
            {t.detalle}
            {t.delta && <TextoDelta delta={t.delta} etiquetaAnterior={etiquetaAnterior} />}
          </p>
          {t.serie ? (
            <Sparkline titulo={t.titulo} valores={t.serie.valores} etiquetas={etiquetas} fmt={t.serie.fmt} />
          ) : (
            <div className="h-[38px]" />
          )}
        </div>
      ))}
    </div>
  );
}
