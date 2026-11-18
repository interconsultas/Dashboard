import { useId } from "react";
import { META_INASISTENCIA } from "@/lib/productividad/metricas";
import { fmtNumero } from "@/lib/productividad/presentacion";
import { palancasIguales, type ClavePalanca, type LimitesPalancas, type Palancas } from "@/lib/inteligencia/simulador";

interface Props {
  /** Palancas efectivas (ya recortadas a los límites). */
  palancas: Palancas;
  /** Valores que reproducen la realidad. */
  real: Palancas;
  limites: LimitesPalancas;
  profesionalesBase: number;
  onCambiar: (clave: ClavePalanca, valor: number) => void;
  /** null = todas. */
  onRestablecer: (clave: ClavePalanca | null) => void;
  onLlevarMeta: () => void;
}

interface DefPalanca {
  clave: ClavePalanca;
  etiqueta: string;
  ayuda: string;
  /** Unidad de la interfaz: % se muestra ×100. */
  porcentaje: boolean;
  paso: number;
  fmtValor: (v: number) => string;
}

const fmtPct1 = (v: number) => `${(v * 100).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const conSigno = (v: number, sufijo: string) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("es-CO", { maximumFractionDigits: 1 })}${sufijo}`;

function definiciones(profesionalesBase: number): DefPalanca[] {
  return [
    {
      clave: "deltaProfesionales",
      etiqueta: "Δ profesionales",
      ayuda: "Profesionales con agenda que se suman o se quitan; la oferta crece en proporción.",
      porcentaje: false,
      paso: 1,
      fmtValor: (v) => `${conSigno(v, "")} (${fmtNumero(profesionalesBase + v)} en total)`,
    },
    {
      clave: "deltaOferta",
      etiqueta: "Δ oferta por profesional",
      ayuda: "Más o menos citas ofertadas por cada profesional.",
      porcentaje: true,
      paso: 1,
      fmtValor: (v) => conSigno(v * 100, " %"),
    },
    {
      clave: "pctDisponibilidad",
      etiqueta: "% disponibilidad objetivo",
      ayuda: "Citas ofertadas que quedan sin asignar.",
      porcentaje: true,
      paso: 0.1,
      fmtValor: fmtPct1,
    },
    {
      clave: "pctInasistencia",
      etiqueta: "% inasistencia objetivo",
      ayuda: `Citas asignadas a las que el paciente no asiste. Meta: ${META_INASISTENCIA * 100} %.`,
      porcentaje: true,
      paso: 0.1,
      fmtValor: fmtPct1,
    },
  ];
}

/* ── Subcomponents ───────────────────────────────── */

function Palanca({
  def,
  valor,
  real,
  rango,
  textoReal,
  onCambiar,
  onRestablecer,
}: {
  def: DefPalanca;
  valor: number;
  real: number;
  rango: { min: number; max: number };
  textoReal: string;
  onCambiar: (v: number) => void;
  onRestablecer: () => void;
}) {
  const id = useId();
  const escala = def.porcentaje ? 100 : 1;
  const aUi = (v: number) => Math.round(v * escala * 10) / 10;
  const min = aUi(rango.min);
  const max = aUi(rango.max);
  const fijo = min === max;
  const posicionReal = max > min ? ((aUi(real) - min) / (max - min)) * 100 : 0;
  const movida = Math.abs(valor - real) > 1e-9;

  const cambiar = (texto: string) => {
    if (texto.trim() === "") return;
    const n = Number(texto);
    if (!Number.isFinite(n)) return;
    onCambiar(n / escala);
  };

  return (
    <div className="py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`${id}-rango`} className="text-sm font-semibold text-brand-navy">
          {def.etiqueta}
        </label>
        <button
          type="button"
          onClick={onRestablecer}
          disabled={!movida}
          aria-label={`Restablecer ${def.etiqueta}`}
          className="text-[11px] font-semibold text-brand-navy underline disabled:no-underline disabled:text-gray-300"
        >
          Restablecer
        </button>
      </div>
      <p className="text-[11px] text-gray-400">{def.ayuda}</p>
      <div className="flex items-center gap-3 mt-2">
        <div className="relative flex-1">
          <input
            id={`${id}-rango`}
            type="range"
            min={min}
            max={max}
            step={def.paso}
            value={aUi(valor)}
            disabled={fijo}
            aria-valuetext={def.fmtValor(valor)}
            onChange={(e) => cambiar(e.target.value)}
            className="w-full accent-[#2a78d6]"
          />
          {!fijo && (
            <span
              aria-hidden
              title="Valor real"
              className="absolute top-full -mt-0.5 h-2 w-0.5 bg-gray-500 rounded"
              style={{ left: `calc(${posicionReal}% - 1px)` }}
            />
          )}
        </div>
        <input
          type="number"
          min={min}
          max={max}
          step={def.paso}
          value={aUi(valor)}
          disabled={fijo}
          aria-label={`${def.etiqueta} (valor)`}
          onChange={(e) => cambiar(e.target.value)}
          className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-right text-brand-navy tabular-nums"
        />
        <span className="w-4 text-xs text-gray-400">{def.porcentaje ? "%" : ""}</span>
      </div>
      {/* El valor elegido ya está en el campo: debajo solo va la referencia real */}
      <p className="text-[11px] text-gray-500 mt-1.5">{textoReal}</p>
    </div>
  );
}

/* ── Component ──────────────────────────────────── */

/** Controles del simulador: un deslizador con campo numérico por palanca. */
export function SimuladorPalancas({ palancas, real, limites, profesionalesBase, onCambiar, onRestablecer, onLlevarMeta }: Props) {
  const defs = definiciones(profesionalesBase);
  const textoReal = (d: DefPalanca) =>
    d.clave === "deltaProfesionales"
      ? `Real: ${fmtNumero(profesionalesBase)} ${profesionalesBase === 1 ? "profesional" : "profesionales"}` +
        (palancas.deltaProfesionales !== 0
          ? ` · escenario: ${fmtNumero(profesionalesBase + palancas.deltaProfesionales)}`
          : "")
      : d.clave === "deltaOferta"
        ? "Real: oferta actual"
        : `Real: ${fmtPct1(real[d.clave])}`;
  const enMeta = palancas.pctInasistencia < META_INASISTENCIA;

  return (
    <section aria-label="Palancas del escenario" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-brand-navy">Palancas</h2>
        <button
          type="button"
          onClick={() => onRestablecer(null)}
          disabled={palancasIguales(palancas, real)}
          className="text-xs font-semibold text-brand-navy border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 disabled:opacity-40"
        >
          Restablecer todo
        </button>
      </div>
      {defs.map((d) => (
        <Palanca
          key={d.clave}
          def={d}
          valor={palancas[d.clave]}
          real={real[d.clave]}
          rango={limites[d.clave]}
          textoReal={textoReal(d)}
          onCambiar={(v) => onCambiar(d.clave, v)}
          onRestablecer={() => onRestablecer(d.clave)}
        />
      ))}
      <button
        type="button"
        onClick={onLlevarMeta}
        disabled={enMeta}
        className="mt-3 w-full rounded-lg bg-brand-navy px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
      >
        Llevar a la meta (menos del {META_INASISTENCIA * 100} % de inasistencia)
      </button>
    </section>
  );
}
