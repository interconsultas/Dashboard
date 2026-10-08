"use client";

import { useMemo, useState } from "react";
import { CATEGORIAS } from "@/lib/cumplimiento/categorias";
import type { ProfesionalCumplimiento } from "@/lib/cumplimiento/calcular";
import { ordenarRanking, type ColumnaRanking, type Direccion } from "@/lib/cumplimiento/presentacion";
import { PorcentajeMeta } from "./PorcentajeMeta";

interface Props {
  profesionales: ProfesionalCumplimiento[];
  onSeleccionar: (documento: string) => void;
}

interface Columna {
  clave: ColumnaRanking;
  etiqueta: string;
  /** Las columnas de texto arrancan en orden ascendente; las numéricas, en descendente. */
  texto?: boolean;
}

const COLUMNAS: Columna[] = [
  { clave: "nombre", etiqueta: "Profesional", texto: true },
  { clave: "programa", etiqueta: "Programa", texto: true },
  { clave: "citas", etiqueta: "Citas" },
  { clave: "global", etiqueta: "Global" },
  ...CATEGORIAS.map((c) => ({ clave: c.clave, etiqueta: c.etiqueta })),
];

function IconOrden({ activo, direccion }: { activo: boolean; direccion: Direccion }) {
  return (
    <svg
      className={`w-3 h-3 flex-shrink-0 print:hidden ${activo ? "text-brand-navy" : "text-gray-300"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={!activo ? "M8 9l4-4 4 4M16 15l-4 4-4-4" : direccion === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
      />
    </svg>
  );
}

/** Ranking de profesionales, ordenable por cualquier columna. Cada fila lleva al detalle del profesional. */
export function TablaRanking({ profesionales, onSeleccionar }: Props) {
  const [orden, setOrden] = useState<{ columna: ColumnaRanking; direccion: Direccion }>({
    columna: "global",
    direccion: "desc",
  });

  const filas = useMemo(
    () => ordenarRanking(profesionales, orden.columna, orden.direccion),
    [profesionales, orden]
  );

  function ordenarPor(columna: Columna) {
    setOrden((actual) =>
      actual.columna === columna.clave
        ? { columna: columna.clave, direccion: actual.direccion === "asc" ? "desc" : "asc" }
        : { columna: columna.clave, direccion: columna.texto ? "asc" : "desc" }
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 animate-fade-slide-up print:shadow-none print:border-gray-300 print:p-4 print:space-y-2">
      <div className="print:break-after-avoid">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Ranking de profesionales</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Promedio del rango seleccionado.<span className="print:hidden"> Seleccione una fila para ver el detalle del profesional.</span>
        </p>
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          Sin profesionales para los filtros seleccionados
        </p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="tabla-imprimible w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {COLUMNAS.map((col) => {
                  const activo = orden.columna === col.clave;
                  return (
                    <th
                      key={col.clave}
                      scope="col"
                      aria-sort={!activo ? "none" : orden.direccion === "asc" ? "ascending" : "descending"}
                      className={`pb-2 px-2 first:pl-0 last:pr-0 align-bottom ${col.texto ? "text-left" : "text-right"}`}
                    >
                      <button
                        type="button"
                        onClick={() => ordenarPor(col)}
                        className={`inline-flex items-end gap-1 text-[11px] font-semibold uppercase tracking-wider hover:text-brand-navy transition-colors ${
                          col.texto ? "text-left" : "text-right justify-end"
                        } ${activo ? "text-brand-navy" : "text-gray-500"}`}
                      >
                        {col.etiqueta}
                        <IconOrden activo={activo} direccion={orden.direccion} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filas.map((p) => (
                <tr
                  key={p.documento}
                  onClick={() => onSeleccionar(p.documento)}
                  className="border-b border-gray-50 last:border-0 hover:bg-brand-blue-soft-2 cursor-pointer transition-colors"
                >
                  <td className="py-2 pr-2 min-w-[180px]">
                    <button
                      type="button"
                      aria-label={`Ver el detalle de ${p.nombre}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeleccionar(p.documento);
                      }}
                      className="text-left font-medium text-gray-700 hover:text-brand-navy hover:underline"
                    >
                      {p.nombre}
                    </button>
                    <span className="block text-[11px] text-gray-500 tabular-nums">{p.documento}</span>
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    {p.programa ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-blue-soft text-brand-navy">
                        {p.programa}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                        Sin programa
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-700 tabular-nums">
                    {p.citas.toLocaleString("es-CO")}
                  </td>
                  <td className="py-2 px-2 text-right font-semibold">
                    <PorcentajeMeta valor={p.global} />
                  </td>
                  {CATEGORIAS.map((c) => (
                    <td key={c.clave} className="py-2 px-2 last:pr-0 text-right">
                      <PorcentajeMeta valor={p.pct[c.clave] ?? null} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
