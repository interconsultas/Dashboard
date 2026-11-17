"use client";

import { useMemo } from "react";
import { opcionesEmbudo } from "@/lib/productividad/graficas";
import type { Embudo } from "@/lib/productividad/tipos";
import { Grafico } from "./Grafico";
import { Panel, SinDatos } from "./Panel";

export function GraficaEmbudo({ embudo }: { embudo: Embudo | null }) {
  const opcion = useMemo(() => (embudo ? opcionesEmbudo(embudo) : null), [embudo]);

  return (
    <Panel titulo="Embudo de la agenda" ayuda="Dónde se pierden las citas en el periodo seleccionado.">
      {!opcion || !embudo || embudo.ofertadas === 0 ? (
        <SinDatos>No hay citas ofertadas con los filtros actuales.</SinDatos>
      ) : (
        <Grafico opcion={opcion} etiqueta="Embudo de la agenda" className="h-[300px]" />
      )}
    </Panel>
  );
}
