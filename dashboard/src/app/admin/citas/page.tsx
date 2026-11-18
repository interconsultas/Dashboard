"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { TablaCitasPeriodo } from "@/components/citas/TablaCitasPeriodo";
import type { DetalleCitas } from "@/lib/citas/detalle";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SkeletonTable } from "@/components/ui/SkeletonCard";
import { ErrorState } from "@/components/layout/ErrorState";
import { usePuedeEditar } from "@/components/layout/RolContext";
import { EncabezadoPagina } from "@/components/layout/EncabezadoPagina";
import { clasesBoton } from "@/components/ui/Boton";

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);
const ANIOS_HACIA_ATRAS = 3;

export default function CitasPage() {
  // Con nivel 'ver' la página queda en solo consulta (la API rechaza las escrituras)
  const editable = usePuedeEditar("citas");
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

  // Todas las citas del informe de Agenda Web del mismo periodo
  const {
    data: detalle,
    error: errorDetalle,
    isLoading: cargandoDetalle,
    mutate: mutateDetalle,
  } = useSWR<DetalleCitas>(`/api/admin/citas/detalle?periodo=${periodo}`, fetcher, {
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
    mutateDetalle();
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
    "border border-borde bg-superficie rounded-control px-3 py-2 text-sm text-tinta-2 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario";

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        migas={[{ etiqueta: "Administración" }, { etiqueta: "Citas" }]}
        titulo="Citas"
        subtitulo="Carga del informe de Agenda Web y citas atendidas para cumplimiento"
        acciones={
          <Link href="/admin/citas/areas" className={clasesBoton({ variante: "secundario" })}>
            Áreas de servicio
          </Link>
        }
      />

      <section
        aria-labelledby="importar-citas-titulo"
        className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-5 space-y-3"
      >
        <div>
          <h2 id="importar-citas-titulo" className="font-titulo text-[15px] font-bold text-tinta">
            Cargar informe de citas
          </h2>
          <p className="text-sm text-tinta-3 mt-0.5">
            Suba el informe de citas detallado por profesional de Agenda Web (.xls). También se acepta el Excel con la columna de cédula y una columna por mes.
          </p>
        </div>
        {editable ? (
          <ImportarCitasExcel onImportado={handleImportado} />
        ) : (
          <p className="text-xs text-tinta-3 bg-superficie-2 border border-borde rounded-control px-3 py-2">
            Solo consulta: no puede cargar ni modificar citas.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-titulo text-[15px] font-bold text-tinta">Citas del periodo</h2>
          <p className="text-sm text-tinta-3 mt-0.5">
            Todas las citas del informe de Agenda Web por profesional
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

      {errorDetalle && !detalle ? (
        <ErrorState
          error={errorDetalle}
          reset={() => mutateDetalle()}
          titulo="No se pudieron cargar las citas del periodo"
        />
      ) : cargandoDetalle || !detalle ? (
        <SkeletonTable rows={8} />
      ) : (
        <TablaCitasPeriodo key={periodo} detalle={detalle} onIrAPeriodo={cambiarPeriodo} />
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-titulo text-[15px] font-bold text-tinta">
            Citas atendidas para cumplimiento
          </h2>
          <p className="text-sm text-tinta-3 mt-0.5">
            Citas confirmadas con las que se mide el cumplimiento de cada profesional en{" "}
            {fmtPeriodo(periodo)}. Las celdas vacías no tienen dato cargado.
          </p>
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
            <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-5">
              <p className="text-xs text-tinta-3 uppercase tracking-wide">
                Profesionales con citas ingresadas
              </p>
              <p className="text-2xl font-bold text-primario mt-1">
                {contadores.conCitas}
                <span className="text-base font-medium text-tinta-3"> / {contadores.total}</span>
              </p>
            </div>
            <div
              className={`rounded-tarjeta border shadow-tarjeta p-5 ${
                contadores.sinPrograma > 0
                  ? "bg-atencion-suave border-atencion/30"
                  : "bg-superficie border-borde"
              }`}
            >
              <p className="text-xs text-tinta-3 uppercase tracking-wide">
                Con citas y sin programa
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  contadores.sinPrograma > 0 ? "text-atencion" : "text-primario"
                }`}
              >
                {contadores.sinPrograma}
              </p>
              <p className="text-xs text-tinta-3 mt-1">
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
              <label className="flex items-center gap-2 text-sm text-tinta-2">
                <input
                  type="checkbox"
                  checked={mostrarTodos}
                  onChange={(e) => setMostrarTodos(e.target.checked)}
                />
                Mostrar todos los profesionales activos
              </label>
            </div>
            {editable && (
              <button
                type="button"
                onClick={handleGuardar}
                disabled={saving || !hayCambios || hayInvalidas}
                className="px-5 py-2 rounded-control text-sm font-semibold text-white bg-primario hover:bg-primario-oscuro disabled:opacity-60 transition-colors"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            )}
          </div>

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
          {hayInvalidas && (
            <p className="text-xs text-critico">
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
            soloLectura={!editable}
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
