"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { DropzoneArchivo } from "@/components/carga/DropzoneArchivo";
import { InformeValidacion } from "@/components/carga/InformeValidacion";
import { ListaArchivos } from "@/components/carga/ListaArchivos";
import { fetcher } from "@/lib/fetcher";
import { usePuedeEditar } from "@/components/layout/RolContext";
import { LogCarga } from "@/types/carga";
import { EncabezadoPagina } from "@/components/layout/EncabezadoPagina";

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
      <EncabezadoPagina
        migas={[{ etiqueta: "Administración" }, { etiqueta: "Carga de archivos" }]}
        titulo="Carga de archivos"
        subtitulo="Sube los archivos DETALLADOS EPS semanales para actualizar el sistema."
      />

      {/* Panel de carga o informe activo */}
      {(editable || activeJobId) && (
        <div className="bg-superficie rounded-tarjeta border border-borde p-6 shadow-tarjeta">
          {activeJobId ? (
            <InformeValidacion jobId={activeJobId} onReset={handleReset} puedeConfirmar={editable} />
          ) : (
            <DropzoneArchivo onUpload={handleUpload} />
          )}
        </div>
      )}
      {!editable && (
        <p className="text-xs text-tinta-3 bg-superficie-2 border border-borde rounded-control px-3 py-2">
          Solo consulta: puede revisar el historial y los informes, pero no cargar ni eliminar archivos.
        </p>
      )}

      {/* Historial */}
      <div>
        <h2 className="font-titulo text-lg font-bold text-tinta mb-3">
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
