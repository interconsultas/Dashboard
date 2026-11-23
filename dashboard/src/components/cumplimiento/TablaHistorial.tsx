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

const thGrupo = "text-center border-l border-borde";
const tdNumero = "text-tinta-2 whitespace-nowrap";
/** Primera celda de cada categoría: lleva el borde que separa los grupos. */
const CELDA_ORDENES = "border-l border-borde";

/** Historial mes a mes de un profesional: citas, programa, global y el detalle de cada categoría. */
export function TablaHistorial({ filas }: Props) {
  const ordenadas = [...filas].sort((a, b) => a.periodo - b.periodo);

  return (
    <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-5 space-y-4 animate-fade-slide-up">
      <div>
        <h2 className="font-titulo text-[15px] font-bold text-tinta">Historial mes a mes</h2>
        <p className="text-xs text-tinta-3 mt-0.5">
          Tasa: órdenes por cita en medicamentos y laboratorios; órdenes por cada 100 citas en las demás categorías.
        </p>
      </div>

      {ordenadas.length === 0 ? (
        <p className="text-sm text-tinta-3 text-center py-8">Sin periodos para mostrar</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabla tabla-compacta">
            <thead>
              <tr>
                <th
                  scope="col"
                  rowSpan={2}
                  className="sticky left-0 z-[1] text-left align-bottom"
                >
                  Periodo
                </th>
                <th scope="col" rowSpan={2} className="align-bottom">
                  Citas
                </th>
                <th scope="col" rowSpan={2} className="text-left align-bottom">
                  Programa
                </th>
                <th scope="col" rowSpan={2} className="align-bottom">
                  Global
                </th>
                {CATEGORIAS.map((c) => (
                  <th key={c.clave} scope="colgroup" colSpan={4} className={thGrupo}>
                    {c.etiqueta}
                  </th>
                ))}
              </tr>
              <tr>
                {CATEGORIAS.map((c) => (
                  <Fragment key={c.clave}>
                    <th scope="col" className={CELDA_ORDENES}>
                      Órdenes
                    </th>
                    <th scope="col">Tasa</th>
                    <th scope="col">Meta</th>
                    <th scope="col">%</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((f) => (
                <tr key={f.periodo}>
                  <th
                    scope="row"
                    className="sticky left-0 bg-superficie text-left font-medium text-tinta-2 whitespace-nowrap"
                  >
                    {fmtPeriodo(f.periodo)}
                  </th>
                  <td className={tdNumero}>
                    {f.citas === null ? SIN_DATOS : f.citas.toLocaleString("es-CO")}
                  </td>
                  <td className="text-left whitespace-nowrap">
                    {f.programa ? (
                      <span className="text-tinta-2">{f.programa}</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-atencion-suave text-atencion">
                        Sin programa
                      </span>
                    )}
                  </td>
                  <td className="font-semibold whitespace-nowrap">
                    <PorcentajeMeta valor={f.global} />
                  </td>
                  {CATEGORIAS.map((c) => {
                    const d = f.categorias[c.clave];
                    return (
                      <Fragment key={c.clave}>
                        <td className={`${tdNumero} ${CELDA_ORDENES}`}>
                          {d.ordenes.toLocaleString("es-CO")}
                        </td>
                        <td className={tdNumero}>{fmtTasa(d.tasa)}</td>
                        <td className={`${tdNumero} text-tinta-3`}>{fmtTasa(d.meta)}</td>
                        <td className="whitespace-nowrap">
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
