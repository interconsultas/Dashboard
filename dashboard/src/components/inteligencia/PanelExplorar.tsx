import type { ResultadoBusqueda, TipoEsquema } from "@/lib/inteligencia/grafo";
import { colorTipo, defTipo, type TipoObjeto } from "@/lib/inteligencia/ontologia";
import { fmtNumero } from "@/lib/productividad/presentacion";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Columna izquierda: buscador, leyenda de la ontología (tipos con color y
 * conteo; clic = listar sus instancias) y la lista de resultados.
 */
export function PanelExplorar({
  tipos,
  tipoActivo,
  texto,
  resultados,
  buscando,
  onTexto,
  onTipo,
  onElegir,
}: {
  tipos: TipoEsquema[];
  tipoActivo: TipoObjeto | null;
  texto: string;
  /** null = no hay búsqueda ni tipo elegido. */
  resultados: ResultadoBusqueda[] | null;
  buscando: boolean;
  onTexto: (t: string) => void;
  onTipo: (t: TipoObjeto | null) => void;
  onElegir: (id: string) => void;
}) {
  const titulo = texto.trim().length >= 2 ? "Resultados" : tipoActivo ? defTipo(tipoActivo).plural : null;

  return (
    <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4 min-w-0">
      <div>
        <label htmlFor="inteligencia-buscar" className="sr-only">
          Buscar en el mapa
        </label>
        <input
          id="inteligencia-buscar"
          type="search"
          value={texto}
          onChange={(e) => onTexto(e.target.value)}
          placeholder="Nombre, documento o código…"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-brand-navy placeholder:text-gray-400"
        />
      </div>

      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Ontología</h2>
        <ul aria-label="Tipos de objeto" className="space-y-0.5">
          {tipos.map((t) => {
            const activo = t.clave === tipoActivo;
            return (
              <li key={t.clave}>
                <button
                  type="button"
                  aria-pressed={activo}
                  onClick={() => onTipo(activo ? null : t.clave)}
                  title={t.descripcion}
                  className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-left transition-colors ${
                    activo ? "bg-brand-navy/5 text-brand-navy font-semibold" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="flex-1 truncate">{t.plural}</span>
                  <span className="text-xs tabular-nums text-gray-400">{fmtNumero(t.cantidad)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {titulo && (
        <div>
          <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {titulo}
            {buscando && <Spinner className="h-3 w-3 text-gray-400" />}
          </h2>
          {resultados && resultados.length === 0 && !buscando ? (
            <p className="text-sm text-gray-400">Sin coincidencias en el periodo.</p>
          ) : (
            <ul aria-label={titulo} className="max-h-[360px] overflow-y-auto space-y-0.5 pr-1">
              {(resultados ?? []).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onElegir(r.id)}
                    className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span aria-hidden className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: colorTipo(r.tipo) }} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{r.etiqueta}</span>
                      <span className="block text-[11px] text-gray-400 truncate">
                        {defTipo(r.tipo).etiqueta}
                        {r.clave !== r.etiqueta ? ` · ${r.clave}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
