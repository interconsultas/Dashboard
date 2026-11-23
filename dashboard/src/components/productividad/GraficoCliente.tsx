"use client";

import { useEffect, useMemo, useRef } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, NOMBRE_TEMA, type EChartsType } from "@/lib/echarts";
import { conAnimacion, prefiereMenosMovimiento } from "@/lib/tema/animacion";
import { registrarGrafica } from "@/lib/informes/registroGraficas";

export interface PropsGrafico {
  /** Opción de ECharts (lib/productividad/graficas). */
  opcion: object;
  /** Nombre accesible de la gráfica. */
  etiqueta: string;
  /** Eventos de ECharts: { click: (params) => void }. */
  eventos?: Record<string, (params: never) => void>;
  /** Instancia lista (p. ej. para dispatchAction o clics fuera de los puntos). */
  onListo?: (chart: EChartsType) => void;
  className?: string;
}

/** Envoltura de echarts-for-react con el ECharts modular y el tema de la app. Solo navegador. */
export default function GraficoCliente({ opcion, etiqueta, eventos, onListo, className }: PropsGrafico) {
  const contenedor = useRef<HTMLDivElement>(null);
  const instancia = useRef<EChartsType | null>(null);
  const quitarDelRegistro = useRef<(() => void) | null>(null);
  // Misma animación en todas las gráficas (y ninguna con movimiento reducido)
  const opcionAnimada = useMemo(() => conAnimacion(opcion, prefiereMenosMovimiento()), [opcion]);

  // echarts-for-react solo se redimensiona con la ventana; la tarjeta cambia de
  // ancho al cargar la grilla o al plegar el menú, así que se observa el contenedor.
  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo || typeof ResizeObserver === "undefined") return;
    // ResizeObserver avisa apenas empieza a observar, con el mismo tamaño: un
    // resize() ahí redibuja sin animación y corta la entrada de la gráfica.
    // Solo se redimensiona cuando el tamaño cambió de verdad.
    const observador = new ResizeObserver((entradas) => {
      const chart = instancia.current;
      const caja = entradas[entradas.length - 1]?.contentRect;
      if (!chart || !caja) return;
      if (Math.round(caja.width) === chart.getWidth() && Math.round(caja.height) === chart.getHeight()) return;
      chart.resize();
    });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  // Al desmontar, el PDF ya no puede capturar esta gráfica
  useEffect(() => () => quitarDelRegistro.current?.(), []);

  const alEstarListo = (chart: EChartsType) => {
    instancia.current = chart;
    quitarDelRegistro.current?.();
    quitarDelRegistro.current = registrarGrafica(etiqueta, chart);
    onListo?.(chart);
  };

  return (
    <div ref={contenedor} role="img" aria-label={etiqueta} className={className}>
      <ReactEChartsCore
        echarts={echarts}
        theme={NOMBRE_TEMA}
        option={opcionAnimada}
        notMerge
        lazyUpdate
        onEvents={eventos}
        onChartReady={alEstarListo}
        style={{ width: "100%", height: "100%" }}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}
