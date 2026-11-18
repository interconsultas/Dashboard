"use client";

import { useMemo, useRef } from "react";
import { opcionesCalor } from "@/lib/productividad/graficas";
import type { RespuestaProductividad } from "@/lib/productividad/tipos";
import { Grafico } from "./Grafico";
import { Panel, SinDatos } from "./Panel";

interface Props {
  mapa: RespuestaProductividad["mapa_calor"];
  /** Área filtrada: se resalta en el eje. */
  area: string | null;
  onCelda: (area: string, clave: string) => void;
}

export function MapaCalor({ mapa, area, onCelda }: Props) {
  const opcion = useMemo(() => opcionesCalor(mapa, area), [mapa, area]);

  const actual = useRef({ mapa, onCelda });
  actual.current = { mapa, onCelda };
  const eventos = useMemo(
    () => ({
      click: (p: { value?: number[] }) => {
        if (!p.value) return;
        const { mapa: m, onCelda: cb } = actual.current;
        const periodo = m.periodos[p.value[0]];
        const a = m.areas[p.value[1]];
        if (periodo && a) cb(a, periodo.clave);
      },
    }),
    []
  );

  // Alto según el número de áreas para que las celdas no se aplasten
  const alto = Math.max(300, mapa.areas.length * 34 + 70);

  return (
    <Panel
      titulo="Mapa de calor: % de inasistencia por área y periodo"
      ayuda="Más oscuro = más inasistencia. Clic en una celda para filtrar área y periodo."
    >
      {mapa.celdas.length === 0 ? (
        <SinDatos>No hay citas asignadas con los filtros actuales.</SinDatos>
      ) : (
        <div style={{ height: alto }}>
          <Grafico opcion={opcion} etiqueta="Mapa de calor de inasistencia" eventos={eventos} className="h-full" />
        </div>
      )}
    </Panel>
  );
}
