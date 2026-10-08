import Link from "next/link";
import { CATEGORIAS } from "@/lib/cumplimiento/categorias";
import type { RespuestaCumplimiento } from "@/lib/cumplimiento/tipos";
import {
  contarSinPrograma,
  serieDeCategoria,
  serieDeFilas,
  serieGlobal,
} from "@/lib/cumplimiento/presentacion";
import { TarjetasCumplimiento } from "./TarjetasCumplimiento";
import { GraficaGlobalMensual } from "./GraficaGlobalMensual";
import { LeyendaTendencia, TendenciaIndicador } from "./TendenciaIndicador";
import { TablaRanking } from "./TablaRanking";
import { TablaHistorial } from "./TablaHistorial";

interface Props {
  datos: RespuestaCumplimiento;
  /** Cédula del profesional en detalle; null = vista general. */
  documento: string | null;
  onSeleccionar: (documento: string | null) => void;
}

const RUTA_CITAS = "/admin/citas-atendidas";
const RUTA_PROFESIONALES = "/admin/medicos";

export const TEXTO_ATRIBUCION: Record<RespuestaCumplimiento["atribucion"], string> = {
  ordenador: "Órdenes atribuidas al médico ordenador",
  digitador: "Órdenes atribuidas al usuario que digitó",
};

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="print:hidden flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-brand-navy bg-brand-blue-soft hover:bg-brand-navy hover:text-white transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Volver al ranking
    </button>
  );
}

/** Contenido del dashboard de cumplimiento: vista general o tablero de un profesional. */
export function CumplimientoContenido({ datos, documento, onSeleccionar }: Props) {
  // ── Sin citas cargadas en ningún periodo ──
  if (datos.periodos_disponibles.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Aún no hay citas atendidas cargadas</h2>
        <p className="text-sm text-gray-500 max-w-xl mx-auto">
          El cumplimiento compara las órdenes de cada profesional con sus citas atendidas. Cargue primero
          las citas atendidas del periodo para ver este tablero.
        </p>
        <Link
          href={RUTA_CITAS}
          className="inline-flex px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-navy-dark transition-colors"
        >
          Ir a Citas atendidas
        </Link>
      </div>
    );
  }

  const atribucion = <p className="print:hidden text-[11px] text-gray-500">{TEXTO_ATRIBUCION[datos.atribucion]}</p>;

  // ── Tablero de un profesional ──
  if (documento !== null) {
    const profesional = datos.profesionales.find((p) => p.documento === documento);

    if (!profesional) {
      return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
          <p className="text-sm text-gray-500">
            El profesional seleccionado no tiene citas atendidas en el rango y los programas seleccionados.
          </p>
          <div className="flex justify-center">
            <BotonVolver onClick={() => onSeleccionar(null)} />
          </div>
        </div>
      );
    }

    const filas = datos.filas.filter((f) => f.documento === documento);
    const serie = serieDeFilas(filas);
    const sinPrograma = contarSinPrograma(filas) > 0;

    return (
      <div className="space-y-6 print:space-y-4">
        <div
          data-testid="encabezado-profesional"
          className="print:hidden bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-brand-navy break-words">{profesional.nombre}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm text-gray-500 tabular-nums">Cédula {profesional.documento}</span>
              {profesional.programa ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-blue-soft text-brand-navy">
                  {profesional.programa}
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                  Sin programa
                </span>
              )}
            </div>
          </div>
          <BotonVolver onClick={() => onSeleccionar(null)} />
        </div>

        {sinPrograma && (
          <p role="note" className="print:break-inside-avoid rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            Este profesional tiene citas atendidas en periodos sin programa asignado. Sin programa no hay
            meta y no se calcula el porcentaje de esos periodos.{" "}
            <Link href={RUTA_PROFESIONALES} className="font-semibold underline">
              Asignar el programa en Profesionales
            </Link>
          </p>
        )}

        <TarjetasCumplimiento resumen={profesional} />

        <GraficaGlobalMensual
          serie={serieGlobal(serie)}
          subtitulo="Promedio de las categorías con meta en cada mes"
        />

        <div className="space-y-3 print:break-inside-avoid">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tendencia por indicador</p>
            <LeyendaTendencia />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 print:grid-cols-4 [.cumplimiento-imprimiendo_&]:grid-cols-4">
            {CATEGORIAS.map((c) => (
              <TendenciaIndicador key={c.clave} etiqueta={c.etiqueta} serie={serieDeCategoria(serie, c.clave)} />
            ))}
          </div>
        </div>

        <TablaHistorial filas={filas} />

        {atribucion}
      </div>
    );
  }

  // ── Vista general ──
  const sinPrograma = contarSinPrograma(datos.filas);

  return (
    <div className="space-y-6 print:space-y-4">
      {sinPrograma > 0 && (
        <p role="note" className="print:break-inside-avoid rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          {sinPrograma === 1
            ? "1 profesional del listado tiene citas atendidas pero no tiene programa asignado."
            : `${sinPrograma} profesionales del listado tienen citas atendidas pero no tienen programa asignado.`}{" "}
          Sin programa no hay meta y no se calcula su porcentaje.{" "}
          <Link href={RUTA_PROFESIONALES} className="font-semibold underline">
            Asignar el programa en Profesionales
          </Link>
        </p>
      )}

      <TarjetasCumplimiento resumen={datos.resumen} />

      <GraficaGlobalMensual serie={serieGlobal(datos.serieMensual)} />

      <TablaRanking profesionales={datos.profesionales} onSeleccionar={onSeleccionar} />

      {atribucion}
    </div>
  );
}
