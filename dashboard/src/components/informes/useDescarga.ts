"use client";

import { useCallback, useState } from "react";
import { descargarArchivo } from "@/lib/informes/descarga";

/** Estado de una descarga de informe: cuál se está generando y el último error. */
export function useDescarga() {
  const [descargando, setDescargando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const descargar = useCallback(async (id: string, url: string) => {
    setDescargando(id);
    setError(null);
    try {
      await descargarArchivo(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el informe");
    } finally {
      setDescargando(null);
    }
  }, []);

  return { descargando, error, descargar };
}
