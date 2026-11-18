"use client";

import { Grafico } from "@/components/productividad/Grafico";
import type { ResultadoAlertas, SerieProyectada } from "@/lib/inteligencia/alertas";
import { opcionesProyeccion } from "@/lib/inteligencia/graficaProyeccion";
import type { Direccion } from "@/lib/inteligencia/proyeccion";
import { colorArea, fmtNumero, fmtPct } from "@/lib/productividad/presentacion";

const DIRECCION: Record<Direccion, { flecha: string; texto: string; clase: string }> = {
  sube: { flecha: "▲", texto: "Sube", clase: "text-red-700" },
  baja: { flecha: "▼", texto: "Baja", clase: "text-emerald-700" },
  estable: { flecha: "▬", texto: "Estable", clase: "text-gray-500" },
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

function Tabla({ titulo, filas, meta, conArea }: { titulo: string; filas: readonly SerieProyectada[]; meta: number; conArea?: boolean }) {
  if (filas.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{titulo}</caption>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
            <th scope="col" className="py-2 pr-3 font-semibold">{conArea ? "Servicio" : "Área"}</th>
            <th scope="col" className="py-2 pr-3 font-semibold text-right">Último</th>
            <th scope="col" className="py-2 pr-3 font-semibold text-right">Proyección</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Rango</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Tendencia</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Frente a la meta</th>
            <th scope="col" className="py-2 font-semibold text-right">Asignadas proy.</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((s) => {
            const p = s.inasistencia;
            const ultimo = s.historia[s.historia.length - 1]?.valor ?? null;
            return (
              <tr key={s.id} className="border-b border-gray-50 last:border-0">
                <th scope="row" className="py-2 pr-3 font-medium text-brand-navy text-left">
                  {s.nombre}
                  {conArea && s.area && <span className="block text-[11px] font-normal text-gray-400">{s.area}</span>}
                </th>
                <td className="py-2 pr-3 text-right tabular-nums text-gray-600">{fmtPct(ultimo)}</td>
                {p ? (
                  <>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold text-brand-navy">{fmtPct(p.valor)}</td>
                    <td className="py-2 pr-3 tabular-nums text-gray-500 whitespace-nowrap">{`${fmtPct(p.min)}–${fmtPct(p.max)}`}</td>
                    <td className="py-2 pr-3"><CeldaDireccion d={p.direccion} /></td>
                    <td className="py-2 pr-3">
                      {p.valor > meta ? (
                        <span className="text-red-700 font-medium">Sobre la meta</span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Bajo la meta</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-600">{s.asignadas ? fmtNumero(s.asignadas.valor) : "—"}</td>
                  </>
                ) : (
                  <td colSpan={5} className="py-2 text-gray-400 italic">Sin datos suficientes</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Proyección del siguiente periodo por área (tabla + mini gráficas) y por servicio principal. */
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
  const nombresAreas = areas.map((a) => a.id);
  const conProyeccion = areas.filter((a) => a.inasistencia);
  return (
    <section aria-labelledby="titulo-proyeccion" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
      <div>
        <h2 id="titulo-proyeccion" className="text-base font-semibold text-brand-navy">
          Proyección para {siguiente?.etiqueta_larga ?? "el siguiente periodo"}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          % de inasistencia: promedio ponderado de los últimos periodos (hasta 6) más su tendencia lineal. El rango es ± el
          error medio que tuvo el mismo método al pronosticar periodos ya conocidos. Meta {fmtPct(meta, 0)}.
        </p>
        {periodosCargados < minPeriodos && (
          <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-2">
            Hay {periodosCargados} periodos cargados; la proyección necesita al menos {minPeriodos}.
          </p>
        )}
      </div>

      <Tabla titulo="Proyección por área" filas={areas} meta={meta} />

      {siguiente && conProyeccion.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {conProyeccion.map((a) => (
            <figure key={a.id} className="rounded-xl border border-gray-100 p-2">
              <figcaption className="text-xs font-semibold text-brand-navy px-1">{a.nombre}</figcaption>
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
          <h3 className="text-sm font-semibold text-brand-navy mb-1">Servicios con más citas asignadas</h3>
          <Tabla titulo="Proyección por servicio" filas={servicios} meta={meta} conArea />
        </div>
      )}
    </section>
  );
}
