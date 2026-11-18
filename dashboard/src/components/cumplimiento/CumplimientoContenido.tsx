import Link from "next/link";
import { CATEGORIAS } from "@/lib/cumplimiento/categorias";
import { TEXTO_ATRIBUCION } from "@/lib/cumplimiento/informe";
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
import { usePuedeVer } from "@/components/layout/RolContext";
import { clasesBoton } from "@/components/ui/Boton";

interface Props {
  datos: RespuestaCumplimiento;
  /** Cédula del profesional en detalle; null = vista general. */
  documento: string | null;
  onSeleccionar: (documento: string | null) => void;
}

const RUTA_CITAS = "/admin/citas";
/** El programa de metas se resuelve desde la especialidad del profesional. */
const RUTA_MAPEO_PROGRAMAS = "/admin/metas/programas";

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clasesBoton({ variante: "secundario" })}
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
  const veCitas = usePuedeVer(RUTA_CITAS);

  // ── Sin citas cargadas en ningún periodo ──
  if (datos.periodos_disponibles.length === 0) {
    return (
      <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-8 text-center space-y-3">
        <h2 className="font-titulo text-lg font-bold text-tinta">Aún no hay citas atendidas cargadas</h2>
        <p className="text-sm text-tinta-3 max-w-xl mx-auto">
          El cumplimiento compara las órdenes de cada profesional con sus citas atendidas. Cargue primero
          las citas atendidas del periodo para ver este tablero.
        </p>
        {veCitas && (
          <Link
            href={RUTA_CITAS}
            className={clasesBoton()}
          >
            Ir a Citas
          </Link>
        )}
      </div>
    );
  }

  const atribucion = <p className="text-[11px] text-tinta-3">{TEXTO_ATRIBUCION[datos.atribucion]}</p>;

  // ── Tablero de un profesional ──
  if (documento !== null) {
    const profesional = datos.profesionales.find((p) => p.documento === documento);

    if (!profesional) {
      return (
        <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-8 text-center space-y-4">
          <p className="text-sm text-tinta-3">
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
      <div className="space-y-6">
        <div
          data-testid="encabezado-profesional"
          className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta px-6 py-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="font-titulo text-lg sm:text-xl font-bold text-tinta break-words">{profesional.nombre}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm text-tinta-3 tabular-nums">Cédula {profesional.documento}</span>
              {profesional.programa ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primario-suave text-primario">
                  {profesional.programa}
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-atencion-suave text-atencion">
                  Sin programa
                </span>
              )}
            </div>
          </div>
          <BotonVolver onClick={() => onSeleccionar(null)} />
        </div>

        {sinPrograma && (
          <p role="note" className="rounded-tarjeta border border-atencion/30 bg-atencion-suave px-5 py-4 text-sm text-atencion">
            Este profesional tiene citas atendidas en periodos sin programa asignado. Sin programa no hay
            meta y no se calcula el porcentaje de esos periodos.{" "}
            <Link href={RUTA_MAPEO_PROGRAMAS} className="font-semibold underline">
              Asignar la meta por especialidad
            </Link>
          </p>
        )}

        <TarjetasCumplimiento resumen={profesional} />

        <GraficaGlobalMensual
          serie={serieGlobal(serie)}
          subtitulo="Promedio de las categorías con meta en cada mes"
        />

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-titulo text-[15px] font-bold text-tinta">Tendencia por indicador</h2>
            <LeyendaTendencia />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
    <div className="space-y-6">
      {sinPrograma > 0 && (
        <p role="note" className="rounded-tarjeta border border-atencion/30 bg-atencion-suave px-5 py-4 text-sm text-atencion">
          {sinPrograma === 1
            ? "1 profesional del listado tiene citas atendidas pero no tiene programa asignado."
            : `${sinPrograma} profesionales del listado tienen citas atendidas pero no tienen programa asignado.`}{" "}
          Sin programa no hay meta y no se calcula su porcentaje.{" "}
          <Link href={RUTA_MAPEO_PROGRAMAS} className="font-semibold underline">
            Asignar la meta por especialidad
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
