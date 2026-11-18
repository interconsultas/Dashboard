"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePuedeEditar } from "@/components/layout/RolContext";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { fmtPeriodo } from "@/lib/periodo";
import { fmtNumero } from "@/lib/citas/detalle";
import type { AreasServicio, CambioArea } from "@/lib/citas/areas";
import { SkeletonTable } from "@/components/ui/SkeletonCard";
import { ErrorState } from "@/components/layout/ErrorState";
import { EncabezadoPagina } from "@/components/layout/EncabezadoPagina";
import { clasesBoton } from "@/components/ui/Boton";

const API = "/api/admin/citas/areas";

/** Área elegida por código de servicio. */
type Seleccion = Record<string, string>;

export default function AreasServicioPage() {
  const [seleccion, setSeleccion] = useState<Seleccion>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  // Sin revalidar al enfocar: la tabla no debe recargarse mientras se edita
  // Con nivel 'ver' la página queda en solo consulta (la API rechaza las escrituras)
  const editable = usePuedeEditar("citas");
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
      <EncabezadoPagina
        migas={[{ etiqueta: "Administración" }, { etiqueta: "Citas", href: "/admin/citas" }, { etiqueta: "Áreas de servicio" }]}
        titulo="Áreas de servicio"
        subtitulo="Área de productividad a la que pertenece cada servicio de Agenda Web"
        acciones={
          <>
            {editable ? (
              <button
                type="button"
                onClick={() => guardar(cambiados, "Áreas guardadas")}
                disabled={saving || !hayCambios}
                className={clasesBoton({ variante: "secundario" })}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            ) : (
              <p className="text-xs text-tinta-3 bg-superficie-2 border border-borde rounded-control px-3 py-2">
                Solo consulta: no puede cambiar las áreas.
              </p>
            )}
          </>
        }
      />

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
                  {[
                    "Código",
                    "Servicio",
                    `Asignadas ${fmtPeriodo(data.periodo)}`,
                    "Área",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.servicios.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center !py-10 text-tinta-3">
                      No hay servicios cargados
                    </td>
                  </tr>
                )}
                {data.servicios.map((f) => (
                  <tr key={f.codigo_servicio}>
                    <td className="text-tinta-3 tabular-nums">{f.codigo_servicio}</td>
                    <td className="font-medium text-tinta">{f.nombre_servicio}</td>
                    <td className="text-tinta-3 tabular-nums">
                      {fmtNumero(f.asignadas)}
                    </td>
                    <td>
                      <select
                        className="w-full max-w-xs border border-borde rounded-control px-3 py-1.5 text-sm text-tinta-2 focus:outline-none"
                        aria-label={`Área de ${f.nombre_servicio}`}
                        value={seleccion[f.codigo_servicio] ?? f.area}
                        disabled={!editable}
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
                        <p className="text-xs text-atencion mt-1">
                          Editada · regla: {f.area_regla}
                        </p>
                      )}
                    </td>
                    <td>
                      {editable && f.area_editada && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            guardar(
                              [{ codigo_servicio: f.codigo_servicio, area: null }],
                              `${f.nombre_servicio}: área restablecida a la regla`
                            )
                          }
                          className="text-xs font-semibold text-primario underline whitespace-nowrap disabled:opacity-60"
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
          <p className="text-xs text-tinta-3">
            Los servicios nuevos reciben el área según su nombre. Un área elegida aquí queda fija:
            las cargas siguientes no la cambian. «Restablecer a la regla» vuelve a la asignación
            automática.
          </p>
        </>
      )}
    </div>
  );
}
