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
        <p className="text-sm text-tinta-3">Sin datos</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-titulo text-[15px] font-bold text-tinta">{titulo}</h2>
        <p className="text-xs text-tinta-3 mt-0.5">{subtitulo}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col" className="w-8">#</th>
              <th scope="col" className="text-left">Nombre</th>
              <th scope="col">Cant.</th>
              <th scope="col">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.nombre}>
                <td className="text-xs text-tinta-3 font-medium">{i + 1}</td>
                <td className="text-left text-tinta-2 font-medium truncate max-w-[180px]" title={row.nombre}>
                  {row.nombre}
                </td>
                <td className="font-semibold text-primario">{row.total.toLocaleString("es-CO")}</td>
                <td className="text-tinta-3">{row.porcentaje.toFixed(1)}%</td>
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
      <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-5 w-40 bg-fondo rounded-control animate-pulse" />
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-7 bg-superficie-2 rounded-control animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-6 animate-fade-slide-up">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:divide-x lg:divide-borde">
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
