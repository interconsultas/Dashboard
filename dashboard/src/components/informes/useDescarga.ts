"use client";

import { useCallback, useState } from "react";
import { descargarArchivo, type FormatoInforme } from "@/lib/informes/descarga";

/**
 * Estado de una descarga de informe: cuál se está generando y el último error.
 * El Excel lo arma el servidor; el PDF se arma en el navegador con un import
 * dinámico, así @react-pdf/renderer no pesa en el bundle del tablero.
 */
export function useDescarga() {
  const [descargando, setDescargando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const descargar = useCallback(async (id: string, url: string, formato: FormatoInforme = "excel") => {
    setDescargando(id);
    setError(null);
    try {
      if (formato === "pdf") {
        const { descargarInformePdf } = await import("./pdf/generar");
        await descargarInformePdf(url);
      } else {
        await descargarArchivo(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el informe");
    } finally {
      setDescargando(null);
    }
  }, []);

  return { descargando, error, descargar };
}
