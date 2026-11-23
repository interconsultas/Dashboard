import { EncabezadoPagina } from "./EncabezadoPagina";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { SECCIONES, type Seccion } from "@/lib/acceso";

function IconoHerramienta() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.5 3.5a3.5 3.5 0 00-4.3 4.3L3.5 12.5a1.4 1.4 0 002 2l4.7-4.7a3.5 3.5 0 004.3-4.3l-2 2-2-.5-.5-2 2-2z" />
    </svg>
  );
}

/**
 * Pantalla de un módulo en desarrollo (dentro del shell de la app), para
 * cualquier rol que lo vería ya liberado, admin incluido. Solo el aviso: nada
 * del contenido, alcance ni cronograma del módulo.
 */
export function ModuloEnDesarrollo({ seccion }: { seccion: Seccion }) {
  const nombre = SECCIONES.find((s) => s.clave === seccion)?.etiqueta ?? seccion;
  return (
    <div className="space-y-4">
      <EncabezadoPagina migas={[{ etiqueta: "Análisis" }, { etiqueta: nombre }]} titulo={nombre} />
      <Tarjeta as="div">
        <EstadoVacio
          compacto
          icono={<IconoHerramienta />}
          titulo="Módulo en desarrollo"
          descripcion="Este módulo estará disponible próximamente."
        />
      </Tarjeta>
    </div>
  );
}
