/**
 * Skeleton de carga reutilizable para los `loading.tsx` de cada sección.
 * Muestra el encabezado y placeholders en grid mientras Next.js suspende
 * el render del Server Component.
 */
export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-56 bg-gray-200 rounded" />
        <div className="h-3 w-72 bg-gray-100 rounded mt-2" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="h-3 bg-gray-100 rounded w-2/3 mb-4" />
            <div className="h-8 bg-gray-100 rounded w-1/2 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/3" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm h-64" />
        ))}
      </div>
    </div>
  );
}
