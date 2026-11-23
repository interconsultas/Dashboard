"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PROGRAMAS_META, etiquetaPrograma } from "@/lib/cumplimiento/categorias";
import { SkeletonTable } from "@/components/ui/SkeletonCard";
import { ErrorState } from "@/components/layout/ErrorState";
import { usePuedeEditar } from "@/components/layout/RolContext";
import { EncabezadoPagina } from "@/components/layout/EncabezadoPagina";
import { clasesBoton } from "@/components/ui/Boton";

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
  // Dirección médica consulta; solo admin edita (PUT /api/admin/metas/programas es solo admin)
  const editable = usePuedeEditar("metas");
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
      <EncabezadoPagina
        migas={[{ etiqueta: "Administración" }, { etiqueta: "Metas", href: "/admin/metas" }, { etiqueta: "Programas por especialidad" }]}
        titulo="Programas por especialidad"
        subtitulo={
          <>
            Programa de metas que se aplica a cada programa / especialidad de los profesionales
            {!editable && <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold">Solo lectura</span>}
          </>
        }
        acciones={
          <>
            {editable && (
              <button
                type="button"
                onClick={handleGuardar}
                disabled={saving || !hayCambios}
                className={clasesBoton({ variante: "secundario" })}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            )}
          </>
        }
      />

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
            <p className="text-xs text-critico bg-critico-suave border border-critico/30 rounded-control px-3 py-2">
              {error}
            </p>
          )}
          {exito && (
            <p className="text-xs text-bien bg-bien-suave border border-bien/30 rounded-control px-3 py-2">
              {exito}
            </p>
          )}

          <div className="overflow-x-auto bg-superficie rounded-tarjeta border border-borde shadow-tarjeta">
            <table className="tabla tabla-texto">
              <thead>
                <tr>
                  {["Programa / Especialidad", "Profesionales", "Programa de metas"].map((h) => (
                    <th
                      key={h}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.mapeo.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center !py-10 text-tinta-3">
                      No hay especialidades registradas
                    </td>
                  </tr>
                )}
                {data.mapeo.map((f) => {
                  const valor = seleccion[f.programa_especialidad] ?? "";
                  return (
                    <tr key={f.programa_especialidad}>
                      <td className="font-medium text-tinta">
                        {f.programa_especialidad}
                      </td>
                      <td className="text-tinta-3 tabular-nums">{f.profesionales}</td>
                      <td>
                        <select
                          className={`w-full max-w-md border rounded-control px-3 py-1.5 text-sm focus:outline-none ${
                            valor ? "border-borde text-tinta-2" : "border-atencion/30 text-atencion"
                          }`}
                          aria-label={`Programa de metas de ${f.programa_especialidad}`}
                          value={valor}
                          disabled={!editable}
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
          <p className="text-xs text-tinta-3">
            Las mayúsculas y los espacios al inicio o al final no importan. «Sin meta»: los
            profesionales de esa especialidad no tienen porcentaje de cumplimiento y no afectan el
            ranking ni el global.
          </p>
        </>
      )}
    </div>
  );
}
