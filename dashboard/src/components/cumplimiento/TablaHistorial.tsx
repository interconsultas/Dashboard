import { Fragment } from "react";
import { fmtPeriodo } from "@/lib/periodo";
import { CATEGORIAS } from "@/lib/cumplimiento/categorias";
import type { FilaCumplimiento } from "@/lib/cumplimiento/calcular";
import { SIN_DATOS, fmtTasa } from "@/lib/cumplimiento/presentacion";
import { PorcentajeMeta } from "./PorcentajeMeta";

interface Props {
  /** Filas de un solo profesional (una por periodo). */
  filas: FilaCumplimiento[];
}

const thGrupo = "px-2 pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-l border-gray-100 whitespace-nowrap";
const thDetalle = "px-2 pb-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap";
const tdNumero = "py-2 px-2 text-right text-gray-700 tabular-nums whitespace-nowrap";
/**
 * Primera celda de cada categoría: lleva el borde que separa los grupos. Al imprimir
 * queda vacía y sin ancho (ver globals.css), pero se conserva para no descuadrar el colSpan.
 */
const CELDA_ORDENES = "celda-vacia-impresion border-l border-gray-100 print:border-gray-300";

/** Historial mes a mes de un profesional: citas, programa, global y el detalle de cada categoría. */
export function TablaHistorial({ filas }: Props) {
  const ordenadas = [...filas].sort((a, b) => a.periodo - b.periodo);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 animate-fade-slide-up print:shadow-none print:border-gray-300 print:p-4 print:space-y-2">
      <div className="print:break-after-avoid">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Historial mes a mes</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Tasa: órdenes por cita en medicamentos y laboratorios; órdenes por cada 100 citas en las demás categorías.
        </p>
        {/* La tabla completa no cabe en una hoja horizontal: al imprimir se omite el conteo de órdenes */}
        <p className="hidden print:block text-[10px] text-gray-500 mt-0.5">
          En el PDF se omite la columna «Órdenes» de cada categoría para ajustar la tabla al ancho de la hoja.
        </p>
      </div>

      {ordenadas.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">Sin periodos para mostrar</p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="tabla-imprimible w-full text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  rowSpan={2}
                  className="sticky left-0 print:static bg-white pb-2 pr-3 text-left align-bottom text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                >
                  Periodo
                </th>
                <th scope="col" rowSpan={2} className="px-2 pb-2 text-right align-bottom text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Citas
                </th>
                <th scope="col" rowSpan={2} className="px-2 pb-2 text-left align-bottom text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Programa
                </th>
                <th scope="col" rowSpan={2} className="px-2 pb-2 text-right align-bottom text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Global
                </th>
                {CATEGORIAS.map((c) => (
                  <th key={c.clave} scope="colgroup" colSpan={4} className={thGrupo}>
                    {c.etiqueta}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                {CATEGORIAS.map((c) => (
                  <Fragment key={c.clave}>
                    <th scope="col" className={`${thDetalle} ${CELDA_ORDENES}`}>
                      <span className="print:hidden">Órdenes</span>
                    </th>
                    <th scope="col" className={thDetalle}>Tasa</th>
                    <th scope="col" className={thDetalle}>Meta</th>
                    <th scope="col" className={thDetalle}>%</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((f) => (
                <tr key={f.periodo} className="border-b border-gray-50 last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 print:static bg-white py-2 pr-3 text-left font-medium text-gray-700 whitespace-nowrap"
                  >
                    {fmtPeriodo(f.periodo)}
                  </th>
                  <td className={tdNumero}>
                    {f.citas === null ? SIN_DATOS : f.citas.toLocaleString("es-CO")}
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    {f.programa ? (
                      <span className="text-gray-700">{f.programa}</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                        Sin programa
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right font-semibold whitespace-nowrap">
                    <PorcentajeMeta valor={f.global} />
                  </td>
                  {CATEGORIAS.map((c) => {
                    const d = f.categorias[c.clave];
                    return (
                      <Fragment key={c.clave}>
                        <td className={`${tdNumero} ${CELDA_ORDENES}`}>
                          <span className="print:hidden">{d.ordenes.toLocaleString("es-CO")}</span>
                        </td>
                        <td className={tdNumero}>{fmtTasa(d.tasa)}</td>
                        <td className={`${tdNumero} text-gray-500`}>{fmtTasa(d.meta)}</td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          <PorcentajeMeta valor={d.pct} />
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
