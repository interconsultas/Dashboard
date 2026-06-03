"use client";

import { useState, useRef, useEffect, useMemo } from "react";

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
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 bg-white text-left focus:outline-none focus:border-brand-navy/30 focus:ring-2 focus:ring-brand-navy/10 transition-all flex items-center justify-between gap-2"
      >
        <span className="truncate">{summary}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {loading && (
            <svg className="animate-spin h-3.5 w-3.5 text-brand-navy/40" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="filter-dropdown absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg py-1">
          {/* Toggle all */}
          <button
            type="button"
            onClick={handleToggleAll}
            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-brand-navy hover:bg-gray-50 border-b border-gray-100"
          >
            {effectiveAll ? "Quitar todos" : "Seleccionar todos"}
          </button>

          {/* Search */}
          {showSearch && (
            <div className="px-2 py-1.5 border-b border-gray-100">
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-brand-navy/30 focus:ring-1 focus:ring-brand-navy/10"
              />
            </div>
          )}

          {/* Select filtered (only when searching) */}
          {search && filtered.length > 0 && (
            <button
              type="button"
              onClick={handleSelectFiltered}
              className="w-full text-left px-3 py-1 text-[11px] text-brand-green hover:bg-gray-50 border-b border-gray-100"
            >
              Seleccionar {filtered.length} filtrados
            </button>
          )}

          {/* Options */}
          <div className="max-h-60 overflow-y-auto dropdown-scroll">
            {visible.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
            ) : (
              visible.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(o.value)}
                    onChange={() => onChange(o.value)}
                    className="rounded border-gray-300 focus:ring-brand-green/20"
                    style={{ accentColor: "var(--brand-green)" }}
                  />
                  {o.label}
                </label>
              ))
            )}
            {remaining > 0 && (
              <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100">
                {remaining} más — refina tu búsqueda
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
