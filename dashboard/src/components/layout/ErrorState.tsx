"use client";

import { Boton, clasesBoton } from "@/components/ui/Boton";

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
    <div role="alert" className="bg-superficie rounded-tarjeta border border-critico/30 shadow-tarjeta p-8 max-w-xl mx-auto">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-critico-suave text-lg font-bold text-critico">!</span>
        <div className="flex-1 min-w-0">
          <h2 className="font-titulo text-lg font-bold text-tinta">{titulo}</h2>
          <p className="text-sm text-tinta-2 mt-1 break-words">
            {error.message || "Error desconocido"}
          </p>
          {error.digest && (
            <p className="text-xs text-tinta-3 mt-2 font-mono">
              Ref: {error.digest}
            </p>
          )}
          <div className="flex items-center gap-2 mt-4">
            <Boton onClick={reset}>Reintentar</Boton>
            <a href="/" className={clasesBoton({ variante: "secundario" })}>
              Ir al inicio
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
