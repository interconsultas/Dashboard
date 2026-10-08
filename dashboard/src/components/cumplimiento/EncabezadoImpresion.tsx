import { fmtFechaGeneracion, programasFiltrados, rangoPeriodos } from "@/lib/cumplimiento/impresion";

interface Props {
  desde: number | null;
  hasta: number | null;
  /** Programas del filtro aplicado; null = aún no se aplicó ningún filtro. */
  programas: string[] | null;
  /** Profesional en detalle; null = vista general. */
  profesional: { nombre: string; documento: string; programa: string | null } | null;
  /** Leyenda de cómo se atribuyen las órdenes. */
  atribucion: string;
  generado: Date;
}

/** Contexto del reporte que solo se muestra al imprimir: rango, filtros, profesional y fecha. */
export function EncabezadoImpresion({ desde, hasta, programas, profesional, atribucion, generado }: Props) {
  const rango = rangoPeriodos(desde, hasta);
  const programa = programasFiltrados(programas);

  return (
    <div data-testid="encabezado-impresion" className="hidden print:block mt-2 space-y-0.5 text-xs text-gray-700">
      {profesional && (
        <p className="text-sm font-semibold text-brand-navy">
          {`Profesional: ${profesional.nombre} · Cédula ${profesional.documento} · ${
            profesional.programa ? `Programa ${profesional.programa}` : "Sin programa"
          }`}
        </p>
      )}
      {rango && <p>{`Periodo: ${rango}`}</p>}
      {programa && <p>{`Programa: ${programa}`}</p>}
      <p className="text-gray-500">{`${atribucion} · Generado el ${fmtFechaGeneracion(generado)}`}</p>
    </div>
  );
}
