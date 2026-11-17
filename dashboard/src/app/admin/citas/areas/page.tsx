"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { fmtPeriodo } from "@/lib/periodo";
import { fmtNumero } from "@/lib/citas/detalle";
import type { AreasServicio, CambioArea } from "@/lib/citas/areas";
import { SkeletonTable } from "@/components/ui/SkeletonCard";
import { ErrorState } from "@/components/layout/ErrorState";

const API = "/api/admin/citas/areas";

/** Área elegida por código de servicio. */
type Seleccion = Record<string, string>;

export default function AreasServicioPage() {
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
  } = useSWR<AreasServicio>(API, fetcher, { revalidateOnFocus: false });

  const originales = useMemo(() => {
    const s: Seleccion = {};
    (data?.servicios ?? []).forEach((f) => {
      s[f.codigo_servicio] = f.area;
    });
    return s;
  }, [data]);

  // Cada vez que llegan datos del servidor la tabla vuelve a lo guardado
  useEffect(() => {
    setSeleccion(originales);
  }, [originales]);

  const cambiados: CambioArea[] = (data?.servicios ?? [])
    .filter((f) => seleccion[f.codigo_servicio] !== originales[f.codigo_servicio])
    .map((f) => ({ codigo_servicio: f.codigo_servicio, area: seleccion[f.codigo_servicio] }));
  const hayCambios = cambiados.length > 0;

  async function guardar(cambios: CambioArea[], mensaje: string) {
    setError("");
    setExito("");
    setSaving(true);
    try {
      const res = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cambios }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudieron guardar las áreas");
        return;
      }
      await mutate();
      setExito(mensaje);
    } catch {
      setError("No se pudieron guardar las áreas");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Áreas de servicio</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Área de productividad a la que pertenece cada servicio de Agenda Web
          </p>
          <Link
            href="/admin/citas"
            className="inline-block mt-1 text-xs font-semibold text-brand-navy underline"
          >
            Volver a Citas
          </Link>
        </div>
        <button
          type="button"
          onClick={() => guardar(cambiados, "Áreas guardadas")}
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
          titulo="No se pudieron cargar las áreas de servicio"
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
                  {[
                    "Código",
                    "Servicio",
                    `Asignadas ${fmtPeriodo(data.periodo)}`,
                    "Área",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data.servicios.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-400">
                      No hay servicios cargados
                    </td>
                  </tr>
                )}
                {data.servicios.map((f, idx) => (
                  <tr
                    key={f.codigo_servicio}
                    className={idx % 2 === 0 ? "bg-white" : "bg-surface-alt"}
                  >
                    <td className="px-4 py-3 text-gray-500 tabular-nums">{f.codigo_servicio}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{f.nombre_servicio}</td>
                    <td className="px-4 py-3 text-gray-500 tabular-nums">
                      {fmtNumero(f.asignadas)}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none"
                        aria-label={`Área de ${f.nombre_servicio}`}
                        value={seleccion[f.codigo_servicio] ?? f.area}
                        onChange={(e) => {
                          const area = e.target.value;
                          setSeleccion((prev) => ({ ...prev, [f.codigo_servicio]: area }));
                          setExito("");
                        }}
                      >
                        {data.areas.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                      {f.area_editada && (
                        <p className="text-xs text-amber-700 mt-1">
                          Editada · regla: {f.area_regla}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {f.area_editada && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            guardar(
                              [{ codigo_servicio: f.codigo_servicio, area: null }],
                              `${f.nombre_servicio}: área restablecida a la regla`
                            )
                          }
                          className="text-xs font-semibold text-brand-navy underline whitespace-nowrap disabled:opacity-60"
                        >
                          Restablecer a la regla
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">
            Los servicios nuevos reciben el área según su nombre. Un área elegida aquí queda fija:
            las cargas siguientes no la cambian. «Restablecer a la regla» vuelve a la asignación
            automática.
          </p>
        </>
      )}
    </div>
  );
}
