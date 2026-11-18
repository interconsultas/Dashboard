"use client";

import { useMemo, useRef } from "react";
import { opcionesPareto } from "@/lib/productividad/graficas";
import { fmtNumero } from "@/lib/productividad/presentacion";
import { CORTE_PARETO, TOP_PARETO, pareto } from "@/lib/productividad/profesionales";
import type { ResumenProfesional } from "@/lib/productividad/tipos";
import { Grafico } from "./Grafico";
import { Panel, SinDatos } from "./Panel";

interface Props {
  lista: ResumenProfesional[];
  onFicha: (documento: string) => void;
}

const CORTE_PCT = CORTE_PARETO * 100;

export function ParetoPerdidas({ lista, onFicha }: Props) {
  const resultado = useMemo(() => pareto(lista), [lista]);
  const opcion = useMemo(() => opcionesPareto(resultado.filas), [resultado]);

  const actual = useRef({ filas: resultado.filas, onFicha });
  actual.current = { filas: resultado.filas, onFicha };
  const eventos = useMemo(
    () => ({
      click: (p: { dataIndex?: number }) => {
        const fila = p.dataIndex === undefined ? undefined : actual.current.filas[p.dataIndex];
        if (fila) actual.current.onFicha(fila.documento);
      },
    }),
    []
  );

  const ayuda =
    resultado.total > 0 ? (
      <>
        <b>{resultado.corte}</b> de {resultado.profesionales} profesionales concentran el {CORTE_PCT} % de las{" "}
        {fmtNumero(resultado.total)} citas perdidas. Se muestran los {TOP_PARETO} primeros; en tonos oscuros, los que
        están dentro del {CORTE_PCT} %.
      </>
    ) : (
      "Inasistidas + disponibles por profesional."
    );

  return (
    <Panel titulo="Pareto de citas perdidas" ayuda={ayuda}>
      {resultado.total === 0 ? (
        <SinDatos className="h-[380px]">No hay citas perdidas con los filtros elegidos.</SinDatos>
      ) : (
        <Grafico opcion={opcion} etiqueta="Pareto de citas perdidas" eventos={eventos} className="flex-1 min-h-[380px]" />
      )}
    </Panel>
  );
}
