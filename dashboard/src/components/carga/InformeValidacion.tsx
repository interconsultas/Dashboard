"use client";

import { useEffect, useState } from "react";
import { LogCarga } from "@/types/carga";
import { BadgeEstado } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

interface PreviewData {
  job_id: string;
  nombre_archivo: string;
  periodo_detectado: number | null;
  total_filas: number;
  filas_validas: number;
  filas_con_error: number;
  fechas_invalidas: number;
  medicos_no_encontrados: { total: number; nombres?: string[]; cedulas?: string[] };
  distribucion: { estado: string; conteo: number; pct: number }[];
  suma_valor_autorizado: number | null;
  promedio_valor: number | null;
  muestra_filas: Record<string, unknown>[];
}

interface Props {
  jobId: string;
  onReset: () => void;
}

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function fmtPeriodo(p: number | null): string {
  if (!p) return "—";
  return `${MESES[(p % 100) - 1]} ${Math.floor(p / 100)}`;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("es-CO");
}

function fmtCOP(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString("es-CO");
}

const EN_PROGRESO: LogCarga["estado"][] = ["procesando", "previsualizando", "cargando"];
const EN_ESPERA: LogCarga["estado"][] = ["esperando_confirmacion"];

export function InformeValidacion({ jobId, onReset }: Props) {
  const [informe, setInforme]         = useState<LogCarga | null>(null);
  const [preview, setPreview]         = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming]   = useState(false);
  const [cancelling, setCancelling]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [mostrarCedulas, setMostrarCedulas] = useState(false);
  const [mostrarMuestra, setMostrarMuestra] = useState(false);

  // Polling del estado del job
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/carga/validacion/${jobId}`);
        if (!res.ok) { setError("Error consultando estado"); return; }
        const data: LogCarga = await res.json();
        if (!cancelled) {
          setInforme(data);
          if (EN_PROGRESO.includes(data.estado)) {
            setTimeout(poll, 3000);
          }
        }
      } catch {
        if (!cancelled) setError("Error de red");
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [jobId]);

  // Cargar preview enriquecido cuando llega a esperando_confirmacion
  useEffect(() => {
    if (!informe || !EN_ESPERA.includes(informe.estado)) return;
    if (preview) return;

    setLoadingPreview(true);
    fetch(`/api/carga/preview/${jobId}`)
      .then(r => r.json())
      .then(d => { setPreview(d); setLoadingPreview(false); })
      .catch(() => setLoadingPreview(false));
  }, [informe, jobId, preview]);

  async function handleConfirmar() {
    setConfirming(true);
    const res = await fetch(`/api/carga/confirm/${jobId}`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Error al confirmar");
      setConfirming(false);
      return;
    }
    // Volver a polling — el estado cambiará a 'cargando' → 'exitoso'
    setConfirming(false);
    setPreview(null);
    setInforme(prev => prev ? { ...prev, estado: "cargando" } : prev);
    // Reiniciar poll
    setTimeout(() => {
      fetch(`/api/carga/validacion/${jobId}`)
        .then(r => r.json())
        .then(setInforme);
    }, 2000);
  }

  async function handleCancelar() {
    if (!confirm("¿Cancelar esta carga? Los datos en espera serán descartados.")) return;
    setCancelling(true);
    await fetch(`/api/carga/cancel/${jobId}`, { method: "POST" });
    setCancelling(false);
    onReset();
  }

  // ── Estados ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-700">
        <p className="font-semibold mb-1">Error</p>
        <p>{error}</p>
        <button onClick={onReset} className="mt-4 underline text-sm">Volver</button>
      </div>
    );
  }

  if (!informe || EN_PROGRESO.includes(informe.estado)) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 flex flex-col items-center gap-4">
        <Spinner className="h-8 w-8 text-[#1F497D]" />
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">Procesando archivo...</p>
          <p className="text-xs text-gray-400 mt-1">
            {informe
              ? `Estado: ${informe.estado}`
              : "Normalizando y cargando en área temporal"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Este proceso puede tomar 3-5 minutos para archivos grandes
          </p>
        </div>
      </div>
    );
  }

  const esExito  = informe.estado === "exitoso" || informe.estado === "exitoso_con_advertencias";
  const esFatal  = informe.estado === "error_fatal" || informe.estado === "ya_procesado";
  const esEspera = informe.estado === "esperando_confirmacion";
  const esCargando = informe.estado === "cargando";

  // ── Si está confirmando (cargando → exitoso) ─────────────────────────────
  if (esCargando || confirming) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 flex flex-col items-center gap-4">
        <Spinner className="h-8 w-8 text-[#1F497D]" />
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">Guardando datos en la base de datos...</p>
          <p className="text-xs text-gray-400 mt-1">Un momento, por favor</p>
        </div>
      </div>
    );
  }

  // ── Panel principal (espera o resultado final) ────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Encabezado ───────────────────────────────────────────────────── */}
      <div className={`border rounded-xl p-5 ${
        esFatal  ? "bg-red-50 border-red-200" :
        esEspera ? "bg-yellow-50 border-yellow-200" :
        esExito  ? "bg-green-50 border-green-200" :
                   "bg-gray-50 border-gray-200"
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BadgeEstado estado={informe.estado} />
              {(preview?.periodo_detectado || informe.periodo_detectado) && (
                <span className="text-sm text-gray-600">
                  Período: <strong>{fmtPeriodo(preview?.periodo_detectado ?? informe.periodo_detectado)}</strong>
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-800 mt-1">
              {informe.nombre_archivo}
            </p>
            {informe.tiempo_segundos != null && (
              <p className="text-xs text-gray-400 mt-0.5">
                Procesado en {informe.tiempo_segundos}s
              </p>
            )}
          </div>
          <button onClick={onReset} className="text-xs text-gray-400 hover:text-gray-600">
            ✕ Cerrar
          </button>
        </div>

        {esFatal && informe.error_mensaje && (
          <div className="mt-3 text-sm text-red-700 bg-red-100 rounded-lg p-3">
            <p className="font-semibold mb-1">No se cargaron datos</p>
            <p className="font-mono text-xs">{informe.error_mensaje}</p>
          </div>
        )}
      </div>

      {/* ── En espera: preview enriquecido ───────────────────────────────── */}
      {esEspera && (
        <>
          {loadingPreview ? (
            <div className="flex justify-center py-6">
              <Spinner className="h-6 w-6 text-[#1F497D]" />
            </div>
          ) : preview ? (
            <>
              {/* TOTALES */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
                  Totales
                </h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Filas en el archivo</span>
                    <span className="font-semibold tabular-nums">{fmtNum(preview.total_filas)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Filas válidas para cargar</span>
                    <span className="font-semibold text-green-700 tabular-nums">{fmtNum(preview.filas_validas)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Fechas inválidas (se omiten)</span>
                    <span className={`font-semibold tabular-nums ${preview.fechas_invalidas > 0 ? "text-orange-600" : "text-gray-900"}`}>
                      {fmtNum(preview.fechas_invalidas)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Médicos no encontrados</span>
                    <button
                      className="font-semibold text-orange-600 underline tabular-nums"
                      onClick={() => setMostrarCedulas(v => !v)}
                    >
                      {fmtNum(preview.medicos_no_encontrados?.total)} {mostrarCedulas ? "▲" : "▼"}
                    </button>
                  </div>
                </div>

                {/* Lista nombres no encontrados */}
                {mostrarCedulas && ((preview.medicos_no_encontrados?.nombres ?? preview.medicos_no_encontrados?.cedulas)?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(preview.medicos_no_encontrados.nombres ?? preview.medicos_no_encontrados.cedulas)!.slice(0, 30).map(c => (
                      <span key={c} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{c}</span>
                    ))}
                    {(preview.medicos_no_encontrados.nombres ?? preview.medicos_no_encontrados.cedulas)!.length > 30 && (
                      <span className="text-xs text-orange-500">+{(preview.medicos_no_encontrados.nombres ?? preview.medicos_no_encontrados.cedulas)!.length - 30} más</span>
                    )}
                  </div>
                )}
              </div>

              {/* DISTRIBUCIÓN */}
              {preview.distribucion.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
                    Distribución por estado de autorización
                  </h3>
                  <div className="space-y-3">
                    {preview.distribucion.map(({ estado, conteo, pct }) => (
                      <div key={estado} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-800 w-52 truncate flex-shrink-0">{estado}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-brand-navy h-3 rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-36 text-right tabular-nums flex-shrink-0">
                          {fmtNum(conteo)} <span className="text-brand-green font-bold">({pct}%)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VALORES */}
              {(preview.suma_valor_autorizado || preview.promedio_valor) && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
                    Valores
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-brand-blue-soft rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">Suma valor autorizado</p>
                      <p className="text-lg font-bold text-brand-navy tabular-nums">{fmtCOP(preview.suma_valor_autorizado)}</p>
                    </div>
                    <div className="bg-brand-green-soft rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">Valor promedio por fila</p>
                      <p className="text-lg font-bold text-brand-green tabular-nums">{fmtCOP(preview.promedio_valor)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* MUESTRA */}
              {preview.muestra_filas?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Muestra — primeras {preview.muestra_filas.length} filas normalizadas
                    </h3>
                    <button
                      className="text-xs text-[#1F497D] underline"
                      onClick={() => setMostrarMuestra(v => !v)}
                    >
                      {mostrarMuestra ? "Ocultar" : "Ver filas"}
                    </button>
                  </div>
                  {mostrarMuestra && (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-brand-navy text-white text-xs uppercase tracking-wide">
                          <tr>
                            {["Médico / Usuario","Documento","Tipo prestación","Diagnóstico","Estado","Cant.","Valor"].map(h => (
                              <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {preview.muestra_filas.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900 truncate max-w-[160px]" title={String(row.nombre_medico || "")}>
                                  {String(row.nombre_medico || row.usuario_txt || "—")}
                                </div>
                                {row.programa_especialidad != null && (
                                  <div className="text-xs text-gray-400 truncate max-w-[160px]">{String(row.programa_especialidad)}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-700 tabular-nums whitespace-nowrap">
                                {String(row.numero_documento ?? "—")}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-block bg-brand-blue-soft text-brand-navy text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                                  {String(row.tipo_prestacion_desc || "—")}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-800">
                                {String(row.codigo_diagnostico ?? "—")}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-gray-700 whitespace-nowrap">
                                  {String(row.estado_autorizacion_desc ?? "—")}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-gray-800 tabular-nums">
                                {String(row.cantidad_autorizada ?? "—")}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-brand-navy tabular-nums whitespace-nowrap">
                                {row.valor_autorizado_prestacion
                                  ? fmtCOP(Number(row.valor_autorizado_prestacion))
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}

          {/* ── Botones de acción ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
            <button
              onClick={handleCancelar}
              disabled={cancelling}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {cancelling ? "Cancelando..." : "Cancelar"}
            </button>
            <button
              onClick={handleConfirmar}
              disabled={confirming || loadingPreview}
              className="px-7 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {confirming
                ? <><Spinner className="h-4 w-4" /> Confirmando...</>
                : <><span>Confirmar y cargar</span><span>→</span></>
              }
            </button>
          </div>
        </>
      )}

      {/* ── Resultado final (exitoso) ────────────────────────────────────── */}
      {esExito && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Filas en archivo",    value: fmtNum(informe.filas_en_archivo || informe.filas_insertadas) },
            { label: "Filas insertadas",    value: fmtNum(informe.filas_insertadas),  color: "text-green-700" },
            { label: "Duplicadas / omitidas", value: fmtNum(informe.filas_duplicadas), color: "text-yellow-700" },
            { label: "Tiempo total",        value: informe.tiempo_segundos ? `${informe.tiempo_segundos}s` : "—" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color ?? "text-gray-900"}`}>{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
