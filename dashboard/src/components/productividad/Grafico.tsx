"use client";

import dynamic from "next/dynamic";
import type { PropsGrafico } from "./GraficoCliente";

export type { PropsGrafico };

/**
 * ECharts necesita el DOM (canvas): se carga solo en el navegador y en un
 * chunk aparte, así el resto de la app no paga su peso.
 */
export const Grafico = dynamic<PropsGrafico>(() => import("./GraficoCliente"), {
  ssr: false,
  loading: () => <div className="h-full w-full skeleton rounded-control" />,
});
