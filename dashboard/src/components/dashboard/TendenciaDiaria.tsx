"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";

const NAVY = "#1e3a5f";
const GRAY = "#9ca3af";

export interface SerieDiariaPoint {
  /** null representa el bucket "Sin fecha" (COLUMNA_FECHA_DIARIA IS NULL o fuera del mes) */
  dia: string | null;
  total: number;
  valor_total: number;
}

interface Props {
  serieDiaria: SerieDiariaPoint[];
  loading?: boolean;
}

interface ChartPoint {
  label: string;
  total: number;
  tendencia: number;
}

export function diaLabel(dia: string): string {
  // Toma solo "YYYY-MM-DD" por si el valor viene con hora/timezone
  // (ej. "2026-09-01T00:00:00.000Z", que puede colarse si algún día
  // pg vuelve a parsear `date` como Date de JS en vez de string).
  const partes = dia.slice(0, 10).split("-");
  return String(Number(partes[2]));
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-CO");
}

/** Igual que TendenciaMensual.linearRegression — regresión lineal simple sobre la serie. */
function linearRegression(values: number[]) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += values[i]; sumXY += i * values[i]; sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLabel(props: any) {
  const x = props.x as number;
  const y = props.y as number;
  const value = props.value as number;
  const index = props.index as number;
  const total = props.viewBox?.total as number | undefined;
  if (value == null) return null;

  const isFirst = index === 0;
  const isLast = total != null && index === total - 1;
  const anchor = isFirst ? "start" : isLast ? "end" : "middle";
  const dx = isFirst ? 6 : isLast ? -6 : 0;

  return (
    <text x={x + dx} y={y - 10} textAnchor={anchor} fontSize={11} fontWeight={700} fill={NAVY}>
      {fmtNum(value)}
    </text>
  );
}

export default function TendenciaDiaria({ serieDiaria, loading }: Props) {
  const { chartData, sinFechaTotal, totalGeneral, variacionPct } = useMemo(() => {
    let sinFecha = 0;
    let total = 0;
    const dias: { total: number }[] = [];
    for (const p of serieDiaria) {
      total += p.total;
      if (p.dia == null) {
        sinFecha += p.total;
        continue;
      }
      dias.push({ total: p.total });
    }

    const values = dias.map((d) => d.total);
    const { slope, intercept } = linearRegression(values);

    const sorted = serieDiaria.filter((p) => p.dia != null) as { dia: string; total: number }[];
    const data: ChartPoint[] = sorted.map((p, i) => ({
      label: diaLabel(p.dia),
      total: p.total,
      tendencia: Math.round(intercept + slope * i),
    }));

    let vPct: number | null = null;
    if (values.length >= 2) {
      const first = values[0];
      const last = values[values.length - 1];
      vPct = first > 0 ? ((last - first) / first) * 100 : null;
    }

    return { chartData: data, sinFechaTotal: sinFecha, totalGeneral: total, variacionPct: vPct };
  }, [serieDiaria]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="h-80 bg-gray-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (serieDiaria.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
        <p className="text-sm text-gray-400">Sin datos para mostrar tendencia diaria</p>
      </div>
    );
  }

  const isPositive = variacionPct !== null && variacionPct <= 0;
  const absVar = variacionPct !== null ? Math.abs(variacionPct) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 animate-fade-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Tendencia diaria</p>
          <p className="text-[11px] text-gray-300 mt-0.5">Total del mes: {fmtNum(totalGeneral)}</p>
        </div>
        <div className="flex items-center gap-2">
          {sinFechaTotal > 0 && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
              Sin fecha: {fmtNum(sinFechaTotal)}
            </span>
          )}
          {absVar !== null && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold ${
                isPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={isPositive ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
                />
              </svg>
              {absVar.toFixed(1)}% variación
            </div>
          )}
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 25, right: 20, left: 0, bottom: 10 }}>
            <defs>
              <linearGradient id="gradDiaria" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={NAVY} stopOpacity={0.18} />
                <stop offset="100%" stopColor={NAVY} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: GRAY }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: GRAY }} axisLine={false} tickLine={false} width={50} tickFormatter={fmtNum} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                fmtNum(Number(value)),
                name === "tendencia" ? "Tendencia" : "Autorizaciones",
              ]}
            />

            <Area
              type="monotone"
              dataKey="total"
              stroke={NAVY}
              strokeWidth={2.5}
              fill="url(#gradDiaria)"
              dot={{ r: 3, fill: NAVY, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: NAVY, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive
              animationDuration={800}
            >
              <LabelList dataKey="total" content={(p) => renderLabel({ ...p, viewBox: { total: chartData.length } })} />
            </Area>

            <Line
              type="monotone"
              dataKey="tendencia"
              stroke={GRAY}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
              isAnimationActive
              animationDuration={1000}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
