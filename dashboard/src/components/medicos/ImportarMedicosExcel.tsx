"use client";

import { useRef, useState } from "react";

interface ResultadoImport {
  filas_procesadas: number;
  registros_en_bd: number;
  errores: number;
}

interface Props {
  onImportado: () => void;
}

export function ImportarMedicosExcel({ onImportado }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setError(null);
    setResultado(null);
    setImportando(true);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      const res = await fetch("/api/admin/medicos/importar", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Error al importar el archivo");
        return;
      }
      setResultado(json as ResultadoImport);
      onImportado();
    } finally {
      setImportando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          disabled={importando}
          onChange={handleFileChange}
          className="hidden"
          id="importar-medicos-input"
        />
        <label
          htmlFor="importar-medicos-input"
          className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
        >
          {importando ? "Importando…" : "Importar Excel"}
        </label>
      </div>
      {resultado && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Importación completada: {resultado.filas_procesadas} filas procesadas,{" "}
          {resultado.registros_en_bd} en base de datos
          {resultado.errores > 0 ? `, ${resultado.errores} con error` : ""}.
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
