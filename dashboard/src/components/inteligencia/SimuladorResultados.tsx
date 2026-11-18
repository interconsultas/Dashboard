import { useMemo } from "react";
import { Grafico } from "@/components/productividad/Grafico";
import { opcionesComparacion } from "@/lib/inteligencia/graficaSimulador";
import { compararEscenario, type Diferencia, type MetricaComparada, type ResultadoSimulador } from "@/lib/inteligencia/simulador";
import { META_INASISTENCIA } from "@/lib/productividad/metricas";
import { fmtNumero, fmtPct } from "@/lib/productividad/presentacion";

interface Props {
  base: ResultadoSimulador;
  escenario: ResultadoSimulador;
  resumen: string;
}

/** Si subir la métrica es bueno o malo para la IPS. */
const SUBIR_ES_BUENO: Record<MetricaComparada, boolean> = {
  ofertadas: true,
  asignadas: true,
  atendidas: true,
  inasistidas: false,
  disponibles: false,
  perdidas: false,
};

const TARJETAS: { clave: MetricaComparada; titulo: string }[] = [
  { clave: "ofertadas", titulo: "Ofertadas" },
  { clave: "asignadas", titulo: "Asignadas" },
  { clave: "atendidas", titulo: "Atendidas" },
  { clave: "inasistidas", titulo: "Inasistidas" },
  { clave: "disponibles", titulo: "Disponibles" },
  { clave: "perdidas", titulo: "Citas perdidas" },
];

const fmtDecimal = (v: number | null) => (v === null ? "—" : v.toLocaleString("es-CO", { maximumFractionDigits: 1 }));

/* ── Subcomponents ───────────────────────────────── */

function InsigniaDelta({ d, subirEsBueno }: { d: Diferencia; subirEsBueno: boolean }) {
  if (d.delta === 0) {
    return <span className="text-[11px] font-semibold text-tinta-3">= sin cambio</span>;
  }
  const bueno = d.delta > 0 === subirEsBueno;
  const pct = d.delta_pct === null ? "" : ` (${d.delta_pct > 0 ? "+" : "−"}${Math.abs(d.delta_pct * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %)`;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1 text-[11px]">
      <span
        data-sentido={bueno ? "bueno" : "malo"}
        className={`rounded-full px-1.5 py-px font-semibold ${bueno ? "bg-[#EAF6E4] text-[#2F7A1F]" : "bg-[#FDECEC] text-[#B42318]"}`}
      >
        {d.delta > 0 ? "▲" : "▼"} {fmtNumero(Math.abs(d.delta))}
        {pct}
      </span>
      <span className="text-tinta-3">({bueno ? "mejora" : "empeora"})</span>
    </span>
  );
}

function Tarjeta({ titulo, d, subirEsBueno, detalle }: { titulo: string; d: Diferencia; subirEsBueno: boolean; detalle?: React.ReactNode }) {
  return (
    <div role="group" aria-label={titulo} className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-tinta-3">{titulo}</p>
      <p className="mt-1 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-sm text-tinta-3">{fmtNumero(d.base)}</span>
        <span aria-label="pasaría a" className="text-tinta-3">→</span>
        <span className="text-lg font-bold text-brand-navy">{fmtNumero(d.escenario)}</span>
      </p>
      <div className="mt-1">
        <InsigniaDelta d={d} subirEsBueno={subirEsBueno} />
      </div>
      {detalle && <p className="mt-1 text-[11px] text-tinta-3">{detalle}</p>}
    </div>
  );
}

function EstadoMeta({ cumple }: { cumple: boolean | null }) {
  if (cumple === null) return <span className="text-tinta-3">Sin asignadas</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-px text-[11px] font-semibold ${
        cumple ? "bg-[#EAF6E4] text-[#2F7A1F]" : "bg-[#FFF6E5] text-[#9A6200]"
      }`}
    >
      {cumple ? "✓ En la meta" : "✕ Fuera de la meta"}
    </span>
  );
}

function TarjetaMeta({ base, escenario }: { base: ResultadoSimulador; escenario: ResultadoSimulador }) {
  const fila = (nombre: string, r: ResultadoSimulador) => (
    <div className="flex flex-wrap items-center justify-between gap-1">
      <span className="text-tinta-3">{nombre}</span>
      <span className="flex items-center gap-1.5 tabular-nums">
        <span className="font-semibold text-brand-navy">{fmtPct(r.pct_inasistencia)}</span>
        <EstadoMeta cumple={r.cumple_meta} />
      </span>
      {r.inasistencias_a_evitar > 0 && (
        <span className="w-full text-[11px] text-tinta-3">
          {fmtNumero(r.inasistencias_a_evitar)} inasistencias por evitar para llegar a la meta
        </span>
      )}
    </div>
  );
  return (
    <div role="group" aria-label="Meta de inasistencia" className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-3 text-xs space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-tinta-3">
        Meta de inasistencia ({META_INASISTENCIA * 100} %)
      </p>
      {fila("Actual", base)}
      {fila("Escenario", escenario)}
    </div>
  );
}

/* ── Component ──────────────────────────────────── */

/** Resultado del escenario frente a la realidad: tarjetas, gráfica y resumen. */
export function SimuladorResultados({ base, escenario, resumen }: Props) {
  const comparacion = useMemo(() => compararEscenario(base, escenario), [base, escenario]);
  const opcion = useMemo(() => opcionesComparacion(comparacion), [comparacion]);

  const detalle: Partial<Record<MetricaComparada, React.ReactNode>> = {
    inasistidas: `${fmtPct(base.pct_inasistencia)} → ${fmtPct(escenario.pct_inasistencia)} de las asignadas`,
    disponibles: `${fmtPct(base.pct_disponibilidad)} → ${fmtPct(escenario.pct_disponibilidad)} de las ofertadas`,
    perdidas: `${fmtDecimal(base.profesionales_equivalentes_perdidos)} → ${fmtDecimal(
      escenario.profesionales_equivalentes_perdidos
    )} profesionales equivalentes`,
  };

  return (
    <section aria-label="Resultado del escenario" className="space-y-3">
      <p role="status" className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-4 text-sm text-brand-navy">
        {resumen}
      </p>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {TARJETAS.map((t) => (
          <Tarjeta key={t.clave} titulo={t.titulo} d={comparacion[t.clave]} subirEsBueno={SUBIR_ES_BUENO[t.clave]} detalle={detalle[t.clave]} />
        ))}
        <div className="col-span-2">
          <TarjetaMeta base={base} escenario={escenario} />
        </div>
      </div>
      <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-3 sm:p-4">
        <h2 className="text-sm font-bold text-brand-navy">Actual vs escenario</h2>
        <p className="text-[11px] text-tinta-3">Citas en el periodo</p>
        <Grafico opcion={opcion} etiqueta="Actual vs escenario en el periodo" className="h-[260px] mt-2" />
      </div>
    </section>
  );
}
