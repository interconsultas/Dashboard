"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { DropzoneArchivo } from "@/components/carga/DropzoneArchivo";
import { InformeValidacion } from "@/components/carga/InformeValidacion";
import { ListaArchivos } from "@/components/carga/ListaArchivos";
import { fetcher } from "@/lib/fetcher";
import { usePuedeEditar } from "@/components/layout/RolContext";
import { LogCarga } from "@/types/carga";

export default function CargaPage() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  // Con nivel 'ver' la página queda en solo consulta (la API rechaza las escrituras)
  const editable = usePuedeEditar("carga");

  const { data: historial, mutate } = useSWR<LogCarga[]>(
    "/api/carga/historial",
    fetcher,
    { refreshInterval: activeJobId ? 0 : 15_000 }
  );

  // Recargar historial cuando termina un job activo
  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(() => mutate(), 5000);
    return () => clearInterval(interval);
  }, [activeJobId, mutate]);

  function handleUpload(jobId: string) {
    setActiveJobId(jobId);
    mutate();
  }

  function handleReset() {
    setActiveJobId(null);
    mutate();
  }

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Carga de archivos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sube los archivos DETALLADOS EPS semanales para actualizar el sistema.
        </p>
      </div>

      {/* Panel de carga o informe activo */}
      {(editable || activeJobId) && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          {activeJobId ? (
            <InformeValidacion jobId={activeJobId} onReset={handleReset} puedeConfirmar={editable} />
          ) : (
            <DropzoneArchivo onUpload={handleUpload} />
          )}
        </div>
      )}
      {!editable && (
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          Solo consulta: puede revisar el historial y los informes, pero no cargar ni eliminar archivos.
        </p>
      )}

      {/* Historial */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Historial de cargas
        </h2>
        <ListaArchivos
          cargas={historial ?? []}
          onVerInforme={(jobId) => setActiveJobId(jobId)}
          onEliminado={() => mutate()}
          puedeEliminar={editable}
        />
      </div>
    </div>
  );
}
