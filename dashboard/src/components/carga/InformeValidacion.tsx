"use client";

import { useEffect, useState } from "react";
import { LogCarga } from "@/types/carga";
import { BadgeEstado } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { clasesBoton } from "@/components/ui/Boton";
import { cx } from "@/components/ui/clases";
import { fmtPeriodos } from "@/lib/periodo";

interface PreviewData {
  job_id: string;
  nombre_archivo: string;
  periodo_detectado: number | null;
  periodos_detectados: number[] | null;
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
  /** false en solo consulta: oculta Cancelar y Confirmar. */
  puedeConfirmar?: boolean;
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

export function InformeValidacion({ jobId, onReset, puedeConfirmar = true }: Props) {
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
      <div className="bg-critico-suave border border-critico/30 rounded-control p-6 text-sm text-critico">
        <p className="font-semibold mb-1">Error</p>
        <p>{error}</p>
        <button onClick={onReset} className="mt-4 underline text-sm">Volver</button>
      </div>
    );
  }

  if (!informe || EN_PROGRESO.includes(informe.estado)) {
    return (
      <div className="bg-superficie border border-borde rounded-control p-10 flex flex-col items-center gap-4">
        <Spinner className="h-8 w-8 text-primario" />
        <div className="text-center">
          <p className="text-sm font-semibold text-tinta-2">Procesando archivo...</p>
          <p className="text-xs text-tinta-3 mt-1">
            {informe
              ? `Estado: ${informe.estado}`
              : "Normalizando y cargando en área temporal"}
          </p>
          <p className="text-xs text-tinta-3 mt-0.5">
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
      <div className="bg-superficie border border-borde rounded-control p-10 flex flex-col items-center gap-4">
        <Spinner className="h-8 w-8 text-primario" />
        <div className="text-center">
          <p className="text-sm font-semibold text-tinta-2">Guardando datos en la base de datos...</p>
          <p className="text-xs text-tinta-3 mt-1">Un momento, por favor</p>
        </div>
      </div>
    );
  }

  // ── Panel principal (espera o resultado final) ────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Encabezado ───────────────────────────────────────────────────── */}
      <div className={`border rounded-control p-5 ${
        esFatal  ? "bg-critico-suave border-critico/30" :
        esEspera ? "bg-atencion-suave border-atencion/30" :
        esExito  ? "bg-bien-suave border-bien/30" :
                   "bg-superficie-2 border-borde"
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BadgeEstado estado={informe.estado} />
              {(preview?.periodo_detectado || informe.periodo_detectado) && (
                <span className="text-sm text-tinta-2">
                  Período: <strong>{fmtPeriodos(preview?.periodos_detectados ?? informe.periodos_detectados, preview?.periodo_detectado ?? informe.periodo_detectado)}</strong>
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-tinta mt-1">
              {informe.nombre_archivo}
            </p>
            {informe.tiempo_segundos != null && (
              <p className="text-xs text-tinta-3 mt-0.5">
                Procesado en {informe.tiempo_segundos}s
              </p>
            )}
          </div>
          <button onClick={onReset} className="text-xs text-tinta-3 hover:text-tinta">
            ✕ Cerrar
          </button>
        </div>

        {esFatal && informe.error_mensaje && (
          <div className="mt-3 text-sm text-critico bg-critico-suave rounded-control p-3">
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
              <Spinner className="h-6 w-6 text-primario" />
            </div>
          ) : preview ? (
            <>
              {/* TOTALES */}
              <div className="bg-superficie border border-borde rounded-control p-5">
                <h3 className="font-titulo text-[15px] font-bold text-tinta mb-4">
                  Totales
                </h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div className="flex justify-between border-b border-borde pb-2">
                    <span className="text-tinta-3">Filas en el archivo</span>
                    <span className="font-semibold tabular-nums">{fmtNum(preview.total_filas)}</span>
                  </div>
                  <div className="flex justify-between border-b border-borde pb-2">
                    <span className="text-tinta-3">Filas válidas para cargar</span>
                    <span className="font-semibold text-bien tabular-nums">{fmtNum(preview.filas_validas)}</span>
                  </div>
                  <div className="flex justify-between border-b border-borde pb-2">
                    <span className="text-tinta-3">Fechas inválidas (se omiten)</span>
                    <span className={`font-semibold tabular-nums ${preview.fechas_invalidas > 0 ? "text-atencion" : "text-tinta"}`}>
                      {fmtNum(preview.fechas_invalidas)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-borde pb-2">
                    <span className="text-tinta-3">Médicos no encontrados</span>
                    <button
                      className="font-semibold text-atencion underline tabular-nums"
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
                      <span key={c} className="text-xs bg-atencion-suave text-atencion px-2 py-0.5 rounded">{c}</span>
                    ))}
                    {(preview.medicos_no_encontrados.nombres ?? preview.medicos_no_encontrados.cedulas)!.length > 30 && (
                      <span className="text-xs text-atencion">+{(preview.medicos_no_encontrados.nombres ?? preview.medicos_no_encontrados.cedulas)!.length - 30} más</span>
                    )}
                  </div>
                )}
              </div>

              {/* DISTRIBUCIÓN */}
              {preview.distribucion.length > 0 && (
                <div className="bg-superficie border border-borde rounded-control p-5">
                  <h3 className="font-titulo text-[15px] font-bold text-tinta mb-4">
                    Distribución por estado de autorización
                  </h3>
                  <div className="space-y-3">
                    {preview.distribucion.map(({ estado, conteo, pct }) => (
                      <div key={estado} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-tinta w-52 truncate flex-shrink-0">{estado}</span>
                        <div className="flex-1 bg-fondo rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-primario h-3 rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-tinta-2 w-36 text-right tabular-nums flex-shrink-0">
                          {fmtNum(conteo)} <span className="text-bien font-bold">({pct}%)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VALORES */}
              {(preview.suma_valor_autorizado || preview.promedio_valor) && (
                <div className="bg-superficie border border-borde rounded-control p-5">
                  <h3 className="font-titulo text-[15px] font-bold text-tinta mb-4">
                    Valores
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-primario-suave rounded-control p-4">
                      <p className="text-xs text-tinta-3 mb-1">Suma valor autorizado</p>
                      <p className="text-lg font-bold text-primario tabular-nums">{fmtCOP(preview.suma_valor_autorizado)}</p>
                    </div>
                    <div className="bg-acento-suave rounded-control p-4">
                      <p className="text-xs text-tinta-3 mb-1">Valor promedio por fila</p>
                      <p className="text-lg font-bold text-bien tabular-nums">{fmtCOP(preview.promedio_valor)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* MUESTRA */}
              {preview.muestra_filas?.length > 0 && (
                <div className="bg-superficie border border-borde rounded-control p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-titulo text-[15px] font-bold text-tinta">
                      Muestra — primeras {preview.muestra_filas.length} filas normalizadas
                    </h3>
                    <button
                      className="text-xs text-primario underline"
                      onClick={() => setMostrarMuestra(v => !v)}
                    >
                      {mostrarMuestra ? "Ocultar" : "Ver filas"}
                    </button>
                  </div>
                  {mostrarMuestra && (
                    <div className="overflow-x-auto bg-superficie rounded-control border border-borde">
                      <table className="tabla tabla-texto">
                        <thead>
                          <tr>
                            {["Médico / Usuario","Documento","Tipo prestación","Diagnóstico","Estado","Cant.","Valor"].map(h => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.muestra_filas.map((row, i) => (
                            <tr key={i}>
                              <td>
                                <div className="font-medium text-tinta truncate max-w-[160px]" title={String(row.nombre_medico || "")}>
                                  {String(row.nombre_medico || row.usuario_txt || "—")}
                                </div>
                                {row.programa_especialidad != null && (
                                  <div className="text-xs text-tinta-3 truncate max-w-[160px]">{String(row.programa_especialidad)}</div>
                                )}
                              </td>
                              <td className="text-tinta-2 tabular-nums whitespace-nowrap">
                                {String(row.numero_documento ?? "—")}
                              </td>
                              <td>
                                <span className="inline-block bg-primario-suave text-primario text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                                  {String(row.tipo_prestacion_desc || "—")}
                                </span>
                              </td>
                              <td className="font-mono text-sm font-semibold text-tinta">
                                {String(row.codigo_diagnostico ?? "—")}
                              </td>
                              <td>
                                <span className="text-xs text-tinta-2 whitespace-nowrap">
                                  {String(row.estado_autorizacion_desc ?? "—")}
                                </span>
                              </td>
                              <td className="text-center font-semibold text-tinta tabular-nums">
                                {String(row.cantidad_autorizada ?? "—")}
                              </td>
                              <td className="text-right font-semibold text-primario tabular-nums whitespace-nowrap">
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
          {puedeConfirmar && (
          <div className="flex items-center justify-between pt-2 border-t border-borde mt-2">
            <button
              onClick={handleCancelar}
              disabled={cancelling}
              className={cx(clasesBoton({ variante: "secundario" }), "px-5 py-2.5")}
            >
              {cancelling ? "Cancelando..." : "Cancelar"}
            </button>
            <button
              onClick={handleConfirmar}
              disabled={confirming || loadingPreview}
              className={cx(clasesBoton(), "px-6 py-2.5")}
            >
              {confirming
                ? <><Spinner className="h-4 w-4" /> Confirmando...</>
                : <><span>Confirmar y cargar</span><span>→</span></>
              }
            </button>
          </div>
          )}
        </>
      )}

      {/* ── Resultado final (exitoso) ────────────────────────────────────── */}
      {esExito && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Filas en archivo",    value: fmtNum(informe.filas_en_archivo || informe.filas_insertadas) },
            { label: "Filas insertadas",    value: fmtNum(informe.filas_insertadas),  color: "text-bien" },
            { label: "Duplicadas / omitidas", value: fmtNum(informe.filas_duplicadas), color: "text-atencion" },
            { label: "Tiempo total",        value: informe.tiempo_segundos ? `${informe.tiempo_segundos}s` : "—" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-tinta-3 mb-1">{label}</p>
              <p className={`font-titulo text-2xl font-extrabold tabular-nums `}>{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
