import { Tarjeta } from "@/components/ui/Tarjeta";

/** Tarjeta de un visual del tablero: título, ayuda y contenido (sobre la Tarjeta base). */
export function Panel({
  titulo,
  ayuda,
  acciones,
  children,
  className = "",
}: {
  titulo: string;
  ayuda?: React.ReactNode;
  acciones?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tarjeta titulo={titulo} ayuda={ayuda} acciones={acciones} className={`h-full ${className}`}>
      {children}
    </Tarjeta>
  );
}

/** Estado vacío dentro de un panel. */
export function SinDatos({ children, className = "h-[300px]" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center text-center text-sm text-tinta-3 bg-superficie-2 border border-dashed border-borde rounded-control p-5 ${className}`}
    >
      {children}
    </div>
  );
}
