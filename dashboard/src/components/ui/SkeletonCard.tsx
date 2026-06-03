/**
 * Skeleton cards para estados de carga del dashboard.
 * Usa la animación shimmer de globals.css.
 */

/** Skeleton para gráficas (tendencia, distribución, red interna) */
export function SkeletonChart({ height = "h-72" }: { height?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="skeleton h-4 w-40" />
      <div className={`${height} rounded-xl overflow-hidden relative`}>
        {/* Barras simuladas */}
        <div className="absolute inset-0 flex items-end gap-3 px-4 pb-2">
          {[65, 45, 80, 55, 70, 40, 90, 60, 50, 75, 85, 35].map((h, i) => (
            <div key={i} className="flex-1 skeleton rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton para tabla de ranking */
export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="skeleton h-4 w-48" />
      <div className="space-y-3">
        {/* Header */}
        <div className="flex gap-4 pb-2 border-b border-gray-100">
          <div className="skeleton h-3 w-8" />
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-3 w-20 ml-auto" />
          <div className="skeleton h-3 w-16" />
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4" style={{ opacity: 1 - i * 0.08 }}>
            <div className="skeleton h-6 w-6 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-3.5 w-36" />
              <div className="skeleton h-2.5 w-20" />
            </div>
            <div className="skeleton h-4 w-12" />
            <div className="skeleton h-1.5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton para barras horizontales (top servicios) */
export function SkeletonBars({ height = "h-96" }: { height?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 w-36" />
        <div className="skeleton h-8 w-28 rounded-lg" />
      </div>
      <div className={`${height} flex flex-col justify-center gap-3 px-4`}>
        {[90, 75, 65, 55, 48, 40, 35, 28, 22, 18].map((w, i) => (
          <div key={i} className="flex items-center gap-3" style={{ opacity: 1 - i * 0.06 }}>
            <div className="skeleton h-3 w-36 flex-shrink-0" />
            <div className="skeleton h-5 rounded" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton para red interna/externa (dona + lista) */
export function SkeletonDonut() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="skeleton h-4 w-44 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dona */}
        <div className="flex flex-col items-center gap-3">
          <div className="skeleton w-44 h-44 rounded-full" />
          <div className="flex gap-6">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-3 w-16" />
          </div>
        </div>
        {/* Lista */}
        <div className="space-y-3">
          <div className="skeleton h-3 w-32 mb-2" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1" style={{ opacity: 1 - i * 0.1 }}>
              <div className="flex justify-between">
                <div className="skeleton h-3 w-32" />
                <div className="skeleton h-3 w-10" />
              </div>
              <div className="skeleton h-1.5 rounded-full" style={{ width: `${80 - i * 10}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
