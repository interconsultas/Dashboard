"use client";

import { useMemo, useRef } from "react";
import type { EChartsType } from "@/lib/echarts";
import { opcionesTendencia } from "@/lib/productividad/graficas";
import { META_INASISTENCIA } from "@/lib/productividad/metricas";
import type { PuntoSerie } from "@/lib/productividad/tipos";
import { Grafico } from "./Grafico";
import { Panel, SinDatos } from "./Panel";

interface Props {
  serie: PuntoSerie[];
  seleccionado: string | null;
  onPeriodo: (clave: string) => void;
}

export function GraficaTendencia({ serie, seleccionado, onPeriodo }: Props) {
  const opcion = useMemo(() => opcionesTendencia(serie, seleccionado), [serie, seleccionado]);

  // Los manejadores registrados en ECharts leen siempre la serie vigente
  const actual = useRef({ serie, onPeriodo });
  actual.current = { serie, onPeriodo };

  const eventos = useMemo(
    () => ({
      click: (p: { dataIndex?: number }) => {
        const punto = p.dataIndex === undefined ? undefined : actual.current.serie[p.dataIndex];
        if (punto) actual.current.onPeriodo(punto.clave);
      },
    }),
    []
  );

  // Clic en cualquier parte de la columna del periodo, no solo sobre el punto
  function onListo(chart: EChartsType) {
    chart.getZr().on("click", (e: { offsetX: number; offsetY: number; target?: unknown }) => {
      if (e.target) return; // el clic sobre un punto ya lo maneja `eventos.click`
      const pt = [e.offsetX, e.offsetY];
      if (!chart.containPixel("grid", pt)) return;
      const [i] = chart.convertFromPixel({ seriesIndex: 0 }, pt) as number[];
      const punto = actual.current.serie[Math.round(i)];
      if (punto) actual.current.onPeriodo(punto.clave);
    });
  }

  return (
    <Panel
      titulo="Inasistencia por periodo"
      ayuda={`% de inasistencia (inasistidas ÷ asignadas) contra la meta del ${META_INASISTENCIA * 100} %. Clic en un periodo para filtrar; arrastre abajo para hacer zoom.`}
    >
      {serie.length === 0 ? (
        <SinDatos>No hay datos para graficar.</SinDatos>
      ) : (
        <Grafico
          opcion={opcion}
          etiqueta="Tendencia del % de inasistencia"
          eventos={eventos}
          onListo={onListo}
          className="h-[300px]"
        />
      )}
    </Panel>
  );
}
