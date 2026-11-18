/** Tarjeta de un visual del tablero: título, ayuda y contenido. */
export function Panel({
  titulo,
  ayuda,
  children,
  className = "",
}: {
  titulo: string;
  ayuda?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`h-full flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 sm:px-5 min-w-0 ${className}`}>
      <h2 className="text-[15px] font-semibold text-brand-navy">{titulo}</h2>
      {ayuda && <p className="text-xs text-gray-400 mt-0.5 mb-2">{ayuda}</p>}
      {children}
    </section>
  );
}

/** Estado vacío dentro de un panel. */
export function SinDatos({ children, className = "h-[300px]" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center text-center text-sm text-gray-400 bg-surface-alt border border-dashed border-gray-200 rounded-xl p-5 ${className}`}
    >
      {children}
    </div>
  );
}
