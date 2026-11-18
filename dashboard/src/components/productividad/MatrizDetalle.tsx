"use client";

import { Fragment, useState } from "react";
import type { Indicadores } from "@/lib/productividad/metricas";
import { celdaCalor, colorArea, fmtNumero, fmtPct } from "@/lib/productividad/presentacion";
import type { NodoArea, NodoServicio, RespuestaProductividad } from "@/lib/productividad/tipos";
import { Panel, SinDatos } from "./Panel";

/* ── Constants ──────────────────────────────── */

/** Mínimo de citas para que un servicio cuente en el rango del formato condicional (evita extremos por volumen bajo). */
const MIN_CITAS_RANGO = 30;

type ClaveOrden = "nombre" | "ofertadas" | "asignadas" | "inasistidas" | "disponibles" | "perdidas" | "pct_inasistencia" | "pct_disponibilidad";

const COLUMNAS: { clave: ClaveOrden; titulo: string }[] = [
  { clave: "nombre", titulo: "Área / servicio" },
  { clave: "ofertadas", titulo: "Ofertadas" },
  { clave: "asignadas", titulo: "Asignadas" },
  { clave: "inasistidas", titulo: "Inasistidas" },
  { clave: "disponibles", titulo: "Disponibles" },
  { clave: "perdidas", titulo: "Citas perdidas" },
  { clave: "pct_inasistencia", titulo: "% Inasistencia" },
  { clave: "pct_disponibilidad", titulo: "% Disponibilidad" },
];

interface Props {
  matriz: RespuestaProductividad["matriz"];
  areas: string[];
  /** Área filtrada: aparece desplegada. */
  area: string | null;
  etiquetaPeriodo: string;
  onServicio: (codigo: string) => void;
}

/* ── Helpers ─────────────────────────────────── */

function valorOrden(fila: NodoArea | NodoServicio, clave: ClaveOrden): number | string {
  if (clave === "nombre") return "area" in fila ? fila.area : fila.nombre;
  return fila[clave] ?? -1;
}

function rango(valores: number[], minDefecto: number, maxDefecto: number): [number, number] {
  return [Math.min(...valores, minDefecto), Math.max(...valores, maxDefecto)];
}

/* ── Subcomponents ───────────────────────────────── */

function CeldaPct({ v, rango: [lo, hi] }: { v: number | null; rango: [number, number] }) {
  const c = celdaCalor(v, lo, hi);
  return (
    <td className="px-2.5 py-1.5 text-right">
      {c ? (
        <span className="inline-block min-w-[64px] rounded-md px-2 py-0.5" style={{ background: c.fondo, color: c.tinta }}>
          {fmtPct(v)}
        </span>
      ) : (
        "—"
      )}
    </td>
  );
}

function Celdas({ f, rInas, rDisp }: { f: Indicadores; rInas: [number, number]; rDisp: [number, number] }) {
  const num = "px-2.5 py-1.5 text-right";
  return (
    <>
      <td className={num}>{fmtNumero(f.ofertadas)}</td>
      <td className={num}>{fmtNumero(f.asignadas)}</td>
      <td className={num}>{fmtNumero(f.inasistidas)}</td>
      <td className={num}>{fmtNumero(f.disponibles)}</td>
      <td className={num}>{fmtNumero(f.perdidas)}</td>
      <CeldaPct v={f.pct_inasistencia} rango={rInas} />
      <CeldaPct v={f.pct_disponibilidad} rango={rDisp} />
    </>
  );
}

/* ── Component ──────────────────────────────────── */

export function MatrizDetalle({ matriz, areas, area, etiquetaPeriodo, onServicio }: Props) {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [orden, setOrden] = useState<{ clave: ClaveOrden; dir: 1 | -1 }>({ clave: "perdidas", dir: -1 });

  const comparar = (a: NodoArea | NodoServicio, b: NodoArea | NodoServicio) => {
    const va = valorOrden(a, orden.clave);
    const vb = valorOrden(b, orden.clave);
    const c = typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb) : va > vb ? 1 : va < vb ? -1 : 0;
    return c * orden.dir;
  };

  function ordenarPor(clave: ClaveOrden) {
    setOrden((o) => ({ clave, dir: o.clave === clave ? (o.dir === 1 ? -1 : 1) : -1 }));
  }

  function alternar(a: string) {
    setAbiertas((prev) => {
      const s = new Set(prev);
      if (s.has(a)) s.delete(a);
      else s.add(a);
      return s;
    });
  }

  const servicios = matriz.areas.flatMap((a) => a.servicios);
  const rInas = rango(
    servicios.filter((s) => s.asignadas >= MIN_CITAS_RANGO && s.pct_inasistencia !== null).map((s) => s.pct_inasistencia!),
    0.05,
    0.3
  );
  const rDisp = rango(
    servicios.filter((s) => s.ofertadas >= MIN_CITAS_RANGO && s.pct_disponibilidad !== null).map((s) => s.pct_disponibilidad!),
    0,
    0.2
  );

  return (
    <Panel
      titulo="Detalle por área y servicio"
      ayuda="Formato condicional en % de inasistencia y disponibilidad. Clic en un área para desplegar sus servicios; clic en un servicio para filtrarlo; clic en un encabezado para ordenar."
    >
      {matriz.areas.length === 0 ? (
        <SinDatos className="h-32">No hay citas con los filtros actuales.</SinDatos>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm tabular-nums text-[#0F2A4A]">
            <thead>
              <tr>
                {COLUMNAS.map((c, i) => {
                  const activa = orden.clave === c.clave;
                  return (
                    <th
                      key={c.clave}
                      aria-sort={activa ? (orden.dir === -1 ? "descending" : "ascending") : "none"}
                      className={`px-2.5 py-2 border-b border-borde text-[11px] font-semibold text-tinta-3 uppercase tracking-wide whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                    >
                      <button type="button" onClick={() => ordenarPor(c.clave)} className="uppercase tracking-wide hover:text-brand-navy">
                        {c.titulo}
                        {activa ? (orden.dir === -1 ? " ▾" : " ▴") : ""}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {matriz.areas
                .slice()
                .sort(comparar)
                .map((g) => {
                  const abierta = abiertas.has(g.area) || area === g.area;
                  return (
                    <Fragment key={g.area}>
                      <tr
                        className="border-b border-[#E7ECF3] font-semibold cursor-pointer hover:bg-brand-blue-soft-2"
                        onClick={() => alternar(g.area)}
                      >
                        <td className="px-2.5 py-1.5 text-left whitespace-nowrap">
                          <button
                            type="button"
                            aria-expanded={abierta}
                            onClick={(e) => {
                              e.stopPropagation();
                              alternar(g.area);
                            }}
                            className="inline-flex items-center font-semibold"
                          >
                            <span className="inline-block w-4 text-tinta-3" aria-hidden="true">{abierta ? "▾" : "▸"}</span>
                            <span className="inline-block w-2.5 h-2.5 rounded-[3px] mr-2" style={{ background: colorArea(g.area, areas) }} aria-hidden="true" />
                            {g.area}
                          </button>{" "}
                          <span className="font-normal text-tinta-3">
                            · {g.servicios.length} {g.servicios.length === 1 ? "servicio" : "servicios"}
                          </span>
                        </td>
                        <Celdas f={g} rInas={rInas} rDisp={rDisp} />
                      </tr>
                      {abierta &&
                        g.servicios
                          .slice()
                          .sort(comparar)
                          .map((s) => (
                            <tr
                              key={s.codigo}
                              className="border-b border-[#E7ECF3] cursor-pointer hover:bg-brand-blue-soft-2"
                              onClick={() => onServicio(s.codigo)}
                              title="Filtrar por este servicio"
                            >
                              <td className="pl-[34px] pr-2.5 py-1.5 text-left text-tinta-2 whitespace-nowrap">
                                {s.codigo} · {s.nombre}
                              </td>
                              <Celdas f={s} rInas={rInas} rDisp={rDisp} />
                            </tr>
                          ))}
                    </Fragment>
                  );
                })}
              {matriz.total && (
                <tr className="font-bold bg-surface-alt border-t-2 border-borde">
                  <td className="px-2.5 py-1.5 text-left whitespace-nowrap">Total {etiquetaPeriodo}</td>
                  <Celdas f={matriz.total} rInas={rInas} rDisp={rDisp} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
