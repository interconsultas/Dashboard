import { EstadoCarga } from "@/types/carga";

const ESTADO_CONFIG: Record<
  EstadoCarga,
  { label: string; className: string }
> = {
  procesando:             { label: "Procesando...",    className: "bg-blue-100 text-blue-800" },
  previsualizando:        { label: "Previsualizando",  className: "bg-blue-100 text-blue-800" },
  esperando_confirmacion: { label: "En espera",        className: "bg-yellow-100 text-yellow-800" },
  cargando:               { label: "Cargando...",      className: "bg-blue-100 text-blue-800" },
  exitoso:                { label: "Exitoso",          className: "bg-green-100 text-green-800" },
  exitoso_con_advertencias:{ label: "Con advertencias",className: "bg-yellow-100 text-yellow-800" },
  cancelado:              { label: "Cancelado",        className: "bg-gray-100 text-gray-700" },
  error_fatal:            { label: "Error",            className: "bg-red-100 text-red-800" },
  ya_procesado:           { label: "Duplicado",        className: "bg-orange-100 text-orange-800" },
};

export function BadgeEstado({ estado }: { estado: EstadoCarga }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, className: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
