"use client";

import { useMemo, useRef } from "react";
import { opcionesDispersion } from "@/lib/productividad/graficas";
import { MIN_ASIGNADAS_DISPERSION, elegiblesDispersion } from "@/lib/productividad/profesionales";
import type { ResumenProfesional } from "@/lib/productividad/tipos";
import { Grafico } from "./Grafico";
import { Panel, SinDatos } from "./Panel";

interface Props {
  lista: ResumenProfesional[];
  onFicha: (documento: string) => void;
}

interface ParamsClic {
  data?: { documento?: string };
}

export function DispersionProfesionales({ lista, onFicha }: Props) {
  const puntos = useMemo(() => elegiblesDispersion(lista), [lista]);
  const opcion = useMemo(() => opcionesDispersion(puntos), [puntos]);

  const actual = useRef(onFicha);
  actual.current = onFicha;
  const eventos = useMemo(
    () => ({
      click: (p: ParamsClic) => {
        if (p.data?.documento) actual.current(p.data.documento);
      },
    }),
    []
  );

  return (
    <Panel
      titulo="Productividad de los profesionales"
      ayuda={`Cada punto es un profesional con ${MIN_ASIGNADAS_DISPERSION} o más citas asignadas en el periodo: volumen contra % de inasistencia; el tamaño son sus citas sin asignar. La línea vertical es la mediana de volumen. Clic para ver su ficha.`}
    >
      {puntos.length === 0 ? (
        <SinDatos className="h-[380px]">
          Ningún profesional tiene {MIN_ASIGNADAS_DISPERSION} o más citas asignadas con los filtros elegidos.
        </SinDatos>
      ) : (
        <Grafico opcion={opcion} etiqueta="Dispersión de profesionales" eventos={eventos} className="h-[380px]" />
      )}
    </Panel>
  );
}
