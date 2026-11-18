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

const inputCls =
  "border border-borde bg-superficie rounded-control px-3 py-2 text-sm text-tinta-2 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario";

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
      className={alinear === "right" ? "text-right" : "text-left"}
      aria-sort={activa ? (orden.descendente ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => onOrdenar(columna)}
        className="inline-flex items-center gap-1 uppercase tracking-[0.08em] font-bold hover:text-primario"
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
      <table className="tabla tabla-texto tabla-compacta text-xs">
        <thead>
          <tr>
            <th>Código</th>
            <th>Servicio</th>
            {METRICAS.map((m) => (
              <th key={m} className="text-right">
                {ETIQUETAS_METRICA[m]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {detalle.servicios.map((s) => (
            <tr key={s.codigo_servicio}>
              <td className="text-tinta-3">{s.codigo_servicio}</td>
              <td className="text-tinta-2">{s.nombre_servicio}</td>
              {METRICAS.map((m) => (
                <td key={m} className="text-right tabular-nums text-tinta-2">
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
      <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-8 text-center space-y-2">
        <p className="text-sm text-tinta-3">No hay informe cargado para este mes</p>
        {ultimo !== undefined && (
          <button
            type="button"
            onClick={() => onIrAPeriodo(ultimo)}
            className="text-sm font-semibold text-primario hover:underline"
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

      <div className="overflow-x-auto bg-superficie rounded-tarjeta border border-borde shadow-tarjeta">
        <table className="tabla tabla-texto">
          <thead>
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
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={totalColumnas} className="text-center !py-10 text-tinta-3">
                  Sin resultados para esa búsqueda
                </td>
              </tr>
            )}
            {visibles.map((p) => {
              const clave = `${p.tipo_documento}|${p.documento}`;
              const abierto = abiertos.has(clave);
              return (
                <Fragment key={clave}>
                  <tr>
                    <td>
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => alternar(clave)}
                          aria-expanded={abierto}
                          aria-label={`${abierto ? "Ocultar" : "Ver"} servicios de ${p.nombre}`}
                          className="mt-0.5 text-tinta-3 hover:text-primario"
                        >
                          <span aria-hidden="true">{abierto ? "▾" : "▸"}</span>
                        </button>
                        <div>
                          <p className="font-medium text-tinta">{p.nombre}</p>
                          <p className="text-xs text-tinta-3">
                            {p.tipo_documento} {p.documento}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right tabular-nums text-tinta-2">
                      {fmtNumero(p.num_servicios)}
                    </td>
                    {COLUMNAS_TABLA.map((m) => (
                      <td key={m} className="text-right tabular-nums text-tinta-2">
                        {fmtNumero(p[m])}
                      </td>
                    ))}
                  </tr>
                  {abierto && (
                    <tr className="bg-superficie-2">
                      <td colSpan={totalColumnas} >
                        <DesgloseServicios detalle={p} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-superficie-2 border-t-2 border-borde">
            <tr className="font-semibold text-primario">
              <td>Total ({fmtNumero(totales.profesionales)} profesionales)</td>
              <td />
              {COLUMNAS_TABLA.map((m) => (
                <td key={m} className="text-right tabular-nums">
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
