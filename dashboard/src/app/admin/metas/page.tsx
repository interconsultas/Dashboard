"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  CATEGORIAS,
  PROGRAMAS_EDITABLES,
  PROGRAMA_TOTAL_MGI,
  etiquetaPrograma,
} from "@/lib/cumplimiento/categorias";
import { celdaValida } from "@/lib/cumplimiento/metas-matriz";
import { fmtDecimal, parseDecimal } from "@/lib/cumplimiento/decimal";
import { parseAnio } from "@/lib/cumplimiento/periodo";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SkeletonTable } from "@/components/ui/SkeletonCard";
import { ErrorState } from "@/components/layout/ErrorState";
import { usePuedeEditar } from "@/components/layout/RolContext";
import { EncabezadoPagina } from "@/components/layout/EncabezadoPagina";
import { clasesBoton } from "@/components/ui/Boton";
import { CLASES_CAMPO, cx } from "@/components/ui/clases";

interface Meta {
  programa: string;
  tipo_prestacion: string;
  valor_meta: number;
  escala: string;
}

interface RespuestaMetas {
  anio: number;
  anios: number[];
  metas: Meta[];
}

/** Texto de cada celda de la matriz, indexado por programa y categoría. */
type Valores = Record<string, string>;

function claveCelda(programa: string, categoria: string) {
  return `${programa}|${categoria}`;
}

function aValores(metas: Meta[]): Valores {
  const valores: Valores = {};
  metas.forEach((m) => {
    valores[claveCelda(m.programa, m.tipo_prestacion)] = fmtDecimal(m.valor_meta);
  });
  return valores;
}

// Filas en el orden de la hoja METAS: TOTAL MGI (informativa) y los programas
const CELDAS = PROGRAMAS_EDITABLES.flatMap((programa) =>
  CATEGORIAS.map((c) => ({ programa, categoria: c.clave, clave: claveCelda(programa, c.clave) }))
);

export default function MetasPage() {
  // Dirección médica consulta; solo admin edita (PUT /api/admin/metas es solo admin)
  const editable = usePuedeEditar("metas");
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [anioPendiente, setAnioPendiente] = useState<number | null>(null);
  const [agregandoAnio, setAgregandoAnio] = useState(false);
  const [anioNuevo, setAnioNuevo] = useState("");
  const [valores, setValores] = useState<Valores>({});
  const [saving, setSaving] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [aviso, setAviso] = useState("");

  // Sin revalidar al enfocar: la matriz no debe recargarse mientras se edita
  const {
    data,
    error: errorCarga,
    isLoading,
    mutate,
  } = useSWR<RespuestaMetas>(`/api/admin/metas?anio=${anio}`, fetcher, {
    revalidateOnFocus: false,
  });

  const originales = useMemo(() => aValores(data?.metas ?? []), [data]);

  // Cada vez que llegan datos del servidor la matriz vuelve a lo guardado
  useEffect(() => {
    setValores(originales);
  }, [originales]);

  const anios = useMemo(() => {
    const actual = new Date().getFullYear();
    const set = new Set([anio, actual, actual + 1, ...(data?.anios ?? [])]);
    return Array.from(set).sort((a, b) => b - a);
  }, [anio, data]);

  // Se compara el número, no el texto: "2.5" y "2,5" son la misma meta.
  // Un texto no numérico (NaN) siempre cuenta como cambio.
  const cambiadas = CELDAS.filter(
    (c) => parseDecimal(valores[c.clave] ?? "") !== parseDecimal(originales[c.clave] ?? "")
  );
  const hayCambios = cambiadas.length > 0;
  // Un programa sin metas (celdas vacías) es válido: sus profesionales quedan sin porcentaje
  const hayInvalidas = CELDAS.some((c) => !celdaValida(valores[c.clave], originales[c.clave]));
  const sinDatos = !!data && data.metas.length === 0;

  function irAAnio(nuevo: number) {
    setAnio(nuevo);
    setAnioPendiente(null);
    setError("");
    setExito("");
    setAviso("");
  }

  function cambiarAnio(nuevo: number) {
    if (nuevo === anio) return;
    if (hayCambios) {
      setAnioPendiente(nuevo);
      return;
    }
    irAAnio(nuevo);
  }

  // El año agregado queda en el selector mientras esté seleccionado;
  // solo se conserva después si se guardan metas para él.
  function agregarAnio(e: React.FormEvent) {
    e.preventDefault();
    const nuevo = parseAnio(anioNuevo.trim());
    if (nuevo === null) {
      setError("Ingrese un año entre 2000 y 2100.");
      return;
    }
    setAgregandoAnio(false);
    setAnioNuevo("");
    cambiarAnio(nuevo);
  }

  async function copiarAnioAnterior() {
    setError("");
    setAviso("");
    setExito("");
    setCopiando(true);
    try {
      const anterior = await fetcher<RespuestaMetas>(`/api/admin/metas?anio=${anio - 1}`);
      if (anterior.metas.length === 0) {
        setAviso(`No hay metas registradas para ${anio - 1}.`);
        return;
      }
      setValores(aValores(anterior.metas));
      setAviso(`Se copiaron las metas de ${anio - 1}. No se guardan hasta presionar «Guardar».`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron copiar las metas");
    } finally {
      setCopiando(false);
    }
  }

  async function handleGuardar() {
    setError("");
    setExito("");
    setAviso("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/metas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anio,
          metas: cambiadas.map((c) => ({
            programa: c.programa,
            tipo_prestacion: c.categoria,
            valor_meta: parseDecimal(valores[c.clave]),
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudieron guardar las metas");
        return;
      }
      await mutate();
      setExito(`Metas de ${anio} guardadas`);
    } catch {
      setError("No se pudieron guardar las metas");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        migas={[{ etiqueta: "Administración" }, { etiqueta: "Metas" }]}
        titulo="Metas"
        subtitulo={
          <>
            Metas de órdenes por programa y categoría — {anio}
            {!editable && <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold">Solo lectura</span>}
          </>
        }
        acciones={
          <>
            <Link href="/admin/metas/programas" className={clasesBoton({ variante: "secundario" })}>
              Programas por especialidad
            </Link>
            <div className="flex items-center gap-2">
              <select
                className={CLASES_CAMPO}
                aria-label="Año"
                value={anio}
                onChange={(e) => cambiarAnio(Number(e.target.value))}
              >
                {anios.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              {!editable ? null : agregandoAnio ? (
                <form onSubmit={agregarAnio} className="flex items-center gap-2">
                  <input
                    autoFocus
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Año"
                    aria-label="Año a agregar"
                    value={anioNuevo}
                    onChange={(e) => setAnioNuevo(e.target.value)}
                    className={cx(CLASES_CAMPO, "w-20")}
                  />
                  <button
                    type="submit"
                    className={clasesBoton({ variante: "secundario" })}
                  >
                    Agregar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAgregandoAnio(false);
                      setAnioNuevo("");
                    }}
                    className="px-2 py-2 text-sm font-semibold text-white/85 hover:text-white"
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAgregandoAnio(true)}
                  className={clasesBoton({ variante: "secundario" })}
                >
                  + Agregar año
                </button>
              )}
              {editable && (
                <button
                  type="button"
                  onClick={handleGuardar}
                  disabled={saving || !hayCambios || hayInvalidas}
                  className={clasesBoton({ variante: "secundario" })}
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              )}
            </div>
          </>
        }
      />

      {errorCarga && !data ? (
        <ErrorState
          error={errorCarga}
          reset={() => mutate()}
          titulo="No se pudieron cargar las metas"
        />
      ) : isLoading || !data ? (
        <SkeletonTable rows={PROGRAMAS_EDITABLES.length} />
      ) : (
        <>
          {sinDatos && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-superficie rounded-tarjeta border border-borde shadow-tarjeta px-5 py-4">
              <p className="text-sm text-tinta-2">
                No hay metas registradas para {anio}.
              </p>
              {editable && (
                <button
                  type="button"
                  onClick={copiarAnioAnterior}
                  disabled={copiando}
                  className="px-4 py-2 rounded-control text-sm font-semibold text-primario bg-primario-suave hover:bg-primario hover:text-white disabled:opacity-60 transition-colors"
                >
                  {copiando ? "Copiando…" : "Copiar metas del año anterior"}
                </button>
              )}
            </div>
          )}

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
          {aviso && (
            <p className="text-xs text-atencion bg-atencion-suave border border-atencion/30 rounded-control px-3 py-2">
              {aviso}
            </p>
          )}
          {hayCambios && hayInvalidas && (
            <p className="text-xs text-critico">
              Las metas deben ser números mayores que cero y una meta guardada no se puede dejar
              vacía.
            </p>
          )}

          {/* Matriz programa × categoría */}
          <div className="overflow-x-auto bg-superficie rounded-tarjeta border border-borde shadow-tarjeta">
            <table className="tabla tabla-texto">
              <thead>
                <tr>
                  <th>
                    Programa
                  </th>
                  {CATEGORIAS.map((c) => (
                    <th
                      key={c.clave}
                    >
                      {c.etiqueta}
                      <span className="block font-normal normal-case tracking-normal text-tinta-3">
                        {c.escala === "x100" ? "×100" : "por cita"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROGRAMAS_EDITABLES.map((programa) => (
                  <tr key={programa}>
                    <td className="font-medium text-tinta min-w-[14rem] max-w-xs">
                      {etiquetaPrograma(programa)}
                      {programa === PROGRAMA_TOTAL_MGI && (
                        <span className="block text-xs font-normal text-tinta-3">
                          Informativa: no se asigna a profesionales
                        </span>
                      )}
                    </td>
                    {CATEGORIAS.map((c) => {
                      const clave = claveCelda(programa, c.clave);
                      // Las celdas se validan en cuanto hay algún cambio en la matriz
                      const invalida =
                        hayCambios && !celdaValida(valores[clave], originales[clave]);
                      return (
                        <td key={c.clave} >
                          <input
                            className={`w-28 border rounded-control px-3 py-1.5 text-sm text-right text-tinta-2 focus:outline-none ${
                              invalida ? "border-critico bg-critico-suave" : "border-borde"
                            }`}
                            inputMode="decimal"
                            readOnly={!editable}
                            aria-label={`${etiquetaPrograma(programa)} — ${c.etiqueta}`}
                            aria-invalid={invalida}
                            value={valores[clave] ?? ""}
                            onChange={(e) => {
                              setValores((prev) => ({ ...prev, [clave]: e.target.value }));
                              setExito("");
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-tinta-3">
            «Por cita»: órdenes por cada cita atendida. «×100»: órdenes por cada 100 citas
            atendidas. Se acepta coma o punto como separador decimal. Un programa sin metas deja
            a sus profesionales sin porcentaje.
          </p>
        </>
      )}

      <ConfirmModal
        open={anioPendiente !== null}
        title="Cambios sin guardar"
        message={`Hay cambios sin guardar en las metas de ${anio}. Si cambia de año se perderán.`}
        confirmLabel="Descartar cambios"
        cancelLabel="Seguir editando"
        variant="destructive"
        onConfirm={() => anioPendiente !== null && irAAnio(anioPendiente)}
        onCancel={() => setAnioPendiente(null)}
      />
    </div>
  );
}
