"use client";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
  /** Texto del encabezado. Default: "Algo salió mal" */
  titulo?: string;
}

/**
 * Vista de error reutilizable para los `error.tsx` de cada sección.
 * Renderiza el mensaje del error y un botón para reintentar el render.
 */
export function ErrorState({ error, reset, titulo = "Algo salió mal" }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 max-w-xl mx-auto">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
          <p className="text-sm text-gray-500 mt-1 break-words">
            {error.message || "Error desconocido"}
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 mt-2 font-mono">
              Ref: {error.digest}
            </p>
          )}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-navy-dark transition-colors"
            >
              Reintentar
            </button>
            <a
              href="/admin/carga"
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Ir al inicio
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
