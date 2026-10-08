"use client";

import type { FilaGrilla } from "@/lib/cumplimiento/grilla-citas";

interface Props {
  filas: FilaGrilla[];
  mensajeVacio?: string;
  onCambiarCitas: (documento: string, valor: string) => void;
}

const ENCABEZADOS = ["Profesional", "Cédula", "Citas atendidas", "Programa"];

const campoCls =
  "border rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none";

function EtiquetaEstado({ estado }: { estado: string | null }) {
  if (estado === "ACTIVO") return null;
  return (
    <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500">
      {estado === null ? "Fuera del catálogo" : "Inactivo"}
    </span>
  );
}

export function GrillaCitas({
  filas,
  mensajeVacio = "No hay profesionales para mostrar",
  onCambiarCitas,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-brand-navy">
          <tr>
            {ENCABEZADOS.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {filas.length === 0 && (
            <tr>
              <td colSpan={ENCABEZADOS.length} className="text-center py-10 text-gray-500">
                {mensajeVacio}
              </td>
            </tr>
          )}
          {filas.map((f, idx) => {
            const sinPrograma = f.citas.trim() !== "" && !f.citasInvalida && f.programa === "";
            return (
              <tr
                key={f.documento}
                className={`${
                  idx % 2 === 0 ? "bg-white" : "bg-surface-alt"
                } hover:bg-brand-blue-soft-2 transition-colors`}
              >
                <td className="px-4 py-2 font-medium text-gray-800">
                  {f.nombre}
                  <EtiquetaEstado estado={f.estado} />
                  {f.cambiada && (
                    <span className="ml-2 text-xs text-amber-600">Sin guardar</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-500">{f.documento}</td>
                <td className="px-4 py-2">
                  <input
                    className={`${campoCls} w-28 text-right ${
                      f.citasInvalida ? "border-red-400 bg-red-50" : "border-gray-200"
                    }`}
                    inputMode="numeric"
                    aria-label={`Citas atendidas de ${f.nombre}`}
                    aria-invalid={f.citasInvalida}
                    value={f.citas}
                    onChange={(e) => onCambiarCitas(f.documento, e.target.value)}
                  />
                  {f.citasInvalida && (
                    <p className="text-xs text-red-600 mt-1">Ingrese un número entero</p>
                  )}
                </td>
                <td className="px-4 py-2">
                  {/* Solo lectura: el programa se define en Profesionales */}
                  <span className={f.programa ? "text-gray-700" : "text-amber-700"}>
                    {f.programa || "Sin asignar"}
                  </span>
                  {sinPrograma && (
                    <p className="text-xs text-amber-700 mt-1">Sin programa no hay meta</p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
