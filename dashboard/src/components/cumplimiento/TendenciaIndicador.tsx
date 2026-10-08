"use client";

import { useMemo } from "react";
import { useModoImpresion } from "@/hooks/useImpresion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { puntosGrafica, type PuntoGrafica, type ValorPeriodo } from "@/lib/cumplimiento/presentacion";
import { PorcentajeMeta } from "./PorcentajeMeta";
import { TablaEquivalente, techoEje } from "./GraficaGlobalMensual";

const NAVY = "#1e3a5f";
const GREEN = "#4EA234";
const GRAY = "#6b7280";

interface Props {
  etiqueta: string;
  /** Porcentaje real del indicador por periodo (fracción de la meta; null = sin datos). */
  serie: ValorPeriodo[];
}

/** Leyenda compartida por la grilla de tendencias: línea real frente a la meta fija del 100%. */
export function LeyendaTendencia() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-5 border-t-2" style={{ borderColor: NAVY }} />
        % real
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: GREEN }} />
        Meta 100%
      </span>
    </p>
  );
}

/** Gráfica pequeña de un indicador: porcentaje real por mes frente a una línea fija en 100%. */
export function TendenciaIndicador({ etiqueta, serie }: Props) {
  const puntos = useMemo(() => puntosGrafica(serie), [serie]);
  const imprimiendo = useModoImpresion();
  const conDato = puntos.filter((p) => p.pct !== null);
  const ultimo = conDato[conDato.length - 1];
  const valorUltimo = ultimo ? serie.find((s) => s.periodo === ultimo.periodo)?.valor ?? null : null;

  return (
    <div data-testid="tendencia-indicador" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2 print:shadow-none print:border-gray-300 print:break-inside-avoid">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{etiqueta}</p>
        {ultimo && (
          <p data-testid="ultimo-valor" className="text-right text-sm leading-tight">
            <PorcentajeMeta valor={valorUltimo} />
            <span className="block text-[10px] text-gray-500">{ultimo.etiquetaLarga}</span>
          </p>
        )}
      </div>

      {!ultimo ? (
        <p className="h-32 flex items-center justify-center text-sm text-gray-500">Sin datos</p>
      ) : (
        <>
          <div className="h-32" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={puntos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="etiqueta"
                  tick={{ fontSize: 10, fill: GRAY }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: GRAY }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                  domain={[0, techoEje]}
                  tickCount={4}
                  width={42}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(_value: any, _name: any, item: any) => [
                    (item?.payload as PuntoGrafica | undefined)?.texto ?? "—",
                    "% real",
                  ]}
                  labelFormatter={(_l, payload) => {
                    const item = payload?.[0]?.payload as PuntoGrafica | undefined;
                    return item?.etiquetaLarga ?? _l;
                  }}
                />
                <ReferenceLine y={100} stroke={GREEN} strokeWidth={2} strokeDasharray="6 3" />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke={NAVY}
                  strokeWidth={2}
                  dot={{ r: 4, fill: NAVY, stroke: "#fff", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: NAVY, stroke: "#fff", strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={!imprimiendo}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <TablaEquivalente titulo={etiqueta} puntos={puntos} />
        </>
      )}
    </div>
  );
}
