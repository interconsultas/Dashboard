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
  ReferenceLine,
  LabelList,
} from "recharts";
import { puntosGrafica, techoEje, type PuntoGrafica, type ValorPeriodo } from "@/lib/cumplimiento/presentacion";
import { COLORES, SOMBRAS } from "@/lib/tema/tokens";

export { techoEje };

// Misma paleta que TendenciaMensual
// Colores de los tokens de diseño (lib/tema/tokens)
const NAVY = COLORES.primario;
const GREEN = COLORES.acento;
const GRAY = COLORES["tinta-3"];

/** Con más barras que estas, las etiquetas sobre cada barra se pisan: quedan en el tooltip y la tabla. */
const MAX_BARRAS_CON_ETIQUETA = 12;

interface Props {
  /** Cumplimiento global por periodo (fracción de la meta; null = sin datos). */
  serie: ValorPeriodo[];
  titulo?: string;
  subtitulo?: string;
  loading?: boolean;
}

/** Tabla equivalente a la gráfica, solo para lectores de pantalla. */
export function TablaEquivalente({ titulo, puntos }: { titulo: string; puntos: PuntoGrafica[] }) {
  return (
    <table className="sr-only">
      <caption>{titulo}: datos de la gráfica</caption>
      <thead>
        <tr>
          <th scope="col">Periodo</th>
          <th scope="col">Cumplimiento</th>
        </tr>
      </thead>
      <tbody>
        {puntos.map((p) => (
          <tr key={p.periodo}>
            <th scope="row">{p.etiquetaLarga}</th>
            <td>{p.texto}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Barras del cumplimiento global promedio por mes, con la línea de referencia del 100%. */
export function GraficaGlobalMensual({
  serie,
  titulo = "Cumplimiento global por mes",
  subtitulo = "Promedio de los profesionales con datos en cada mes",
  loading,
}: Props) {
  const puntos = useMemo(() => puntosGrafica(serie), [serie]);

  if (loading) {
    return (
      <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-6">
        <div className="h-72 bg-superficie-2 rounded-control animate-pulse" />
      </div>
    );
  }

  const hayDatos = puntos.some((p) => p.pct !== null);

  return (
    <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-6 space-y-4 animate-fade-slide-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-titulo text-[15px] font-bold text-tinta">{titulo}</h2>
          <p className="text-xs text-tinta-3 mt-0.5">{subtitulo}</p>
        </div>
        {hayDatos && (
          <p className="flex items-center gap-1.5 text-[11px] text-tinta-3">
            <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: GREEN }} />
            Meta 100% (menor es mejor)
          </p>
        )}
      </div>

      {!hayDatos ? (
        <p className="text-sm text-tinta-3 text-center py-8">Sin datos para mostrar la gráfica</p>
      ) : (
        <>
          <div className="h-72" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={puntos} margin={{ top: 20, right: 20, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COLORES.borde} vertical={false} />
                <XAxis
                  dataKey="etiqueta"
                  tick={{ fontSize: 11, fill: GRAY }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: GRAY }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                  domain={[0, techoEje]}
                  width={50}
                />
                <Tooltip
                  cursor={{ fill: COLORES["primario-suave"] }}
                  contentStyle={{
                    borderRadius: 12,
                    border: `1px solid ${COLORES.borde}`,
                    fontSize: 13,
                    boxShadow: SOMBRAS.tarjeta,
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(_value: any, _name: any, item: any) => [
                    (item?.payload as PuntoGrafica | undefined)?.texto ?? "—",
                    "Cumplimiento global",
                  ]}
                  labelFormatter={(_l, payload) => {
                    const item = payload?.[0]?.payload as PuntoGrafica | undefined;
                    return item?.etiquetaLarga ?? _l;
                  }}
                />
                <Bar
                  dataKey="pct"
                  fill={NAVY}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {puntos.length <= MAX_BARRAS_CON_ETIQUETA && (
                    <LabelList dataKey="texto" position="top" fontSize={11} fontWeight={700} fill={NAVY} />
                  )}
                </Bar>
                <ReferenceLine y={100} stroke={GREEN} strokeWidth={2} strokeDasharray="6 3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <TablaEquivalente titulo={titulo} puntos={puntos} />
        </>
      )}
    </div>
  );
}
