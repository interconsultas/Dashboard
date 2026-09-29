"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const NAVY = "#1e3a5f";
const GRAY = "#9ca3af";

export interface SerieDiariaPoint {
  /** null representa el bucket "Sin fecha" (COLUMNA_FECHA_DIARIA IS NULL) */
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

export default function TendenciaDiaria({ serieDiaria, loading }: Props) {
  const { chartData, sinFechaTotal, totalGeneral } = useMemo(() => {
    let sinFecha = 0;
    let total = 0;
    const data: ChartPoint[] = [];
    for (const p of serieDiaria) {
      total += p.total;
      if (p.dia == null) {
        sinFecha += p.total;
        continue;
      }
      data.push({ label: diaLabel(p.dia), total: p.total });
    }
    return { chartData: data, sinFechaTotal: sinFecha, totalGeneral: total };
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

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 animate-fade-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Tendencia diaria</p>
          <p className="text-[11px] text-gray-300 mt-0.5">Total del mes: {fmtNum(totalGeneral)}</p>
        </div>
        {sinFechaTotal > 0 && (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
            Sin fecha: {fmtNum(sinFechaTotal)}
          </span>
        )}
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: GRAY }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: GRAY }} axisLine={false} tickLine={false} width={50} tickFormatter={fmtNum} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [fmtNum(Number(value)), "Autorizaciones"]}
            />
            <Bar dataKey="total" fill={NAVY} radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
