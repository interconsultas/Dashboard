"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  onUpload: (jobId: string) => void;
}

export function DropzoneArchivo({ onUpload }: Props) {
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      const file = accepted[0];

      setErrorMsg(null);
      setUploading(true);

      const form = new FormData();
      form.append("archivo", file);

      try {
        const res = await fetch("/api/carga/upload", {
          method: "POST",
          body: form,
        });
        const data = await res.json();

        if (!res.ok) {
          setErrorMsg(data.error ?? "Error al subir el archivo");
          return;
        }
        onUpload(data.job_id);
      } catch {
        setErrorMsg("Error de red. Verifica tu conexión e intenta de nuevo.");
      } finally {
        setUploading(false);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          isDragActive
            ? "border-brand-green bg-brand-green-soft scale-[1.01]"
            : uploading
            ? "border-gray-200 bg-gray-50 cursor-not-allowed"
            : "border-gray-300 hover:border-brand-navy hover:bg-brand-blue-soft"
        }`}
      >
        <input {...getInputProps()} />

        {uploading ? (
          <div className="flex flex-col items-center gap-3 text-[#1F497D]">
            <Spinner className="h-8 w-8" />
            <p className="text-sm font-medium">Subiendo archivo...</p>
          </div>
        ) : isDragActive ? (
          <div className="flex flex-col items-center gap-2 text-[#1F497D]">
            <span className="text-4xl">📂</span>
            <p className="text-sm font-medium">Suelta el archivo aquí</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <span className="text-5xl">📊</span>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Arrastra el archivo Excel aquí
              </p>
              <p className="text-xs mt-1">
                o haz clic para seleccionarlo desde tu computador
              </p>
              <p className="text-xs mt-2 text-gray-400">
                Solo archivos .xlsx — DETALLADOS EPS
              </p>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span className="mt-0.5">⚠</span>
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
