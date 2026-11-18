import Link from "next/link";
import { Fragment } from "react";

export interface Miga {
  etiqueta: string;
  href?: string;
}

/**
 * Cabecera de página de la dirección visual C: degradado de marca (azul
 * oscuro → azul del logo → verde), radio 20 y texto blanco.
 *
 * - `migas`: ruta de navegación ("Análisis / Productividad"); las que tienen
 *   `href` son enlaces.
 * - `acciones`: controles a la derecha (periodo, exportar…). Van sobre el
 *   degradado: usar controles con fondo propio (Segmentado, Select, Boton).
 * - `children`: franja inferior opcional dentro de la cabecera (p. ej. pestañas).
 */
export function EncabezadoPagina({
  titulo,
  subtitulo,
  migas,
  acciones,
  children,
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  migas?: readonly Miga[];
  acciones?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="rounded-tarjeta bg-cabecera text-white px-5 py-5 sm:px-6 print:bg-none print:text-tinta print:px-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {migas && migas.length > 0 && (
            <nav aria-label="Ruta" className="mb-1 text-xs text-white/75">
              <ol className="flex flex-wrap items-center gap-1">
                {migas.map((m, i) => (
                  <Fragment key={`${m.etiqueta}-${i}`}>
                    {i > 0 && <li aria-hidden>/</li>}
                    <li>
                      {m.href ? (
                        <Link href={m.href} className="hover:text-white hover:underline">
                          {m.etiqueta}
                        </Link>
                      ) : (
                        <span aria-current={i === migas.length - 1 ? "page" : undefined}>{m.etiqueta}</span>
                      )}
                    </li>
                  </Fragment>
                ))}
              </ol>
            </nav>
          )}
          <h1 className="font-titulo text-2xl sm:text-[26px] font-extrabold tracking-tight leading-tight">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-white/85">{subtitulo}</p>}
        </div>
        {acciones && <div className="flex flex-wrap items-end gap-3">{acciones}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}
