"use client";

import { useState } from "react";
import { Grafico } from "@/components/productividad/Grafico";
import type { ResultadoAlertas, SerieProyectada } from "@/lib/inteligencia/alertas";
import { opcionesProyeccion } from "@/lib/inteligencia/graficaProyeccion";
import type { Direccion } from "@/lib/inteligencia/proyeccion";
import { colorArea, fmtNumero, fmtPct } from "@/lib/productividad/presentacion";

const DIRECCION: Record<Direccion, { flecha: string; texto: string; clase: string }> = {
  sube: { flecha: "▲", texto: "Sube", clase: "text-critico" },
  baja: { flecha: "▼", texto: "Baja", clase: "text-bien" },
  estable: { flecha: "▬", texto: "Estable", clase: "text-tinta-3" },
};

function CeldaDireccion({ d }: { d: Direccion }) {
  const e = DIRECCION[d];
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${e.clase}`}>
      <span aria-hidden>{e.flecha}</span>
      <span>{e.texto}</span>
    </span>
  );
}

function EstadoMeta({ sobre }: { sobre: boolean }) {
  return sobre ? (
    <span className="inline-flex items-center gap-1 text-critico font-medium">
      <svg data-testid="icono-meta-sobre" aria-hidden viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="8" cy="8" r="6.3" />
        <path d="M8 4.8v3.6" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="11" r=".8" fill="currentColor" stroke="none" />
      </svg>
      Sobre la meta
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-bien font-medium">
      <svg data-testid="icono-meta-bajo" aria-hidden viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.3" strokeWidth="1.4" />
        <path d="M5.3 8.2l1.9 1.9 3.6-3.8" />
      </svg>
      Bajo la meta
    </span>
  );
}

/** Proyección descendente; las series sin proyección al final. */
export function ordenarPorProyeccion(filas: readonly SerieProyectada[]): SerieProyectada[] {
  return [...filas].sort(
    (a, b) => (b.inasistencia?.valor ?? -1) - (a.inasistencia?.valor ?? -1) || a.nombre.localeCompare(b.nombre, "es")
  );
}

function Tabla({ titulo, filas, meta, conArea }: { titulo: string; filas: readonly SerieProyectada[]; meta: number; conArea?: boolean }) {
  if (filas.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="tabla tabla-compacta">
        <caption className="sr-only">{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">{conArea ? "Servicio" : "Área"}</th>
            <th scope="col" className="text-right">Último</th>
            <th scope="col" className="text-right">Proyección</th>
            <th scope="col" className="text-left">Rango</th>
            <th scope="col" className="text-left">Tendencia</th>
            <th scope="col" className="text-left">Frente a la meta</th>
            <th scope="col" className="text-right">Asignadas proy.</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((s) => {
            const p = s.inasistencia;
            const ultimo = s.historia[s.historia.length - 1]?.valor ?? null;
            return (
              <tr key={s.id}>
                <th scope="row" className="text-left font-medium text-tinta">
                  {s.nombre}
                  {conArea && s.area && <span className="block text-[11px] font-normal text-tinta-3">{s.area}</span>}
                </th>
                <td className="text-right tabular-nums text-tinta-2">{fmtPct(ultimo)}</td>
                {p ? (
                  <>
                    <td className="text-right tabular-nums font-semibold text-primario">{fmtPct(p.valor)}</td>
                    <td className="text-left tabular-nums text-tinta-3 whitespace-nowrap">{`${fmtPct(p.min)}–${fmtPct(p.max)}`}</td>
                    <td className="text-left"><CeldaDireccion d={p.direccion} /></td>
                    <td className="text-left">
                      <EstadoMeta sobre={p.valor > meta} />
                    </td>
                    <td className="text-right tabular-nums text-tinta-2">{s.asignadas ? fmtNumero(s.asignadas.valor) : "—"}</td>
                  </>
                ) : (
                  <td colSpan={5} className="text-left text-tinta-3 italic">Sin datos suficientes</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Resumen de la proyección del siguiente periodo: tabla por área ordenada de
 * mayor a menor; las mini gráficas y los servicios principales, al expandir.
 */
export function PanelProyeccion({
  areas,
  servicios,
  siguiente,
  meta,
  minPeriodos,
  periodosCargados,
}: {
  areas: readonly SerieProyectada[];
  servicios: readonly SerieProyectada[];
  siguiente: ResultadoAlertas["siguiente"];
  meta: number;
  minPeriodos: number;
  periodosCargados: number;
}) {
  const [expandida, setExpandida] = useState(false);
  const nombresAreas = areas.map((a) => a.id);
  const conProyeccion = areas.filter((a) => a.inasistencia);
  const hayMas = (siguiente !== null && conProyeccion.length > 0) || servicios.length > 0;
  return (
    <section aria-labelledby="titulo-proyeccion" className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-4 space-y-4">
      <div>
        <h2 id="titulo-proyeccion" className="font-titulo text-[15px] font-bold text-tinta">
          Proyección para {siguiente?.etiqueta_larga ?? "el siguiente periodo"}
        </h2>
        <p className="text-xs text-tinta-3 mt-0.5">
          % de inasistencia: promedio ponderado de los últimos periodos (hasta 6) más su tendencia lineal. El rango es ± el
          error medio que tuvo el mismo método al pronosticar periodos ya conocidos. Meta {fmtPct(meta, 0)}.
        </p>
        {periodosCargados < minPeriodos && (
          <p className="text-xs text-atencion bg-atencion-suave rounded-control px-3 py-2 mt-2">
            Hay {periodosCargados} periodos cargados; la proyección necesita al menos {minPeriodos}.
          </p>
        )}
      </div>

      <Tabla titulo="Proyección por área" filas={ordenarPorProyeccion(areas)} meta={meta} />

      {hayMas && (
        <button
          type="button"
          aria-expanded={expandida}
          aria-controls="proyeccion-detalle"
          onClick={() => setExpandida((v) => !v)}
          className="text-xs font-semibold text-primario underline"
        >
          {expandida ? "Ocultar gráficas y servicios" : "Ver gráficas y servicios"}
        </button>
      )}

      {expandida && (
        <div id="proyeccion-detalle" className="space-y-4">
          {siguiente && conProyeccion.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {conProyeccion.map((a) => (
                <figure key={a.id} className="rounded-control border border-borde p-2">
                  <figcaption className="text-xs font-semibold text-primario px-1">{a.nombre}</figcaption>
                  <Grafico
                    etiqueta={`Proyección de inasistencia: ${a.nombre}`}
                    opcion={opcionesProyeccion(a, siguiente, meta, colorArea(a.id, nombresAreas))}
                    className="h-36 w-full"
                  />
                </figure>
              ))}
            </div>
          )}

          {servicios.length > 0 && (
            <div>
              <h3 className="font-titulo text-sm font-bold text-tinta mb-1">Servicios con más citas asignadas</h3>
              <Tabla titulo="Proyección por servicio" filas={servicios} meta={meta} conArea />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
