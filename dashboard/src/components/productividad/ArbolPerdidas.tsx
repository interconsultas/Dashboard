"use client";

import { useMemo, useRef } from "react";
import { opcionesArbol } from "@/lib/productividad/graficas";
import type { NodoArea } from "@/lib/productividad/tipos";
import { Grafico } from "./Grafico";
import { Panel, SinDatos } from "./Panel";

interface Props {
  arbol: NodoArea[];
  /** Catálogo de áreas en orden: fija el color de cada una. */
  areas: string[];
  area: string | null;
  /** Servicio filtrado: se resalta dentro de su área. */
  servicio?: string | null;
  onArea: (area: string | null) => void;
  onServicio: (codigo: string) => void;
}

interface ParamsClic {
  data?: { name?: string; area?: string; codigo?: string };
}

export function ArbolPerdidas({ arbol, areas, area, servicio = null, onArea, onServicio }: Props) {
  const opcion = useMemo(() => opcionesArbol(arbol, areas, area, servicio), [arbol, areas, area, servicio]);

  const actual = useRef({ onArea, onServicio });
  actual.current = { onArea, onServicio };
  const eventos = useMemo(
    () => ({
      click: (p: ParamsClic) => {
        if (p.data?.codigo) actual.current.onServicio(p.data.codigo);
        else if (p.data?.area) actual.current.onArea(p.data.area);
      },
    }),
    []
  );

  return (
    <Panel
      titulo="Citas perdidas por área y servicio"
      ayuda="Inasistidas + disponibles. Clic en un área para ver sus servicios; clic en un servicio para filtrarlo."
    >
      {area && (
        <div className="flex items-center gap-2 mb-2 text-sm">
          <button
            type="button"
            onClick={() => onArea(null)}
            className="text-brand-navy font-medium hover:underline"
          >
            ← Todas las áreas
          </button>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-tinta-2">{area}</span>
        </div>
      )}
      {arbol.length === 0 ? (
        <SinDatos>No hay citas perdidas en el periodo.</SinDatos>
      ) : (
        <Grafico
          opcion={opcion}
          etiqueta="Citas perdidas por área y servicio"
          eventos={eventos}
          className="flex-1 min-h-[272px]"
        />
      )}
    </Panel>
  );
}
