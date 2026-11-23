import { EncabezadoPagina } from "./EncabezadoPagina";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { Estado } from "@/components/ui/Estado";
import { Tarjeta } from "@/components/ui/Tarjeta";
import type { Seccion } from "@/lib/acceso";

interface InfoModulo {
  nombre: string;
  proposito: string;
  incluye: readonly string[];
  fase: string;
}

/** Lo que traerá cada módulo en desarrollo (sin fechas: solo la fase del cronograma). */
const INFO: Partial<Record<Seccion, InfoModulo>> = {
  productividad: {
    nombre: "Productividad",
    proposito: "Seguimiento de la oferta y el uso de las citas por área, servicio y profesional.",
    incluye: [
      "Indicadores de citas por mes y por semana",
      "Filtros cruzados",
      "Productividad por profesional y ficha individual",
      "Exportación a PDF y Excel",
    ],
    fase: "Fase 2",
  },
  inteligencia: {
    nombre: "Inteligencia",
    proposito: "Análisis de las relaciones entre los datos para anticipar dónde actuar.",
    incluye: [
      "Mapa de relaciones",
      "Simulador «¿qué pasa si…?»",
      "Alertas y proyección del siguiente periodo",
    ],
    fase: "Fase 3",
  },
};

function IconoHerramienta() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.5 3.5a3.5 3.5 0 00-4.3 4.3L3.5 12.5a1.4 1.4 0 002 2l4.7-4.7a3.5 3.5 0 004.3-4.3l-2 2-2-.5-.5-2 2-2z" />
    </svg>
  );
}

/** Pantalla para quien verá el módulo cuando se entregue (dentro del shell de la app). */
export function ModuloEnDesarrollo({ seccion }: { seccion: Seccion }) {
  const info = INFO[seccion];
  const nombre = info?.nombre ?? seccion;
  return (
    <div className="space-y-4">
      <EncabezadoPagina
        migas={[{ etiqueta: "Análisis" }, { etiqueta: nombre }]}
        titulo={nombre}
        subtitulo={info?.proposito}
        acciones={<Estado tono="atencion">En desarrollo</Estado>}
      />
      <Tarjeta as="div">
        <EstadoVacio
          compacto
          icono={<IconoHerramienta />}
          titulo="Módulo en desarrollo"
          descripcion={
            info
              ? `Se entrega en la ${info.fase} del cronograma. Cuando esté disponible aparecerá aquí con tus permisos actuales.`
              : "Este módulo aún no está disponible."
          }
          accion={
            info && (
              <div className="text-left">
                <p className="text-sm font-semibold text-tinta">Incluirá:</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-tinta-2 space-y-0.5">
                  {info.incluye.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )
          }
        />
      </Tarjeta>
    </div>
  );
}

/** Aviso fijo (no se puede cerrar) sobre un módulo en desarrollo que admin ve como vista previa. */
export function AvisoVistaPrevia() {
  return (
    <div
      role="note"
      className="mb-3 flex items-center gap-2 rounded-control border border-borde bg-atencion-suave px-3 py-1.5 text-xs font-semibold text-atencion"
    >
      <span aria-hidden>▲</span>
      Vista previa — módulo en desarrollo, solo visible para administradores
    </div>
  );
}
