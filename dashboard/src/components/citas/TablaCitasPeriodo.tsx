"use client";

import { Fragment, useMemo, useState } from "react";
import { fmtPeriodo } from "@/lib/periodo";
import {
  ETIQUETAS_METRICA,
  METRICAS,
  filtrarProfesionales,
  fmtNumero,
  ordenarProfesionales,
  type ColumnaOrden,
  type DetalleCitas,
  type Metrica,
  type Orden,
} from "@/lib/citas/detalle";

interface Props {
  detalle: DetalleCitas;
  onIrAPeriodo: (periodo: number) => void;
}

// Columnas de la tabla principal; confirmadas sin atención y pendientes van en el desglose
const COLUMNAS_TABLA: Metrica[] = [
  "creadas",
  "bloqueadas",
  "ofertadas",
  "disponibles",
  "asignadas",
  "confirmadas",
  "inasistidas",
  "canceladas",
];

const thCls =
  "px-3 py-3 text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap";
const inputCls =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none";

function Encabezado({
  columna,
  etiqueta,
  orden,
  alinear,
  onOrdenar,
}: {
  columna: ColumnaOrden;
  etiqueta: string;
  orden: Orden;
  alinear: "left" | "right";
  onOrdenar: (columna: ColumnaOrden) => void;
}) {
  const activa = orden.columna === columna;
  return (
    <th
      className={`${thCls} ${alinear === "right" ? "text-right" : "text-left"}`}
      aria-sort={activa ? (orden.descendente ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => onOrdenar(columna)}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:underline"
      >
        {etiqueta}
        <span aria-hidden="true" className={activa ? "" : "opacity-40"}>
          {activa && !orden.descendente ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

function DesgloseServicios({ detalle }: { detalle: DetalleCitas["profesionales"][number] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-gray-500">
            <th className="px-3 py-2 text-left font-semibold">Código</th>
            <th className="px-3 py-2 text-left font-semibold">Servicio</th>
            {METRICAS.map((m) => (
              <th key={m} className="px-3 py-2 text-right font-semibold">
                {ETIQUETAS_METRICA[m]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {detalle.servicios.map((s) => (
            <tr key={s.codigo_servicio}>
              <td className="px-3 py-1.5 text-gray-500">{s.codigo_servicio}</td>
              <td className="px-3 py-1.5 text-gray-700">{s.nombre_servicio}</td>
              {METRICAS.map((m) => (
                <td key={m} className="px-3 py-1.5 text-right tabular-nums text-gray-700">
                  {fmtNumero(s[m])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TablaCitasPeriodo({ detalle, onIrAPeriodo }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>({ columna: "creadas", descendente: true });
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set());

  const visibles = useMemo(
    () => ordenarProfesionales(filtrarProfesionales(detalle.profesionales, busqueda), orden),
    [detalle.profesionales, busqueda, orden]
  );

  if (detalle.profesionales.length === 0) {
    const ultimo = detalle.periodos.find((p) => p !== detalle.periodo);
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-2">
        <p className="text-sm text-gray-500">No hay informe cargado para este mes</p>
        {ultimo !== undefined && (
          <button
            type="button"
            onClick={() => onIrAPeriodo(ultimo)}
            className="text-sm font-semibold text-brand-navy hover:underline"
          >
            Ver el último informe cargado ({fmtPeriodo(ultimo)})
          </button>
        )}
      </div>
    );
  }

  function ordenar(columna: ColumnaOrden) {
    setOrden((prev) =>
      prev.columna === columna
        ? { columna, descendente: !prev.descendente }
        : { columna, descendente: columna !== "nombre" }
    );
  }

  function alternar(clave: string) {
    setAbiertos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  const totalColumnas = 2 + COLUMNAS_TABLA.length;
  const { totales } = detalle;

  return (
    <div className="space-y-3">
      <input
        className={`${inputCls} w-full sm:w-72`}
        placeholder="Buscar por nombre o cédula…"
        aria-label="Buscar profesional en las citas del periodo"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-navy">
            <tr>
              <Encabezado columna="nombre" etiqueta="Profesional" orden={orden} alinear="left" onOrdenar={ordenar} />
              <Encabezado columna="num_servicios" etiqueta="Servicios" orden={orden} alinear="right" onOrdenar={ordenar} />
              {COLUMNAS_TABLA.map((m) => (
                <Encabezado
                  key={m}
                  columna={m}
                  etiqueta={ETIQUETAS_METRICA[m]}
                  orden={orden}
                  alinear="right"
                  onOrdenar={ordenar}
                />
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {visibles.length === 0 && (
              <tr>
                <td colSpan={totalColumnas} className="text-center py-10 text-gray-500">
                  Sin resultados para esa búsqueda
                </td>
              </tr>
            )}
            {visibles.map((p, idx) => {
              const clave = `${p.tipo_documento}|${p.documento}`;
              const abierto = abiertos.has(clave);
              return (
                <Fragment key={clave}>
                  <tr
                    className={`${
                      idx % 2 === 0 ? "bg-white" : "bg-surface-alt"
                    } hover:bg-brand-blue-soft-2 transition-colors`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => alternar(clave)}
                          aria-expanded={abierto}
                          aria-label={`${abierto ? "Ocultar" : "Ver"} servicios de ${p.nombre}`}
                          className="mt-0.5 text-gray-400 hover:text-brand-navy"
                        >
                          <span aria-hidden="true">{abierto ? "▾" : "▸"}</span>
                        </button>
                        <div>
                          <p className="font-medium text-gray-800">{p.nombre}</p>
                          <p className="text-xs text-gray-500">
                            {p.tipo_documento} {p.documento}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                      {fmtNumero(p.num_servicios)}
                    </td>
                    {COLUMNAS_TABLA.map((m) => (
                      <td key={m} className="px-3 py-2 text-right tabular-nums text-gray-700">
                        {fmtNumero(p[m])}
                      </td>
                    ))}
                  </tr>
                  {abierto && (
                    <tr className="bg-gray-50">
                      <td colSpan={totalColumnas} className="px-6 py-3">
                        <DesgloseServicios detalle={p} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
            <tr className="font-semibold text-brand-navy">
              <td className="px-3 py-2">Total ({fmtNumero(totales.profesionales)} profesionales)</td>
              <td className="px-3 py-2" />
              {COLUMNAS_TABLA.map((m) => (
                <td key={m} className="px-3 py-2 text-right tabular-nums">
                  {fmtNumero(totales[m])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
