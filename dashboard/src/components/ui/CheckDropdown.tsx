"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { CLASES_CAMPO, cx } from "./clases";

interface Option {
  value: string;
  label: string;
}

interface CheckDropdownProps {
  options: Option[];
  selected: string[];
  onChange: (value: string) => void;
  onSetAll: (values: string[]) => void;
  placeholder?: string;
  allByDefault?: boolean;
  loading?: boolean;
}

const SEARCH_THRESHOLD = 15;
const MAX_VISIBLE = 100;

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function CheckDropdown({
  options,
  selected,
  onChange,
  onSetAll,
  placeholder = "Todos",
  allByDefault = false,
  loading = false,
}: CheckDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const showSearch = options.length > SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = normalize(search);
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, search]);

  const visible = filtered.length > MAX_VISIBLE ? filtered.slice(0, MAX_VISIBLE) : filtered;
  const remaining = filtered.length - visible.length;

  const effectiveAll = allByDefault
    ? selected.length === 0 || (options.length > 0 && options.every(o => selectedSet.has(o.value)))
    : options.length > 0 && options.every(o => selectedSet.has(o.value));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open && showSearch) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, showSearch]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  }

  function handleToggleAll() {
    if (effectiveAll) {
      onSetAll([]);
    } else {
      onSetAll(options.map((o) => o.value));
    }
  }

  function handleSelectFiltered() {
    const current = new Set(selected);
    for (const o of filtered) current.add(o.value);
    onSetAll(Array.from(current));
  }

  let summary: string;
  if (effectiveAll) {
    summary = placeholder;
  } else if (selected.length === 0) {
    summary = "Ninguno";
  } else {
    const labels = options
      .filter((o) => selectedSet.has(o.value))
      .map((o) => o.label);
    summary = labels.length <= 2 ? labels.join(", ") : `${labels.length} seleccionados`;
  }

  return (
    <div ref={ref} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => { setOpen(!open); if (open) setSearch(""); }}
        className={cx(CLASES_CAMPO, "w-full text-left transition-all flex items-center justify-between gap-2")}
      >
        <span className="truncate">{summary}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {loading && (
            <svg className="animate-spin h-3.5 w-3.5 text-primario/40" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <svg className={`w-4 h-4 text-tinta-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="filter-dropdown absolute z-50 mt-1 w-full bg-superficie border border-borde rounded-control shadow-tarjeta py-1">
          {/* Toggle all */}
          <button
            type="button"
            onClick={handleToggleAll}
            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-primario hover:bg-primario-suave border-b border-borde"
          >
            {effectiveAll ? "Quitar todos" : "Seleccionar todos"}
          </button>

          {/* Search */}
          {showSearch && (
            <div className="px-2 py-1.5 border-b border-borde">
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-control border border-borde px-2.5 py-1.5 text-sm text-tinta-2 placeholder:text-tinta-3 focus:outline-none focus:border-primario focus:ring-1 focus:ring-primario/30"
              />
            </div>
          )}

          {/* Select filtered (only when searching) */}
          {search && filtered.length > 0 && (
            <button
              type="button"
              onClick={handleSelectFiltered}
              className="w-full text-left px-3 py-1 text-[11px] font-semibold text-primario hover:bg-primario-suave border-b border-borde"
            >
              Seleccionar {filtered.length} filtrados
            </button>
          )}

          {/* Options */}
          <div className="max-h-60 overflow-y-auto dropdown-scroll">
            {visible.length === 0 ? (
              <p className="px-3 py-2 text-sm text-tinta-3">Sin resultados</p>
            ) : (
              visible.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-tinta-2 hover:bg-primario-suave cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(o.value)}
                    onChange={() => onChange(o.value)}
                    className="rounded border-borde focus:ring-primario/30"
                    style={{ accentColor: "var(--primario)" }}
                  />
                  {o.label}
                </label>
              ))
            )}
            {remaining > 0 && (
              <p className="px-3 py-2 text-[11px] text-tinta-3 border-t border-borde">
                {remaining} más — refina tu búsqueda
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
