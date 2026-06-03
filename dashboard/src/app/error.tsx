"use client";

import { ErrorState } from "@/components/layout/ErrorState";

/**
 * Boundary global. Atrapa errores que escapan a los `error.tsx` por sección
 * (ej. fallos en /login o en rutas sin layout específico).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-app p-6">
      <ErrorState error={error} reset={reset} />
    </div>
  );
}
