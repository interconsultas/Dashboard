"use client";

import type { FilaGrilla } from "@/lib/cumplimiento/grilla-citas";

interface Props {
  filas: FilaGrilla[];
  mensajeVacio?: string;
  onCambiarCitas: (documento: string, valor: string) => void;
  /** Solo consulta: las citas no se pueden editar. */
  soloLectura?: boolean;
}

const ENCABEZADOS = ["Profesional", "Cédula", "Citas atendidas", "Programa"];

const campoCls =
  "border rounded-control px-3 py-1.5 text-sm text-tinta-2 focus:outline-none";

function EtiquetaEstado({ estado }: { estado: string | null }) {
  if (estado === "ACTIVO") return null;
  return (
    <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-md bg-fondo text-tinta-3">
      {estado === null ? "Fuera del catálogo" : "Inactivo"}
    </span>
  );
}

export function GrillaCitas({
  filas,
  mensajeVacio = "No hay profesionales para mostrar",
  onCambiarCitas,
  soloLectura = false,
}: Props) {
  return (
    <div className="overflow-x-auto bg-superficie rounded-tarjeta border border-borde shadow-tarjeta">
      <table className="tabla tabla-texto">
        <thead>
          <tr>
            {ENCABEZADOS.map((h) => (
              <th
                key={h}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr>
              <td colSpan={ENCABEZADOS.length} className="text-center !py-10 text-tinta-3">
                {mensajeVacio}
              </td>
            </tr>
          )}
          {filas.map((f) => {
            const sinPrograma = f.citas.trim() !== "" && !f.citasInvalida && f.programa === "";
            return (
              <tr key={f.documento}>
                <td className="font-medium text-tinta">
                  {f.nombre}
                  <EtiquetaEstado estado={f.estado} />
                  {f.cambiada && (
                    <span className="ml-2 text-xs text-atencion">Sin guardar</span>
                  )}
                </td>
                <td className="text-tinta-3">{f.documento}</td>
                <td>
                  <input
                    className={`${campoCls} w-28 text-right ${
                      f.citasInvalida ? "border-critico bg-critico-suave" : "border-borde"
                    }`}
                    inputMode="numeric"
                    aria-label={`Citas atendidas de ${f.nombre}`}
                    aria-invalid={f.citasInvalida}
                    value={f.citas}
                    readOnly={soloLectura}
                    onChange={(e) => onCambiarCitas(f.documento, e.target.value)}
                  />
                  {f.citasInvalida && (
                    <p className="text-xs text-critico mt-1">Ingrese un número entero</p>
                  )}
                </td>
                <td>
                  {/* Solo lectura: el programa sale de la especialidad (Metas › Programas por especialidad) */}
                  <span className={f.programa ? "text-tinta-2" : "text-atencion"}>
                    {f.programa || "Sin asignar"}
                  </span>
                  {sinPrograma && (
                    <p className="text-xs text-atencion mt-1">Sin programa no hay meta</p>
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
