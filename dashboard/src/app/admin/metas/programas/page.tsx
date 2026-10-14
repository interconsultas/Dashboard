"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PROGRAMAS_META, etiquetaPrograma } from "@/lib/cumplimiento/categorias";
import { SkeletonTable } from "@/components/ui/SkeletonCard";
import { ErrorState } from "@/components/layout/ErrorState";

interface FilaMapeo {
  programa_especialidad: string;
  programa: string | null;
  profesionales: number;
}

interface RespuestaMapeo {
  mapeo: FilaMapeo[];
}

/** Programa elegido por especialidad; vacío significa "Sin meta". */
type Seleccion = Record<string, string>;

function aSeleccion(mapeo: FilaMapeo[]): Seleccion {
  const seleccion: Seleccion = {};
  mapeo.forEach((f) => {
    seleccion[f.programa_especialidad] = f.programa ?? "";
  });
  return seleccion;
}

export default function ProgramasPorEspecialidadPage() {
  const [seleccion, setSeleccion] = useState<Seleccion>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  // Sin revalidar al enfocar: la tabla no debe recargarse mientras se edita
  const {
    data,
    error: errorCarga,
    isLoading,
    mutate,
  } = useSWR<RespuestaMapeo>("/api/admin/metas/programas", fetcher, {
    revalidateOnFocus: false,
  });

  const originales = useMemo(() => aSeleccion(data?.mapeo ?? []), [data]);

  // Cada vez que llegan datos del servidor la tabla vuelve a lo guardado
  useEffect(() => {
    setSeleccion(originales);
  }, [originales]);

  const cambiadas = (data?.mapeo ?? []).filter(
    (f) => (seleccion[f.programa_especialidad] ?? "") !== originales[f.programa_especialidad]
  );
  const hayCambios = cambiadas.length > 0;

  async function handleGuardar() {
    setError("");
    setExito("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/metas/programas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapeo: cambiadas.map((f) => ({
            programa_especialidad: f.programa_especialidad,
            programa: seleccion[f.programa_especialidad] || null,
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudo guardar el mapeo");
        return;
      }
      await mutate();
      setExito("Mapeo guardado");
    } catch {
      setError("No se pudo guardar el mapeo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Programas por especialidad</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Programa de metas que se aplica a cada programa / especialidad de los profesionales
          </p>
          <Link
            href="/admin/metas"
            className="inline-block mt-1 text-xs font-semibold text-brand-navy underline"
          >
            Volver a Metas
          </Link>
        </div>
        <button
          type="button"
          onClick={handleGuardar}
          disabled={saving || !hayCambios}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-navy-dark disabled:opacity-60 transition-colors"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {errorCarga && !data ? (
        <ErrorState
          error={errorCarga}
          reset={() => mutate()}
          titulo="No se pudo cargar el mapeo de programas"
        />
      ) : isLoading || !data ? (
        <SkeletonTable rows={8} />
      ) : (
        <>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {exito && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {exito}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-brand-navy">
                <tr>
                  {["Programa / Especialidad", "Profesionales", "Programa de metas"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data.mapeo.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-10 text-gray-400">
                      No hay especialidades registradas
                    </td>
                  </tr>
                )}
                {data.mapeo.map((f, idx) => {
                  const valor = seleccion[f.programa_especialidad] ?? "";
                  return (
                    <tr
                      key={f.programa_especialidad}
                      className={idx % 2 === 0 ? "bg-white" : "bg-surface-alt"}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {f.programa_especialidad}
                      </td>
                      <td className="px-4 py-3 text-gray-500 tabular-nums">{f.profesionales}</td>
                      <td className="px-4 py-2">
                        <select
                          className={`w-full max-w-md border rounded-lg px-3 py-1.5 text-sm focus:outline-none ${
                            valor ? "border-gray-200 text-gray-700" : "border-amber-200 text-amber-700"
                          }`}
                          aria-label={`Programa de metas de ${f.programa_especialidad}`}
                          value={valor}
                          onChange={(e) => {
                            const programa = e.target.value;
                            setSeleccion((prev) => ({
                              ...prev,
                              [f.programa_especialidad]: programa,
                            }));
                            setExito("");
                          }}
                        >
                          <option value="">Sin meta</option>
                          {PROGRAMAS_META.map((p) => (
                            <option key={p} value={p}>
                              {etiquetaPrograma(p)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">
            Las mayúsculas y los espacios al inicio o al final no importan. «Sin meta»: los
            profesionales de esa especialidad no tienen porcentaje de cumplimiento y no afectan el
            ranking ni el global.
          </p>
        </>
      )}
    </div>
  );
}
