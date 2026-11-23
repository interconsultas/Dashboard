import { useMemo } from "react";
import { Grafico } from "@/components/productividad/Grafico";
import { opcionesEsquema, opcionesInstancias, type Subgrafo } from "@/lib/inteligencia/grafica";
import type { Esquema } from "@/lib/inteligencia/grafo";

/* eslint-disable @typescript-eslint/no-explicit-any -- parámetros de los eventos de ECharts */

const ALTO = "h-[460px] sm:h-[560px]";

/** Gráfica del modelo (tipos y relaciones). Clic en un tipo = listar sus instancias. */
export function MapaModelo({ esquema, onTipo }: { esquema: Esquema; onTipo: (tipo: string) => void }) {
  const opcion = useMemo(() => opcionesEsquema(esquema), [esquema]);
  const eventos = useMemo(
    () => ({ click: (p: any) => p?.data?.tipo && onTipo(p.data.tipo) }),
    [onTipo]
  );
  return <Grafico opcion={opcion} etiqueta="Modelo de relaciones" eventos={eventos} className={ALTO} />;
}

/**
 * Gráfica de instancias. Clic = centrar en el nodo; doble clic = expandir
 * (el contenedor distingue ambos con una espera corta).
 */
export function MapaInstancias({
  subgrafo,
  centro,
  etiqueta,
  onClic,
  onDobleClic,
}: {
  subgrafo: Subgrafo;
  centro: string;
  etiqueta: string;
  onClic: (id: string) => void;
  onDobleClic: (id: string) => void;
}) {
  const opcion = useMemo(() => opcionesInstancias(subgrafo, centro), [subgrafo, centro]);
  const eventos = useMemo(
    () => ({
      click: (p: any) => p?.dataType === "node" && p.data?.id && onClic(p.data.id),
      dblclick: (p: any) => p?.dataType === "node" && p.data?.id && onDobleClic(p.data.id),
    }),
    [onClic, onDobleClic]
  );
  return <Grafico opcion={opcion} etiqueta={`Mapa de relaciones de ${etiqueta}`} eventos={eventos} className={ALTO} />;
}
