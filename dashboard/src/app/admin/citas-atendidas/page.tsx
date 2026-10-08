"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { fmtPeriodo } from "@/lib/periodo";
import { periodoAnterior } from "@/lib/cumplimiento/periodo";
import {
  cambiosPendientes,
  construirFilas,
  contarFilas,
  filtrarFilas,
  type Ediciones,
  type FilaCitasApi,
} from "@/lib/cumplimiento/grilla-citas";
import { GrillaCitas } from "@/components/cumplimiento/GrillaCitas";
import { ImportarCitasExcel } from "@/components/cumplimiento/ImportarCitasExcel";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SkeletonTable } from "@/components/ui/SkeletonCard";
import { ErrorState } from "@/components/layout/ErrorState";

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);
const ANIOS_HACIA_ATRAS = 3;

export default function CitasAtendidasPage() {
  const [periodo, setPeriodo] = useState(() => periodoAnterior(new Date()));
  const [periodoPendiente, setPeriodoPendiente] = useState<number | null>(null);
  const [ediciones, setEdiciones] = useState<Ediciones>({});
  const [busqueda, setBusqueda] = useState("");
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  // Sin revalidar al enfocar: la grilla no debe recargarse mientras se edita
  const {
    data,
    error: errorCarga,
    isLoading,
    mutate,
  } = useSWR<FilaCitasApi[]>(`/api/admin/citas-atendidas?periodo=${periodo}`, fetcher, {
    revalidateOnFocus: false,
  });

  const filas = useMemo(() => construirFilas(data ?? [], ediciones), [data, ediciones]);
  const listadas = useMemo(
    () => filtrarFilas(filas, { mostrarTodos, busqueda: "" }),
    [filas, mostrarTodos]
  );
  const visibles = useMemo(
    () => filtrarFilas(filas, { mostrarTodos, busqueda }),
    [filas, mostrarTodos, busqueda]
  );
  const contadores = useMemo(() => contarFilas(listadas), [listadas]);
  const cambios = useMemo(() => cambiosPendientes(filas), [filas]);

  const hayCambios = filas.some((f) => f.cambiada);
  const hayInvalidas = filas.some((f) => f.citasInvalida);

  const anios = useMemo(() => {
    const actual = new Date().getFullYear();
    const set = new Set([Math.floor(periodo / 100)]);
    for (let a = actual; a >= actual - ANIOS_HACIA_ATRAS; a--) set.add(a);
    return Array.from(set).sort((a, b) => b - a);
  }, [periodo]);

  function irAPeriodo(nuevo: number) {
    setPeriodo(nuevo);
    setEdiciones({});
    setPeriodoPendiente(null);
    setError("");
    setExito("");
  }

  function cambiarPeriodo(nuevo: number) {
    if (nuevo === periodo) return;
    if (hayCambios) {
      setPeriodoPendiente(nuevo);
      return;
    }
    irAPeriodo(nuevo);
  }

  function editar(documento: string, campo: "citas", valor: string) {
    setEdiciones((prev) => ({ ...prev, [documento]: { ...prev[documento], [campo]: valor } }));
    setExito("");
  }

  function handleImportado(periodos: number[]) {
    mutate();
    // Si el periodo en pantalla no viene en el archivo, se muestra el más reciente cargado
    if (periodos.length > 0 && !periodos.includes(periodo)) {
      cambiarPeriodo(Math.max(...periodos));
    }
  }

  async function handleGuardar() {
    setError("");
    setExito("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/citas-atendidas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo, filas: cambios }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudieron guardar las citas");
        return;
      }
      await mutate();
      setEdiciones({});
      setExito(
        `Cambios guardados: ${json.guardadas} registros actualizados, ${json.eliminadas} eliminados`
      );
    } catch {
      setError("No se pudieron guardar las citas");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Citas atendidas</h1>
        <p className="text-sm text-gray-400 mt-0.5">Citas atendidas por profesional y por mes</p>
      </div>

      <section
        aria-labelledby="importar-citas-titulo"
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3"
      >
        <div>
          <h2 id="importar-citas-titulo" className="text-base font-semibold text-brand-navy">
            Importar desde Excel
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Suba el archivo con una hoja que tenga la columna de cédula y una columna por mes.
          </p>
        </div>
        <ImportarCitasExcel onImportado={handleImportado} />
      </section>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">
            Citas cargadas — {fmtPeriodo(periodo)}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Citas registradas para cada profesional en el mes seleccionado. Las celdas vacías no tienen dato cargado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={inputCls}
            aria-label="Mes"
            value={periodo % 100}
            onChange={(e) =>
              cambiarPeriodo(Math.floor(periodo / 100) * 100 + Number(e.target.value))
            }
          >
            {MESES.map((m) => (
              <option key={m} value={m}>
                {fmtPeriodo(2000 * 100 + m).split(" ")[0]}
              </option>
            ))}
          </select>
          <select
            className={inputCls}
            aria-label="Año"
            value={Math.floor(periodo / 100)}
            onChange={(e) => cambiarPeriodo(Number(e.target.value) * 100 + (periodo % 100))}
          >
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorCarga && !data ? (
        <ErrorState
          error={errorCarga}
          reset={() => mutate()}
          titulo="No se pudieron cargar las citas atendidas"
        />
      ) : isLoading || !data ? (
        <SkeletonTable rows={8} />
      ) : (
        <>
          {/* Contadores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Profesionales con citas ingresadas
              </p>
              <p className="text-2xl font-bold text-brand-navy mt-1">
                {contadores.conCitas}
                <span className="text-base font-medium text-gray-400"> / {contadores.total}</span>
              </p>
            </div>
            <div
              className={`rounded-2xl border shadow-sm p-5 ${
                contadores.sinPrograma > 0
                  ? "bg-amber-50 border-amber-200"
                  : "bg-white border-gray-100"
              }`}
            >
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Con citas y sin programa
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  contadores.sinPrograma > 0 ? "text-amber-700" : "text-brand-navy"
                }`}
              >
                {contadores.sinPrograma}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Sin programa no hay meta con la cual medir el cumplimiento.
              </p>
            </div>
          </div>

          {/* Barra de acciones */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <input
                className={`${inputCls} w-full sm:w-72`}
                placeholder="Buscar por nombre o cédula…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={mostrarTodos}
                  onChange={(e) => setMostrarTodos(e.target.checked)}
                />
                Mostrar todos los profesionales activos
              </label>
            </div>
            <button
              type="button"
              onClick={handleGuardar}
              disabled={saving || !hayCambios || hayInvalidas}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-navy-dark disabled:opacity-60 transition-colors"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>

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
          {hayInvalidas && (
            <p className="text-xs text-red-600">
              Hay citas que no son un número entero. Corríjalas para poder guardar.
            </p>
          )}

          <GrillaCitas
            filas={visibles}
            mensajeVacio={
              busqueda
                ? "Sin resultados para esa búsqueda"
                : "No hay profesionales con programa de metas ni citas en este periodo"
            }
            onCambiarCitas={(documento, valor) => editar(documento, "citas", valor)}
          />
        </>
      )}

      <ConfirmModal
        open={periodoPendiente !== null}
        title="Cambios sin guardar"
        message={`Hay cambios sin guardar en ${fmtPeriodo(periodo)}. Si cambia de periodo se perderán.`}
        confirmLabel="Descartar cambios"
        cancelLabel="Seguir editando"
        variant="destructive"
        onConfirm={() => periodoPendiente !== null && irAPeriodo(periodoPendiente)}
        onCancel={() => setPeriodoPendiente(null)}
      />
    </div>
  );
}
