"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { fmtPeriodo } from "@/lib/periodo";

interface ResultadoImport {
  registros: number;
  periodos: number[];
  profesionales: number;
  sin_catalogo: { documento: string; nombre: string | null }[];
  sin_programa: number;
  advertencias: string[];
}

interface Props {
  /** Se invoca tras una importación exitosa con los periodos cargados (YYYYMM, en orden). */
  onImportado: (periodos: number[]) => void;
}

const RUTA_PROFESIONALES = "/admin/medicos";
const ERROR_GENERICO = "Error al importar el archivo";

function plural(n: number, singular: string, pluralTxt: string) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

export function ImportarCitasExcel({ onImportado }: Props) {
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
      const res = await fetch("/api/admin/citas-atendidas/importar", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? ERROR_GENERICO);
        return;
      }
      const importado = json as ResultadoImport;
      setResultado(importado);
      onImportado(importado.periodos);
    } catch {
      setError(ERROR_GENERICO);
    } finally {
      setImportando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const enlaceCls = "font-semibold underline";

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
          id="importar-citas-input"
        />
        <label
          htmlFor="importar-citas-input"
          className={`px-5 py-2 rounded-lg text-sm font-semibold text-white bg-brand-navy transition-colors ${
            importando ? "opacity-60" : "hover:bg-brand-navy-dark cursor-pointer"
          }`}
        >
          {importando ? "Importando…" : "Importar Excel"}
        </label>
      </div>

      {resultado && (
        <div className="flex flex-col gap-2 text-xs">
          <p
            role="status"
            className="text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
          >
            Importación completada:{" "}
            {plural(resultado.registros, "registro cargado", "registros cargados")} de{" "}
            {plural(resultado.profesionales, "profesional", "profesionales")}
            {resultado.periodos.length > 0
              ? `. Periodos: ${resultado.periodos.map(fmtPeriodo).join(", ")}.`
              : "."}
          </p>

          {resultado.sin_catalogo.length > 0 && (
            <div className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="font-semibold">
                {plural(
                  resultado.sin_catalogo.length,
                  "profesional del archivo no está en el catálogo y no se cargó",
                  "profesionales del archivo no están en el catálogo y no se cargaron"
                )}
              </p>
              <p className="mt-1">
                Debe crearlos primero en{" "}
                <Link href={RUTA_PROFESIONALES} className={enlaceCls}>
                  Profesionales
                </Link>{" "}
                y volver a importar el archivo.
              </p>
              <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                {resultado.sin_catalogo.map((m) => (
                  <li key={m.documento}>
                    {m.nombre ? `${m.nombre} — cédula ${m.documento}` : `Cédula ${m.documento}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultado.sin_programa > 0 && (
            <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {plural(
                resultado.sin_programa,
                "profesional cargado no tiene programa",
                "profesionales cargados no tienen programa"
              )}
              ; sin programa no hay meta con la cual medir el cumplimiento.{" "}
              <Link href={RUTA_PROFESIONALES} className={enlaceCls}>
                Asignar el programa en Profesionales
              </Link>
            </p>
          )}

          {resultado.advertencias.length > 0 && (
            <div className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="font-semibold">
                {plural(resultado.advertencias.length, "advertencia", "advertencias")}
              </p>
              <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                {resultado.advertencias.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          {error}
        </p>
      )}
    </div>
  );
}
