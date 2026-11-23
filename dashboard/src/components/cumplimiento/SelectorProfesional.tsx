"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { filtrarProfesionales } from "@/lib/cumplimiento/presentacion";

interface Opcion {
  documento: string;
  nombre: string;
}

interface Props {
  profesionales: Opcion[];
  /** Cédula del profesional seleccionado; null = todos. */
  seleccionado: string | null;
  onCambiar: (documento: string | null) => void;
}

const TODOS = "Todos los profesionales";
const MAX_VISIBLES = 100;

const opcionCls =
  "w-full flex items-center justify-between gap-3 px-3 py-1.5 text-sm text-left cursor-pointer select-none hover:bg-primario-suave";

/** Selector de un profesional con búsqueda por nombre o cédula (mismo aspecto que CheckDropdown). */
export function SelectorProfesional({ profesionales, seleccionado, onCambiar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const actual = profesionales.find((p) => p.documento === seleccionado);
  const resumen = actual ? actual.nombre : TODOS;

  const filtrados = useMemo(() => filtrarProfesionales(profesionales, busqueda), [profesionales, busqueda]);
  const visibles = filtrados.slice(0, MAX_VISIBLES);
  const restantes = filtrados.length - visibles.length;

  function cerrar() {
    setAbierto(false);
    setBusqueda("");
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 0);
  }, [abierto]);

  function elegir(documento: string | null) {
    onCambiar(documento);
    cerrar();
  }

  function opcion(documento: string | null, nombre: string) {
    const activa = documento === seleccionado;
    return (
      <li
        key={documento ?? "todos"}
        role="option"
        aria-selected={activa}
        tabIndex={0}
        onClick={() => elegir(documento)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            elegir(documento);
          }
        }}
        className={`${opcionCls} ${activa ? "font-semibold text-primario bg-primario-suave" : "text-tinta-2"}`}
      >
        <span className="truncate">{nombre}</span>
        {documento && <span className="text-[11px] text-tinta-3 tabular-nums flex-shrink-0">{documento}</span>}
      </li>
    );
  }

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") cerrar();
      }}
    >
      <button
        type="button"
        aria-label={`Profesional: ${resumen}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        className="w-full rounded-control border border-borde px-3 py-2.5 text-sm text-tinta-2 bg-superficie text-left focus:outline-none focus:border-primario focus:ring-2 focus:ring-primario/30 transition-all flex items-center justify-between gap-2"
      >
        <span className="truncate">{resumen}</span>
        <svg
          className={`w-4 h-4 text-tinta-3 transition-transform shrink-0 ${abierto ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {abierto && (
        <div className="filter-dropdown absolute z-50 mt-1 w-full min-w-[260px] bg-superficie border border-borde rounded-control shadow-tarjeta py-1">
          <div className="px-2 py-1.5 border-b border-borde">
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar por nombre o cédula…"
              aria-label="Buscar profesional"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-control border border-borde px-2.5 py-1.5 text-sm text-tinta-2 placeholder:text-tinta-3 focus:outline-none focus:border-primario focus:ring-1 focus:ring-primario/30"
            />
          </div>
          <ul role="listbox" aria-label="Profesional" className="max-h-60 overflow-y-auto dropdown-scroll">
            {opcion(null, TODOS)}
            {visibles.map((p) => opcion(p.documento, p.nombre))}
          </ul>
          {filtrados.length === 0 && <p className="px-3 py-2 text-sm text-tinta-3">Sin resultados</p>}
          {restantes > 0 && (
            <p className="px-3 py-2 text-[11px] text-tinta-3 border-t border-borde">
              {restantes} más — refine la búsqueda
            </p>
          )}
        </div>
      )}
    </div>
  );
}
