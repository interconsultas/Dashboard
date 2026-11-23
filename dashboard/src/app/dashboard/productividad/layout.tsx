import { AvisoVistaPrevia, ModuloEnDesarrollo } from "@/components/layout/ModuloEnDesarrollo";
import { exigirSeccion } from "@/lib/acceso-servidor";

/**
 * Solo entra quien puede ver la sección según permisos_rol. Mientras el módulo
 * esté en desarrollo (MODULOS_EN_DESARROLLO), admin lo ve con el aviso de vista
 * previa y quien lo verá al liberarse, la pantalla "Módulo en desarrollo".
 */
export default async function SeccionLayout({ children }: { children: React.ReactNode }) {
  const acceso = await exigirSeccion("productividad");
  if (acceso === "en_desarrollo") return <ModuloEnDesarrollo seccion="productividad" />;
  if (acceso === "vista_previa") {
    return (
      <>
        <AvisoVistaPrevia />
        {children}
      </>
    );
  }
  return children;
}
