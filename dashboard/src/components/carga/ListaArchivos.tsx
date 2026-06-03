"use client";

import { LogCarga } from "@/types/carga";
import { BadgeEstado } from "@/components/ui/Badge";

interface Props {
  cargas: LogCarga[];
  onVerInforme: (jobId: string) => void;
}

function fmtPeriodo(p: number | null): string {
  if (!p) return "—";
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const anio = Math.floor(p / 100);
  const mes = (p % 100) - 1;
  return `${meses[mes]} ${anio}`;
}

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ListaArchivos({ cargas, onVerInforme }: Props) {
  if (cargas.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
        No hay cargas registradas aún.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-brand-navy">
          <tr>
            {["Archivo","Período","Filas arch.","Insertadas","Estado","Fecha carga","Usuario",""].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {cargas.map((c, idx) => {
            // filas_en_archivo puede ser 0 si el job fue creado por el API antes de leer
            const filasArch = c.filas_en_archivo > 0 ? c.filas_en_archivo : (c.filas_insertadas ?? 0);
            return (
              <tr key={c.job_id}
                className={`${idx % 2 === 0 ? "bg-white" : "bg-surface-alt"} hover:bg-brand-blue-soft-2 transition-colors`}
              >
                <td className="px-4 py-3 max-w-[200px]">
                  <span className="block truncate font-medium text-gray-800 text-sm" title={c.nombre_archivo}>
                    {c.nombre_archivo}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {fmtPeriodo(c.periodo_detectado)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 tabular-nums">
                  {filasArch > 0 ? filasArch.toLocaleString("es-CO") : "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-brand-green">
                  {c.filas_insertadas > 0 ? c.filas_insertadas.toLocaleString("es-CO") : "—"}
                </td>
                <td className="px-4 py-3">
                  <BadgeEstado estado={c.estado} />
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {fmtFecha(c.cargado_en)}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {c.cargado_por ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onVerInforme(c.job_id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap text-brand-navy bg-brand-blue-soft hover:bg-brand-navy hover:text-white transition-colors"
                  >
                    Ver informe
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
