"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { fmtPct } from "@/lib/productividad/presentacion";
import { MAX_PERIODOS_REGLA, PARAMETROS_REGLA, type CambioRegla, type ClaveRegla, type ReglaAlerta } from "@/lib/inteligencia/reglas";

interface Borrador {
  activa: boolean;
  /** Texto del campo en % (20 = 0,2). */
  umbral: string;
  periodos: string;
  minimo: string;
}

const aTexto = (v: number | null, factor = 1) => (v === null ? "" : String(Math.round(v * factor * 100) / 100));

function borradorDe(r: ReglaAlerta): Borrador {
  return { activa: r.activa, umbral: aTexto(r.umbral, 100), periodos: aTexto(r.periodos), minimo: aTexto(r.minimo) };
}

interface Evaluado {
  cambio: CambioRegla | null;
  errores: { umbral?: string; periodos?: string; minimo?: string };
}

/** Borrador → cambio validado (mismos rangos que la API). */
function evaluar(clave: ClaveRegla, b: Borrador): Evaluado {
  const usa = PARAMETROS_REGLA[clave];
  const errores: Evaluado["errores"] = {};
  let umbral: number | null = null;
  if (b.umbral.trim() === "" && usa.umbralOpcional) umbral = null;
  else {
    const n = Number(b.umbral);
    if (b.umbral.trim() === "" || !Number.isFinite(n) || n < 0 || n > 100) errores.umbral = "El umbral debe estar entre 0 % y 100 %";
    else umbral = Math.round(n * 100) / 10000;
  }
  let periodos: number | null = null;
  if (usa.periodos) {
    const n = Number(b.periodos);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PERIODOS_REGLA || b.periodos.trim() === "") errores.periodos = `Entre 1 y ${MAX_PERIODOS_REGLA} periodos`;
    else periodos = n;
  }
  let minimo: number | null = null;
  if (usa.minimo) {
    const n = Number(b.minimo);
    if (!Number.isInteger(n) || n < 0 || b.minimo.trim() === "") errores.minimo = "Entero mayor o igual que 0";
    else minimo = n;
  }
  const valido = Object.keys(errores).length === 0;
  return { cambio: valido ? { clave, activa: b.activa, umbral, periodos, minimo } : null, errores };
}

const igual = (c: CambioRegla, r: ReglaAlerta) =>
  c.activa === r.activa && c.umbral === r.umbral && c.periodos === r.periodos && c.minimo === r.minimo;

function fmtFecha(iso: string | null): string {
  if (!iso) return "";
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? "" : f.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function Campo({
  etiqueta,
  nombre,
  valor,
  error,
  deshabilitado,
  placeholder,
  sufijo,
  onCambiar,
}: {
  etiqueta: string;
  nombre: string;
  valor: string;
  error?: string;
  deshabilitado: boolean;
  placeholder?: string;
  sufijo?: string;
  onCambiar: (v: string) => void;
}) {
  return (
    <label className="flex flex-col text-xs text-tinta-3">
      <span>{etiqueta}</span>
      <span className="flex items-center gap-1 mt-0.5">
        <input
          type="number"
          aria-label={`${etiqueta}: ${nombre}`}
          aria-invalid={error ? true : undefined}
          value={valor}
          placeholder={placeholder}
          disabled={deshabilitado}
          onChange={(e) => onCambiar(e.target.value)}
          className={`w-24 rounded-lg border px-2 py-1 text-sm text-brand-navy disabled:bg-superficie-2 disabled:text-tinta-3 ${
            error ? "border-red-400" : "border-borde"
          }`}
        />
        {sufijo && <span aria-hidden>{sufijo}</span>}
      </span>
      {error && <span className="text-[11px] text-critico mt-0.5">{error}</span>}
    </label>
  );
}

/** Reglas de alerta: interruptores y parámetros; editable solo con 'editar' en Inteligencia. */
export function PanelReglas({
  reglas,
  editable,
  meta,
  onGuardar,
}: {
  reglas: readonly ReglaAlerta[];
  editable: boolean;
  meta: number;
  onGuardar: (cambios: CambioRegla[]) => Promise<void>;
}) {
  const inicial = useMemo(() => Object.fromEntries(reglas.map((r) => [r.clave, borradorDe(r)])) as Record<string, Borrador>, [reglas]);
  const [borrador, setBorrador] = useState(inicial);
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setBorrador(inicial), [inicial]);

  const evaluados = reglas.map((r) => ({ r, ...evaluar(r.clave, borrador[r.clave] ?? borradorDe(r)) }));
  const invalido = evaluados.some((e) => e.cambio === null);
  const cambios = evaluados.filter((e) => e.cambio && !igual(e.cambio, e.r)).map((e) => e.cambio!);
  const hayCambios = evaluados.some((e) => !e.cambio || !igual(e.cambio, e.r));

  const fijar = (clave: string, parcial: Partial<Borrador>) => setBorrador((b) => ({ ...b, [clave]: { ...b[clave], ...parcial } }));

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(cambios);
      setConfirmar(false);
    } catch (e) {
      setConfirmar(false);
      setError(e instanceof Error ? e.message : "No se pudieron guardar las reglas");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section aria-labelledby="titulo-reglas" className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 id="titulo-reglas" className="text-base font-semibold text-brand-navy">Reglas de alerta</h2>
          {!editable && <p className="text-xs text-tinta-3 mt-0.5">Solo consulta: su rol no puede cambiar las reglas.</p>}
        </div>
        {editable && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!hayCambios || guardando}
              onClick={() => {
                setBorrador(inicial);
                setError(null);
              }}
              className="px-3 py-1.5 text-sm font-medium rounded-lg text-tinta-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              Descartar
            </button>
            <button
              type="button"
              disabled={invalido || cambios.length === 0 || guardando}
              onClick={() => setConfirmar(true)}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-critico bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <ul className="divide-y divide-borde">
        {evaluados.map(({ r, errores }) => {
          const b = borrador[r.clave] ?? borradorDe(r);
          const usa = PARAMETROS_REGLA[r.clave];
          return (
            <li key={r.clave} className="py-3 flex flex-col lg:flex-row lg:items-start gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={b.activa}
                  aria-label={`Activa: ${r.nombre}`}
                  disabled={!editable}
                  onClick={() => fijar(r.clave, { activa: !b.activa })}
                  className={`mt-0.5 relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                    b.activa ? "bg-brand-green" : "bg-gray-300"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${b.activa ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-navy">
                    {r.nombre}{" "}
                    <span className="text-[11px] font-medium text-tinta-3">
                      · {b.activa ? "Activa" : "Inactiva"} · gravedad {r.gravedad}
                    </span>
                  </p>
                  <p className="text-xs text-tinta-3">{r.descripcion}</p>
                  {r.actualizado_por && (
                    <p className="text-[11px] text-tinta-3 mt-0.5">
                      Cambiada por {r.actualizado_por} el {fmtFecha(r.actualizado_en)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Campo
                  etiqueta="Umbral (%)"
                  nombre={r.nombre}
                  valor={b.umbral}
                  error={errores.umbral}
                  deshabilitado={!editable}
                  placeholder={usa.umbralOpcional ? `Meta ${fmtPct(meta, 0)}` : undefined}
                  sufijo="%"
                  onCambiar={(v) => fijar(r.clave, { umbral: v })}
                />
                {usa.periodos && (
                  <Campo
                    etiqueta="Periodos consecutivos"
                    nombre={r.nombre}
                    valor={b.periodos}
                    error={errores.periodos}
                    deshabilitado={!editable}
                    onCambiar={(v) => fijar(r.clave, { periodos: v })}
                  />
                )}
                {usa.minimo && (
                  <Campo
                    etiqueta="Mínimo de citas"
                    nombre={r.nombre}
                    valor={b.minimo}
                    error={errores.minimo}
                    deshabilitado={!editable}
                    onCambiar={(v) => fijar(r.clave, { minimo: v })}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmModal
        open={confirmar}
        title="Guardar reglas de alerta"
        message={`Se guardarán ${cambios.length} ${cambios.length === 1 ? "regla" : "reglas"}. Las alertas se recalculan para todos los usuarios.`}
        confirmLabel="Guardar cambios"
        loading={guardando}
        onConfirm={() => void guardar()}
        onCancel={() => setConfirmar(false)}
      />
    </section>
  );
}
