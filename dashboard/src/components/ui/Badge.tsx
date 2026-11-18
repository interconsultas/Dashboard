import { EstadoCarga } from "@/types/carga";

const ESTADO_CONFIG: Record<
  EstadoCarga,
  { label: string; className: string }
> = {
  procesando:             { label: "Procesando...",    className: "bg-primario-suave text-primario" },
  previsualizando:        { label: "Previsualizando",  className: "bg-primario-suave text-primario" },
  esperando_confirmacion: { label: "En espera",        className: "bg-atencion-suave text-atencion" },
  cargando:               { label: "Cargando...",      className: "bg-primario-suave text-primario" },
  exitoso:                { label: "Exitoso",          className: "bg-bien-suave text-bien" },
  exitoso_con_advertencias:{ label: "Con advertencias",className: "bg-atencion-suave text-atencion" },
  cancelado:              { label: "Cancelado",        className: "bg-fondo text-tinta-2" },
  error_fatal:            { label: "Error",            className: "bg-critico-suave text-critico" },
  ya_procesado:           { label: "Duplicado",        className: "bg-atencion-suave text-atencion" },
  eliminando:             { label: "Eliminando...",    className: "bg-primario-suave text-primario" },
  eliminado:              { label: "Eliminado",        className: "bg-fondo text-tinta-2" },
};

export function BadgeEstado({ estado }: { estado: EstadoCarga }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, className: "bg-fondo text-tinta-2" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
