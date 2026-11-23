"use client";

import { useSearchParams } from "next/navigation";
import { PARAM_SIN_ACCESO } from "@/lib/acceso";

/** Aviso breve cuando el middleware redirigió desde una sección que el rol no puede abrir. */
export function AvisoSinAcceso() {
  const params = useSearchParams();
  if (params.get(PARAM_SIN_ACCESO) !== "1") return null;

  return (
    <div
      role="status"
      className="mb-4 px-4 py-2.5 rounded-lg text-sm border border-amber-200 bg-amber-50 text-amber-800 print:hidden"
    >
      No tiene acceso a esa sección.
    </div>
  );
}
