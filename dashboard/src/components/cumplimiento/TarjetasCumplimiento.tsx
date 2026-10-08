import { CATEGORIAS } from "@/lib/cumplimiento/categorias";
import type { ResumenCumplimiento } from "@/lib/cumplimiento/calcular";
import { TileCumplimiento } from "./TileCumplimiento";

interface Props {
  resumen: ResumenCumplimiento | null;
  loading?: boolean;
}

/** Tile global destacado junto a un tile por cada una de las 7 categorías. */
export function TarjetasCumplimiento({ resumen, loading }: Props) {
  if (loading || !resumen) {
    return (
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-72 flex-shrink-0 h-40 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {CATEGORIAS.map((c) => (
            <div key={c.clave} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 print:flex-row print:break-inside-avoid">
      <div className="lg:w-72 flex-shrink-0 grid print:w-72">
        <TileCumplimiento
          testId="tile-global"
          etiqueta="Cumplimiento global"
          valor={resumen.global}
          nota="Meta <100%"
          destacado
        />
      </div>
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 print:grid-cols-4">
        {CATEGORIAS.map((c) => (
          <TileCumplimiento
            key={c.clave}
            testId="tile-categoria"
            etiqueta={c.etiqueta}
            valor={resumen.pct[c.clave] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
