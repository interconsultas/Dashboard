"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Spinner } from "@/components/ui/Spinner";
import { urlInforme, type FormatoInforme } from "@/lib/informes/descarga";
import type { TipoInforme } from "@/lib/informes/modelo";
import type { FiltrosProductividad } from "@/lib/productividad/filtros";
import { useDescarga } from "./useDescarga";

interface Opcion {
  id: string;
  etiqueta: string;
  tipo: TipoInforme;
  formato: FormatoInforme;
}

const OPCIONES: Opcion[] = [
  { id: "excel-vista", etiqueta: "Excel — esta vista", tipo: "vista", formato: "excel" },
  { id: "excel-mensual", etiqueta: "Excel — informe mensual", tipo: "mensual", formato: "excel" },
  { id: "pdf-vista", etiqueta: "PDF — esta vista", tipo: "vista", formato: "pdf" },
  { id: "pdf-mensual", etiqueta: "PDF — informe mensual", tipo: "mensual", formato: "pdf" },
];

/** Botón "Exportar" de la cabecera de Productividad: descarga la vista filtrada o el informe mensual. */
export function MenuExportar({ filtros }: { filtros: FiltrosProductividad }) {
  const [abierto, setAbierto] = useState(false);
  const { descargando, error, descargar } = useDescarga();
  const menuId = useId();
  const raiz = useRef<HTMLDivElement>(null);

  // Escape o un clic fuera cierran el menú
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    const alClic = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("mousedown", alClic);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("mousedown", alClic);
    };
  }, [abierto]);

  function elegir(o: Opcion) {
    setAbierto(false);
    void descargar(o.id, urlInforme(o.formato, o.tipo, filtros), o.formato);
  }

  return (
    <div ref={raiz} className="relative">
      <Boton
        variante="secundario"
        tamano="sm"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? menuId : undefined}
        aria-busy={descargando !== null}
        disabled={descargando !== null}
        onClick={() => setAbierto((v) => !v)}
      >
        {descargando ? (
          <>
            <Spinner className="h-3.5 w-3.5" /> Generando…
          </>
        ) : (
          <>Exportar ▾</>
        )}
      </Boton>

      {abierto && (
        <div
          id={menuId}
          role="menu"
          aria-label="Exportar"
          className="absolute right-0 z-30 mt-1.5 w-64 rounded-control border border-borde bg-superficie p-1 shadow-tarjeta"
        >
          {OPCIONES.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitem"
              onClick={() => elegir(o)}
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-tinta hover:bg-primario-suave"
            >
              {o.etiqueta}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="absolute right-0 z-30 mt-1.5 w-64 rounded-control bg-critico-suave px-3 py-2 text-xs text-critico">
          {error}
        </p>
      )}
    </div>
  );
}
