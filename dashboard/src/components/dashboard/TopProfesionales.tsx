"use client";

interface TopItem {
  nombre: string;
  total: number;
  porcentaje: number;
}

interface Props {
  profesionales: TopItem[];
  prestaciones: TopItem[];
  diagnosticos: TopItem[];
  loading?: boolean;
}

function RankingTable({ titulo, subtitulo, data }: { titulo: string; subtitulo: string; data: TopItem[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-400">Sin datos</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{titulo}</p>
        <p className="text-[11px] text-gray-300 mt-0.5">{subtitulo}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 pb-2 pr-3 w-8">#</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 pb-2 pr-3">Nombre</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400 pb-2 pr-3">Cant.</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400 pb-2">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.nombre} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="py-2 pr-3 text-xs text-gray-400 font-medium">{i + 1}</td>
                <td className="py-2 pr-3 text-gray-700 font-medium truncate max-w-[180px]" title={row.nombre}>
                  {row.nombre}
                </td>
                <td className="py-2 pr-3 text-right font-semibold text-brand-navy tabular-nums">
                  {row.total.toLocaleString("es-CO")}
                </td>
                <td className="py-2 text-right text-gray-500 tabular-nums">
                  {row.porcentaje.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TopProfesionales({ profesionales, prestaciones, diagnosticos, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-5 w-40 bg-gray-100 rounded-lg animate-pulse" />
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-7 bg-gray-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-fade-slide-up">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:divide-x lg:divide-gray-100">
        <div>
          <RankingTable titulo="Profesionales" subtitulo="Por autorizaciones" data={profesionales} />
        </div>
        <div className="lg:pl-6">
          <RankingTable titulo="Prestaciones" subtitulo="Por autorizaciones" data={prestaciones} />
        </div>
        <div className="lg:pl-6">
          <RankingTable titulo="Diagnósticos" subtitulo="Por autorizaciones" data={diagnosticos} />
        </div>
      </div>
    </div>
  );
}
