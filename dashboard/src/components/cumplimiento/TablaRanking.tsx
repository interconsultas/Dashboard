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
      className={`w-3 h-3 flex-shrink-0 ${activo ? "text-primario" : "text-referencia"}`}
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
    <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-6 space-y-4 animate-fade-slide-up">
      <div>
        <h2 className="font-titulo text-[15px] font-bold text-tinta">Ranking de profesionales</h2>
        <p className="text-xs text-tinta-3 mt-0.5">
          Promedio del rango seleccionado. Seleccione una fila para ver el detalle del profesional.
        </p>
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-tinta-3 text-center py-8">
          Sin profesionales para los filtros seleccionados
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabla tabla-compacta">
            <thead>
              <tr>
                {COLUMNAS.map((col) => {
                  const activo = orden.columna === col.clave;
                  return (
                    <th
                      key={col.clave}
                      scope="col"
                      aria-sort={!activo ? "none" : orden.direccion === "asc" ? "ascending" : "descending"}
                      className={`align-bottom ${col.texto ? "text-left" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => ordenarPor(col)}
                        className={`inline-flex items-end gap-1 uppercase tracking-[0.08em] font-bold hover:text-primario transition-colors ${
                          col.texto ? "text-left" : "text-right justify-end"
                        } ${activo ? "text-primario" : "text-tinta-3"}`}
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
                  className="cursor-pointer"
                >
                  <td className="min-w-[180px]">
                    <button
                      type="button"
                      aria-label={`Ver el detalle de ${p.nombre}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeleccionar(p.documento);
                      }}
                      className="text-left font-medium text-tinta-2 hover:text-primario hover:underline"
                    >
                      {p.nombre}
                    </button>
                    <span className="block text-[11px] text-tinta-3 tabular-nums">{p.documento}</span>
                  </td>
                  <td className="text-left whitespace-nowrap">
                    {p.programa ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-primario-suave text-primario">
                        {p.programa}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-atencion-suave text-atencion">
                        Sin programa
                      </span>
                    )}
                  </td>
                  <td className="text-tinta-2">
                    {p.citas.toLocaleString("es-CO")}
                  </td>
                  <td className="font-semibold">
                    <PorcentajeMeta valor={p.global} />
                  </td>
                  {CATEGORIAS.map((c) => (
                    <td key={c.clave}>
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
