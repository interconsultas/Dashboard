import Link from "next/link";
import type { Arista, Esquema, GrupoOculto, Nodo, Propiedad } from "@/lib/inteligencia/grafo";
import { fmtMetrica } from "@/lib/inteligencia/grafica";
import { colorTipo, defRelacion, defTipo, RELACIONES } from "@/lib/inteligencia/ontologia";
import { aQueryString, FILTROS_VACIOS, queryConFicha, type FiltrosProductividad } from "@/lib/productividad/filtros";
import type { Granularidad } from "@/lib/productividad/periodos";
import { fmtNumero } from "@/lib/productividad/presentacion";

const RUTA_PRODUCTIVIDAD = "/dashboard/productividad";

function valor(p: Propiedad): string {
  if (p.valor === null) return "—";
  if (typeof p.valor === "string") return p.valor;
  return fmtMetrica(p.valor, p.formato === "texto" ? "numero" : p.formato);
}

/** Enlaces a Productividad del nodo (profesional, servicio o área) en el mismo periodo. */
function enlaces(nodo: Nodo, granularidad: Granularidad, periodo: string | null): { texto: string; href: string }[] {
  const base: FiltrosProductividad = { ...FILTROS_VACIOS, granularidad, periodo };
  const href = (f: FiltrosProductividad) => `${RUTA_PRODUCTIVIDAD}?${aQueryString(f)}`;
  switch (nodo.tipo) {
    case "profesional":
      return [
        { texto: "Abrir en Productividad", href: href({ ...base, profesional: nodo.clave }) },
        { texto: "Ver ficha", href: `${RUTA_PRODUCTIVIDAD}?${queryConFicha(base, nodo.clave)}` },
      ];
    case "servicio":
      return [{ texto: "Abrir en Productividad", href: href({ ...base, servicio: nodo.clave }) }];
    case "area":
      return [{ texto: "Abrir en Productividad", href: href({ ...base, area: nodo.clave }) }];
    default:
      return [];
  }
}

function Contenedor({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Detalle" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4 min-w-0">
      {children}
    </section>
  );
}

/** Sin nodo elegido: explica el modelo (tipos de relación y su fuente). */
function DetalleModelo({ esquema }: { esquema: Esquema | null }) {
  const cantidad = new Map(esquema?.relaciones.map((r) => [r.clave, r.cantidad]) ?? []);
  return (
    <Contenedor>
      <div>
        <h2 className="text-[15px] font-semibold text-brand-navy">Modelo de la IPS</h2>
        <p className="text-xs text-gray-500 mt-1">
          Cada círculo es un tipo de objeto y cada flecha un tipo de relación. Elija un tipo o busque un
          profesional, servicio o programa para ver sus relaciones en el periodo.
        </p>
      </div>
      <ul aria-label="Tipos de relación" className="space-y-2">
        {RELACIONES.map((r) => (
          <li key={r.clave} className="text-xs">
            <p className="text-gray-700">
              <span className="font-semibold">{defTipo(r.origen).etiqueta}</span> <i>{r.etiqueta}</i>{" "}
              <span className="font-semibold">{defTipo(r.destino).etiqueta}</span>
              {cantidad.has(r.clave) && <span className="text-gray-400"> · {fmtNumero(cantidad.get(r.clave)!)}</span>}
            </p>
            <p className="text-gray-400">{r.fuente}</p>
          </li>
        ))}
      </ul>
    </Contenedor>
  );
}

export function PanelDetalle({
  nodo,
  esquema,
  vecinos,
  aristas,
  mas,
  expandidos,
  granularidad,
  periodo,
  veProductividad,
  onCentrar,
  onExpandir,
}: {
  nodo: Nodo | null;
  esquema: Esquema | null;
  /** Vecinos del nodo (sin el nodo). */
  vecinos: Nodo[];
  aristas: Arista[];
  mas: GrupoOculto[];
  expandidos: ReadonlySet<string>;
  granularidad: Granularidad;
  periodo: string | null;
  veProductividad: boolean;
  onCentrar: (id: string) => void;
  onExpandir: (id: string) => void;
}) {
  if (!nodo) return <DetalleModelo esquema={esquema} />;

  const def = defTipo(nodo.tipo);
  const links = veProductividad ? enlaces(nodo, granularidad, periodo) : [];
  const porId = new Map(vecinos.map((v) => [v.id, v]));
  const grupos = new Map<string, { titulo: string; nodos: Nodo[] }>();
  for (const a of aristas) {
    const otro = porId.get(a.origen === nodo.id ? a.destino : a.origen);
    if (!otro) continue;
    const clave = `${a.relacion}|${otro.tipo}`;
    const g = grupos.get(clave) ?? { titulo: `${defRelacion(a.relacion).etiqueta} · ${defTipo(otro.tipo).plural}`, nodos: [] };
    if (!g.nodos.includes(otro)) g.nodos.push(otro);
    grupos.set(clave, g);
  }

  return (
    <Contenedor>
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: colorTipo(nodo.tipo) }} />
          {def.etiqueta}
        </p>
        <h2 className="text-[15px] font-semibold text-brand-navy mt-0.5 break-words">{nodo.etiqueta}</h2>
      </div>

      {nodo.propiedades.length > 0 && (
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-xs">
          {nodo.propiedades.map((p) => (
            <div key={p.etiqueta} className="contents">
              <dt className="text-gray-500 truncate">{p.etiqueta}</dt>
              <dd className="text-right font-medium text-gray-800 tabular-nums break-words">{valor(p)}</dd>
            </div>
          ))}
        </dl>
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <Link
              key={l.texto}
              href={l.href}
              className="text-xs font-semibold text-brand-navy border border-brand-navy/20 rounded-lg px-2.5 py-1.5 hover:bg-brand-navy/5"
            >
              {l.texto}
            </Link>
          ))}
        </div>
      )}

      {mas.length > 0 && (
        <ul className="text-[11px] text-gray-400 space-y-0.5">
          {mas.map((m) => (
            <li key={`${m.relacion}|${m.tipo}`}>
              Se muestran {m.mostrados} de {fmtNumero(m.total)} {defTipo(m.tipo).plural.toLowerCase()}
            </li>
          ))}
        </ul>
      )}

      {grupos.size > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Relaciones</h3>
          <ul aria-label="Vecinos" className="max-h-[340px] overflow-y-auto pr-1 space-y-2">
            {Array.from(grupos.entries()).map(([clave, g]) => (
              <li key={clave}>
                <p className="text-[11px] text-gray-500 first-letter:uppercase">{g.titulo}</p>
                <ul className="mt-0.5">
                  {g.nodos.map((v) => (
                    <li key={v.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onCentrar(v.id)}
                        className="flex-1 min-w-0 truncate text-left text-xs text-gray-700 hover:text-brand-navy hover:underline py-0.5"
                      >
                        {v.etiqueta}
                      </button>
                      <button
                        type="button"
                        onClick={() => onExpandir(v.id)}
                        disabled={expandidos.has(v.id)}
                        aria-label={`Expandir ${v.etiqueta}`}
                        title="Agregar sus relaciones al mapa"
                        className="text-[11px] text-gray-400 hover:text-brand-navy disabled:opacity-30 px-1"
                      >
                        +
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Contenedor>
  );
}
