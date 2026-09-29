"use client";

export type ModoVista = "mes" | "dia";

interface Props {
  modo: ModoVista;
  onChange: (modo: ModoVista) => void;
  disabled?: boolean;
  disabledReason?: string;
}

const btnBase =
  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed";

export default function ModoVistaSwitch({ modo, onChange, disabled, disabledReason }: Props) {
  function select(next: ModoVista) {
    if (disabled || next === modo) return;
    onChange(next);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1">
      <button
        type="button"
        aria-pressed={modo === "mes"}
        onClick={() => select("mes")}
        className={`${btnBase} ${modo === "mes" ? "bg-white text-brand-navy shadow-sm" : "text-gray-500"}`}
      >
        Mes
      </button>
      <button
        type="button"
        aria-pressed={modo === "dia"}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() => select("dia")}
        className={`${btnBase} ${modo === "dia" ? "bg-white text-brand-navy shadow-sm" : "text-gray-500"}`}
      >
        Día
      </button>
    </div>
  );
}
