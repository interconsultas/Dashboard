"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { fmtPeriodo } from "@/lib/periodo";

/** Resultado del Excel de citas por médico (una columna por mes). */
interface ResultadoExcel {
  formato?: undefined;
  registros: number;
  periodos: number[];
  profesionales: number;
  sin_catalogo: { documento: string; nombre: string | null }[];
  sin_programa: number;
  advertencias: string[];
  /** Filas con nombre y valores pero sin cédula (columna ID): no se cargaron. */
  sin_cedula?: { fila: number; nombre: string }[];
}

/** Resultado del informe de citas detallado por profesional (Agenda Web). */
interface ResultadoDetallado {
  formato: "detallado";
  periodo: number;
  fecha_inicial: string; // YYYY-MM-DD
  fecha_final: string;
  granularidad: "mensual" | "semanal";
  filas: number;
  registros: number;
  filas_agrupadas: number;
  profesionales: number;
  servicios: number;
  servicios_nuevos: { codigo: string; nombre: string }[];
  /** Profesionales actualizados en citas_atendidas (0 en cargas semanales). */
  citas_atendidas: number;
  periodos: number[];
  sin_catalogo: { documento: string; nombre: string | null }[];
  sin_programa: number;
  advertencias: string[];
}

type ResultadoImport = ResultadoExcel | ResultadoDetallado;

interface Props {
  /** Se invoca tras una importación exitosa con los periodos cargados (YYYYMM, en orden). */
  onImportado: (periodos: number[]) => void;
}

const RUTA_PROFESIONALES = "/admin/medicos";
/** El programa de metas se resuelve desde la especialidad del profesional. */
const RUTA_MAPEO_PROGRAMAS = "/admin/metas/programas";
const ERROR_GENERICO = "Error al importar el archivo";

function plural(n: number, singular: string, pluralTxt: string) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

/** "2026-10-01" → "01/10/2026" (sin pasar por Date para no correr el día por la zona horaria). */
function fmtFecha(iso: string) {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

const avisoCls = "text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2";
const infoCls = "text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2";
const enlaceCls = "font-semibold underline";

/** Lista larga que se muestra solo si el usuario la despliega. */
function ListaColapsable({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer select-none">{etiqueta}</summary>
      <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">{children}</ul>
    </details>
  );
}

function ResumenDetallado({ resultado }: { resultado: ResultadoDetallado }) {
  const mensual = resultado.granularidad === "mensual";
  return (
    <>
      <p
        role="status"
        className="text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
      >
        Informe detallado cargado: {fmtFecha(resultado.fecha_inicial)} –{" "}
        {fmtFecha(resultado.fecha_final)} ({resultado.granularidad}).{" "}
        {plural(resultado.filas, "fila", "filas")},{" "}
        {plural(resultado.profesionales, "profesional", "profesionales")},{" "}
        {plural(resultado.servicios, "servicio", "servicios")}
        {resultado.filas_agrupadas > 0
          ? ` (${plural(resultado.filas_agrupadas, "fila repetida se sumó", "filas repetidas se sumaron")})`
          : ""}
        .{" "}
        {mensual
          ? `Citas atendidas de ${fmtPeriodo(resultado.periodo)} actualizadas para ${plural(
              resultado.citas_atendidas,
              "profesional",
              "profesionales"
            )}.`
          : "Las cargas semanales no modifican las citas atendidas del mes."}
      </p>

      {resultado.servicios_nuevos.length > 0 && (
        <div data-aviso="info" className={infoCls}>
          <p className="font-semibold">
            {plural(
              resultado.servicios_nuevos.length,
              "servicio nuevo en el catálogo",
              "servicios nuevos en el catálogo"
            )}
          </p>
          <ListaColapsable etiqueta="Ver servicios">
            {resultado.servicios_nuevos.map((s) => (
              <li key={s.codigo}>{`${s.codigo} — ${s.nombre}`}</li>
            ))}
          </ListaColapsable>
        </div>
      )}

      {resultado.sin_catalogo.length > 0 && (
        <div data-aviso="info" className={infoCls}>
          <p className="font-semibold">
            {plural(
              resultado.sin_catalogo.length,
              "profesional del informe no se mide en cumplimiento porque no está registrado en Profesionales",
              "profesionales del informe no se miden en cumplimiento porque no están registrados en Profesionales"
            )}
          </p>
          <p className="mt-1">
            Su detalle se guardó para el tablero de citas. Para medir su cumplimiento, regístrelos en{" "}
            <Link href={RUTA_PROFESIONALES} className={enlaceCls}>
              Profesionales
            </Link>{" "}
            y vuelva a importar el informe.
          </p>
          <ListaColapsable etiqueta="Ver profesionales">
            {resultado.sin_catalogo.map((m) => (
              <li key={m.documento}>
                {m.nombre ? `${m.nombre} — cédula ${m.documento}` : `Cédula ${m.documento}`}
              </li>
            ))}
          </ListaColapsable>
        </div>
      )}
    </>
  );
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

  const excel = resultado?.formato === "detallado" ? null : resultado;
  const sinCedula = excel?.sin_cedula ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
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
          {importando ? "Importando…" : "Importar informe"}
        </label>
      </div>

      {resultado && (
        <div className="flex flex-col gap-2 text-xs">
          {resultado.formato === "detallado" && <ResumenDetallado resultado={resultado} />}

          {excel && (
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
          )}

          {excel && excel.sin_catalogo.length > 0 && (
            <div className={avisoCls}>
              <p className="font-semibold">
                {plural(
                  excel.sin_catalogo.length,
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
                {excel.sin_catalogo.map((m) => (
                  <li key={m.documento}>
                    {m.nombre ? `${m.nombre} — cédula ${m.documento}` : `Cédula ${m.documento}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultado.sin_programa > 0 && (
            <p className={avisoCls}>
              {plural(
                resultado.sin_programa,
                "profesional cargado no tiene programa",
                "profesionales cargados no tienen programa"
              )}
              ; sin programa no hay meta con la cual medir el cumplimiento.{" "}
              <Link href={RUTA_MAPEO_PROGRAMAS} className={enlaceCls}>
                Asignar la meta por especialidad
              </Link>
            </p>
          )}

          {sinCedula.length > 0 && (
            <div className={avisoCls}>
              <p className="font-semibold">
                {plural(
                  sinCedula.length,
                  "fila del archivo no tiene cédula (columna ID) y no se cargó",
                  "filas del archivo no tienen cédula (columna ID) y no se cargaron"
                )}
              </p>
              <p className="mt-1">Complete la cédula en el archivo y vuelva a importarlo.</p>
              <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                {sinCedula.map((f) => (
                  <li key={f.fila}>{`Fila ${f.fila} — ${f.nombre}`}</li>
                ))}
              </ul>
            </div>
          )}

          {resultado.advertencias.length > 0 && (
            <div className={avisoCls}>
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
