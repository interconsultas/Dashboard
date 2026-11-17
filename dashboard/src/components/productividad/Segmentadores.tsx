"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { FiltrosProductividad } from "@/lib/productividad/filtros";
import type { Granularidad } from "@/lib/productividad/periodos";
import { buscarProfesional, etiquetaProfesional } from "@/lib/productividad/presentacion";
import type { RespuestaProductividad } from "@/lib/productividad/tipos";

/* ── Styles ──────────────────────────────────────── */

const controlCls =
  "rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-brand-navy/30 focus:ring-2 focus:ring-brand-navy/10 transition-all min-w-[140px] max-w-[260px]";
const labelCls = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1";

/* ── Types ───────────────────────────────────────── */

export interface PropsSegmentadores {
  filtros: FiltrosProductividad;
  /** Periodo efectivo (el de la URL o el que resolvió el servidor). */
  periodo: string | null;
  periodos: RespuestaProductividad["periodos"];
  opciones: RespuestaProductividad["opciones"];
  onGranularidad: (g: Granularidad) => void;
  onPeriodo: (clave: string) => void;
  onArea: (area: string | null) => void;
  onServicio: (codigo: string | null) => void;
  onProfesional: (documento: string | null) => void;
  onLimpiar: () => void;
}

/* ── Component ──────────────────────────────────── */

export function Segmentadores({
  filtros,
  periodo,
  periodos,
  opciones,
  onGranularidad,
  onPeriodo,
  onArea,
  onServicio,
  onProfesional,
  onLimpiar,
}: PropsSegmentadores) {
  const id = useId();
  const listaPeriodos = periodos[filtros.granularidad];
  const sinSemanas = periodos.semanal.length === 0;

  const servicios = useMemo(
    () =>
      opciones.servicios
        .filter((s) => filtros.area === null || s.area === filtros.area)
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [opciones.servicios, filtros.area]
  );

  const profesionalSel = opciones.profesionales.find((p) => p.documento === filtros.profesional) ?? null;
  const textoSel = profesionalSel ? etiquetaProfesional(profesionalSel) : filtros.profesional ?? "";
  const [texto, setTexto] = useState(textoSel);
  // La URL manda: si el filtro cambia por fuera (chip, Limpiar, Atrás) el buscador lo refleja
  useEffect(() => setTexto(textoSel), [textoSel]);

  function cambiarTexto(valor: string) {
    setTexto(valor);
    if (valor.trim() === "") {
      if (filtros.profesional !== null) onProfesional(null);
      return;
    }
    const documento = buscarProfesional(valor, opciones.profesionales);
    if (documento !== null && documento !== filtros.profesional) onProfesional(documento);
  }

  const chips: { clave: string; texto: string; quitar?: () => void }[] = [];
  const periodoSel = listaPeriodos.find((p) => p.clave === periodo);
  if (periodoSel) chips.push({ clave: "periodo", texto: periodoSel.etiqueta_larga });
  if (filtros.area) chips.push({ clave: "area", texto: filtros.area, quitar: () => onArea(null) });
  if (filtros.servicio) {
    const s = opciones.servicios.find((x) => x.codigo === filtros.servicio);
    chips.push({ clave: "servicio", texto: s?.nombre ?? filtros.servicio, quitar: () => onServicio(null) });
  }
  if (filtros.profesional) {
    chips.push({
      clave: "profesional",
      texto: profesionalSel?.nombre ?? filtros.profesional,
      quitar: () => onProfesional(null),
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap gap-3 items-end sticky top-0 md:top-4 z-10">
      <div>
        <span className={labelCls}>Periodo</span>
        <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden" role="group" aria-label="Periodo">
          {(["mensual", "semanal"] as const).map((g) => {
            const activo = filtros.granularidad === g;
            const deshabilitado = g === "semanal" && sinSemanas;
            return (
              <button
                key={g}
                type="button"
                aria-pressed={activo}
                disabled={deshabilitado}
                title={deshabilitado ? "Disponible al cargar informes semanales" : undefined}
                onClick={() => !activo && onGranularidad(g)}
                className={`px-3 py-2 text-sm transition-colors ${
                  activo ? "bg-brand-navy text-white" : "bg-white text-gray-600 hover:bg-brand-blue-soft"
                } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white`}
              >
                {g === "mensual" ? "Mensual" : "Semanal"}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-periodo`} className={labelCls}>
          {filtros.granularidad === "mensual" ? "Mes" : "Semana"}
        </label>
        <select
          id={`${id}-periodo`}
          className={controlCls}
          value={periodo ?? ""}
          onChange={(e) => e.target.value && onPeriodo(e.target.value)}
          disabled={listaPeriodos.length === 0}
        >
          {listaPeriodos.length === 0 && <option value="">Sin cargas</option>}
          {listaPeriodos
            .slice()
            .reverse()
            .map((p) => (
              <option key={p.clave} value={p.clave}>
                {p.etiqueta_larga}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-area`} className={labelCls}>Área de servicio</label>
        <select
          id={`${id}-area`}
          className={controlCls}
          value={filtros.area ?? ""}
          onChange={(e) => onArea(e.target.value || null)}
        >
          <option value="">Todas</option>
          {opciones.areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-servicio`} className={labelCls}>Servicio</label>
        <select
          id={`${id}-servicio`}
          className={controlCls}
          value={filtros.servicio ?? ""}
          onChange={(e) => onServicio(e.target.value || null)}
        >
          <option value="">Todos</option>
          {servicios.map((s) => (
            <option key={s.codigo} value={s.codigo}>{s.nombre}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-profesional`} className={labelCls}>Profesional</label>
        <input
          id={`${id}-profesional`}
          type="search"
          list={`${id}-profesionales`}
          placeholder="Nombre o cédula"
          autoComplete="off"
          className={controlCls}
          value={texto}
          onChange={(e) => cambiarTexto(e.target.value)}
          onBlur={() => setTexto(textoSel)}
        />
        <datalist id={`${id}-profesionales`}>
          {opciones.profesionales.map((p) => (
            <option key={p.documento} value={etiquetaProfesional(p)} />
          ))}
        </datalist>
      </div>

      <button
        type="button"
        onClick={onLimpiar}
        className="px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 text-brand-navy bg-white hover:bg-brand-blue-soft transition-colors"
      >
        Limpiar filtros
      </button>

      <ul aria-label="Filtros activos" className="flex flex-wrap gap-1.5 items-center xl:ml-auto">
        {chips.map((c) => (
          <li
            key={c.clave}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue-soft text-brand-navy px-2.5 py-1 text-xs font-semibold max-w-[260px]"
          >
            <span className="truncate">{c.texto}</span>
            {c.quitar && (
              <button
                type="button"
                onClick={c.quitar}
                aria-label={`Quitar ${c.texto}`}
                title="Quitar"
                className="text-brand-navy/70 hover:text-brand-navy text-[15px] leading-none"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
