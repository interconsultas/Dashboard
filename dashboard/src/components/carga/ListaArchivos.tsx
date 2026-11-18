"use client";

import { useState } from "react";
import { LogCarga } from "@/types/carga";
import { BadgeEstado } from "@/components/ui/Badge";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { fmtPeriodos } from "@/lib/periodo";

interface Props {
  cargas: LogCarga[];
  onVerInforme: (jobId: string) => void;
  onEliminado: () => void;
  /** false en solo consulta: oculta Eliminar. */
  puedeEliminar?: boolean;
}

const ESTADOS_ELIMINABLES = new Set(["exitoso", "exitoso_con_advertencias"]);

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ListaArchivos({ cargas, onVerInforme, onEliminado, puedeEliminar = true }: Props) {
  const [jobAEliminar, setJobAEliminar] = useState<LogCarga | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  async function confirmarEliminar() {
    if (!jobAEliminar) return;
    setEliminando(true);
    setErrorEliminar(null);
    try {
      const res = await fetch(`/api/carga/${jobAEliminar.job_id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo eliminar la carga");
      }
      setJobAEliminar(null);
      onEliminado();
    } catch (e) {
      setErrorEliminar(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setEliminando(false);
    }
  }

  if (cargas.length === 0) {
    return (
      <div className="text-center py-12 text-tinta-3 text-sm bg-superficie rounded-tarjeta border border-borde shadow-tarjeta">
        No hay cargas registradas aún.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-superficie rounded-tarjeta border border-borde shadow-tarjeta">
      <table className="tabla tabla-texto">
        <thead>
          <tr>
            {["Archivo","Período","Filas arch.","Insertadas","Estado","Fecha carga","Usuario",""].map(h => (
              <th key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cargas.map((c) => {
            // filas_en_archivo puede ser 0 si el job fue creado por el API antes de leer
            const filasArch = c.filas_en_archivo > 0 ? c.filas_en_archivo : (c.filas_insertadas ?? 0);
            return (
              <tr key={c.job_id}>
                <td className="max-w-[420px]">
                  <span className="block truncate font-medium text-tinta text-sm" title={c.nombre_archivo}>
                    {c.nombre_archivo}
                  </span>
                </td>
                <td className="text-tinta-2 whitespace-nowrap">
                  {fmtPeriodos(c.periodos_detectados, c.periodo_detectado)}
                </td>
                <td className="text-right text-tinta-3 tabular-nums">
                  {filasArch > 0 ? filasArch.toLocaleString("es-CO") : "—"}
                </td>
                <td className="text-right font-semibold tabular-nums text-bien">
                  {c.filas_insertadas > 0 ? c.filas_insertadas.toLocaleString("es-CO") : "—"}
                </td>
                <td>
                  <BadgeEstado estado={c.estado} />
                </td>
                <td className="text-tinta-3 whitespace-nowrap text-xs">
                  {fmtFecha(c.cargado_en)}
                </td>
                <td className="text-tinta-3 text-xs">
                  {c.cargado_por ?? "—"}
                </td>
                <td className="text-right space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => onVerInforme(c.job_id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-control whitespace-nowrap text-primario bg-primario-suave hover:bg-primario hover:text-white transition-colors"
                  >
                    Ver informe
                  </button>
                  {puedeEliminar && ESTADOS_ELIMINABLES.has(c.estado) && (
                    <button
                      onClick={() => {
                        setErrorEliminar(null);
                        setJobAEliminar(c);
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-control whitespace-nowrap text-critico bg-critico-suave hover:bg-critico/90 hover:text-white transition-colors"
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmModal
        open={jobAEliminar !== null}
        title="Eliminar carga"
        message={
          <>
            Esta acción eliminará todas las filas cargadas de{" "}
            <strong>{jobAEliminar?.nombre_archivo}</strong>
            {" "}({fmtPeriodos(jobAEliminar?.periodos_detectados, jobAEliminar?.periodo_detectado ?? null)}) y no se puede deshacer.
            {errorEliminar && <p className="mt-2 text-critico">{errorEliminar}</p>}
          </>
        }
        confirmLabel="Eliminar"
        variant="destructive"
        loading={eliminando}
        onConfirm={confirmarEliminar}
        onCancel={() => {
          if (!eliminando) setJobAEliminar(null);
        }}
      />
    </div>
  );
}
