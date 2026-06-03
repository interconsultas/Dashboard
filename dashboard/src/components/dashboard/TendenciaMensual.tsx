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
  Legend,
  LabelList,
} from "recharts";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const NAVY = "#1e3a5f";
const GREEN = "#4EA234";
const GRAY = "#9ca3af";
const RED = "#ef4444";

function periodoFull(p: number): string {
  return `${MESES[(p % 100) - 1]} ${Math.floor(p / 100)}`;
}

function periodoShort(p: number): string {
  return `${MESES[(p % 100) - 1]} ${String(Math.floor(p / 100)).slice(-2)}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-CO");
}

function compactNum(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString("es-CO")}K`;
  return fmtNum(n);
}

interface SerieMensual { periodo: number; total: number }

interface Props {
  serieActual: SerieMensual[];
  serieAnterior: SerieMensual[];
  loading?: boolean;
}

interface ChartPoint {
  fullLabel: string;
  label: string;
  actual: number;
  anterior: number | null;
  tendencia: number;
  variacionPct: number | null;
}

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

function VariationDot(props: Record<string, unknown>) {
  const cx = props.cx as number | undefined;
  const cy = props.cy as number | undefined;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={4} fill={NAVY} stroke="#fff" strokeWidth={1.5} />;
}

function CustomXTick(props: Record<string, unknown>) {
  const x = props.x as number;
  const y = props.y as number;
  const payload = props.payload as { value: string; index: number } | undefined;
  const chartData = props.chartData as ChartPoint[];
  if (!payload) return null;

  const point = chartData[payload.index];
  const vPct = point?.variacionPct ?? null;
  const color = vPct == null ? undefined : vPct <= 0 ? GREEN : RED;

  return (
    <g>
      <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill={GRAY}>
        {payload.value}
      </text>
      {vPct != null && (
        <text x={x} y={y + 25} textAnchor="middle" fontSize={10} fontWeight={600} fill={color}>
          {vPct > 0 ? "+" : ""}{vPct.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

export default function TendenciaMensual({ serieActual, serieAnterior, loading }: Props) {
  const { chartData, tendenciaVar, hasAnterior } = useMemo(() => {
    if (serieActual.length === 0)
      return { chartData: [], tendenciaVar: null, hasAnterior: false };

    const anteriorMap = new Map(serieAnterior.map((s) => [s.periodo, s.total]));
    const actValues = serieActual.map((s) => s.total);
    const { slope, intercept } = linearRegression(actValues);

    const data: ChartPoint[] = serieActual.map((s, i) => {
      const prevPeriodo = s.periodo - 100;
      const ant = anteriorMap.get(prevPeriodo) ?? null;
      const vPct = ant != null && ant > 0 ? ((s.total - ant) / ant) * 100 : null;
      return {
        fullLabel: periodoFull(s.periodo),
        label: periodoShort(s.periodo),
        actual: s.total,
        anterior: ant,
        tendencia: Math.round(intercept + slope * i),
        variacionPct: vPct,
      };
    });

    const n = actValues.length;
    const trendStart = intercept;
    const trendEnd = intercept + slope * (n - 1);
    const tVar = trendStart > 0 ? ((trendEnd - trendStart) / trendStart) * 100 : null;

    return {
      chartData: data,
      tendenciaVar: tVar,
      hasAnterior: serieAnterior.length > 0,
    };
  }, [serieActual, serieAnterior]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLabel = (props: any) => {
    const x = props.x as number;
    const y = props.y as number;
    const value = props.value as number;
    const index = props.index as number;
    if (value == null) return null;

    const total = chartData.length;
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const anchor = isFirst ? "start" : isLast ? "end" : "middle";
    const dx = isFirst ? 6 : isLast ? -6 : 0;

    return (
      <text x={x + dx} y={y - 12} textAnchor={anchor} fontSize={10} fontWeight={600} fill={NAVY}>
        {fmtNum(value)}
      </text>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="h-80 bg-gray-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
        <p className="text-sm text-gray-400">Sin datos para mostrar tendencia</p>
      </div>
    );
  }

  const isPositive = tendenciaVar !== null && tendenciaVar <= 0;
  const absVar = tendenciaVar !== null ? Math.abs(tendenciaVar) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 animate-fade-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Tendencia mensual
          </p>
          <p className="text-[11px] text-gray-300 mt-0.5">vs. periodo anterior</p>
        </div>
        {tendenciaVar !== null && (
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
            {absVar!.toFixed(1)}% tendencia
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 25, right: 20, left: 0, bottom: 16 }}>
            <defs>
              <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={NAVY} stopOpacity={0.18} />
                <stop offset="100%" stopColor={NAVY} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="label"
              tick={<CustomXTick chartData={chartData} />}
              axisLine={false}
              tickLine={false}
              height={45}
            />
            <YAxis
              tick={{ fontSize: 11, fill: GRAY }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => compactNum(v)}
              width={55}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontSize: 13,
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                fmtNum(Number(value)),
                name === "actual"
                  ? "Autorizaciones"
                  : name === "anterior"
                    ? "Periodo anterior"
                    : "Tendencia",
              ]}
              labelFormatter={(_l, payload) => {
                const item = payload?.[0]?.payload as ChartPoint | undefined;
                return item?.fullLabel ?? _l;
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
              formatter={(v: string) =>
                v === "actual" ? "Autorizaciones" : v === "anterior" ? "Periodo anterior" : "Tendencia"
              }
            />

            {/* Area azul con gradiente + dot + etiquetas */}
            <Area
              type="monotone"
              dataKey="actual"
              stroke={NAVY}
              strokeWidth={2.5}
              fill="url(#gradActual)"
              dot={<VariationDot />}
              activeDot={{ r: 6, fill: NAVY, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={900}
              animationEasing="ease-out"
            >
              <LabelList dataKey="actual" content={renderLabel} />
            </Area>

            {/* Linea verde comparativa */}
            {hasAnterior && (
              <Line
                type="monotone"
                dataKey="anterior"
                stroke={GREEN}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, fill: GREEN, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={true}
                animationDuration={1100}
                animationEasing="ease-out"
              />
            )}

            {/* Linea de tendencia */}
            <Line
              type="monotone"
              dataKey="tendencia"
              stroke={GRAY}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
              isAnimationActive={true}
              animationDuration={1300}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
