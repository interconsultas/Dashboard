"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { CATEGORIAS, PROGRAMAS_META } from "@/lib/cumplimiento/categorias";
import { fmtDecimal, parseDecimal } from "@/lib/cumplimiento/decimal";
import { parseAnio } from "@/lib/cumplimiento/periodo";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SkeletonTable } from "@/components/ui/SkeletonCard";
import { ErrorState } from "@/components/layout/ErrorState";

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

/** Una celda es válida si contiene un número mayor que cero. */
function celdaValida(texto: string | undefined) {
  const n = parseDecimal(texto ?? "");
  return n !== null && !Number.isNaN(n) && n > 0;
}

const CELDAS = PROGRAMAS_META.flatMap((programa) =>
  CATEGORIAS.map((c) => ({ programa, categoria: c.clave, clave: claveCelda(programa, c.clave) }))
);

export default function MetasPage() {
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
  const hayInvalidas = CELDAS.some((c) => !celdaValida(valores[c.clave]));
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Metas</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Metas de órdenes por programa y categoría — {anio}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none"
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
          {agregandoAnio ? (
            <form onSubmit={agregarAnio} className="flex items-center gap-2">
              <input
                autoFocus
                inputMode="numeric"
                maxLength={4}
                placeholder="Año"
                aria-label="Año a agregar"
                value={anioNuevo}
                onChange={(e) => setAnioNuevo(e.target.value)}
                className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg text-sm font-semibold text-brand-navy border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Agregar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgregandoAnio(false);
                  setAnioNuevo("");
                }}
                className="px-2 py-2 text-sm text-gray-400 hover:text-gray-600"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAgregandoAnio(true)}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-brand-navy border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              + Agregar año
            </button>
          )}
          <button
            type="button"
            onClick={handleGuardar}
            disabled={saving || !hayCambios || hayInvalidas}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-navy-dark disabled:opacity-60 transition-colors"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {errorCarga && !data ? (
        <ErrorState
          error={errorCarga}
          reset={() => mutate()}
          titulo="No se pudieron cargar las metas"
        />
      ) : isLoading || !data ? (
        <SkeletonTable rows={5} />
      ) : (
        <>
          {sinDatos && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <p className="text-sm text-gray-600">
                No hay metas registradas para {anio}.
              </p>
              <button
                type="button"
                onClick={copiarAnioAnterior}
                disabled={copiando}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-brand-navy bg-brand-blue-soft hover:bg-brand-navy hover:text-white disabled:opacity-60 transition-colors"
              >
                {copiando ? "Copiando…" : "Copiar metas del año anterior"}
              </button>
            </div>
          )}

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
          {aviso && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {aviso}
            </p>
          )}
          {hayCambios && hayInvalidas && (
            <p className="text-xs text-red-600">
              Complete todas las celdas con un valor mayor que cero para poder guardar.
            </p>
          )}

          {/* Matriz programa × categoría */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-brand-navy">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap">
                    Programa
                  </th>
                  {CATEGORIAS.map((c) => (
                    <th
                      key={c.clave}
                      className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide"
                    >
                      {c.etiqueta}
                      <span className="block font-normal normal-case text-white/60">
                        {c.escala === "x100" ? "×100" : "por cita"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {PROGRAMAS_META.map((programa, idx) => (
                  <tr key={programa} className={idx % 2 === 0 ? "bg-white" : "bg-surface-alt"}>
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                      {programa}
                    </td>
                    {CATEGORIAS.map((c) => {
                      const clave = claveCelda(programa, c.clave);
                      // Las celdas se validan en cuanto hay algún cambio en la matriz
                      const invalida = hayCambios && !celdaValida(valores[clave]);
                      return (
                        <td key={c.clave} className="px-3 py-2">
                          <input
                            className={`w-28 border rounded-lg px-3 py-1.5 text-sm text-right text-gray-700 focus:outline-none ${
                              invalida ? "border-red-400 bg-red-50" : "border-gray-200"
                            }`}
                            inputMode="decimal"
                            aria-label={`${programa} — ${c.etiqueta}`}
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
          <p className="text-xs text-gray-400">
            «Por cita»: órdenes por cada cita atendida. «×100»: órdenes por cada 100 citas
            atendidas. Se acepta coma o punto como separador decimal.
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
