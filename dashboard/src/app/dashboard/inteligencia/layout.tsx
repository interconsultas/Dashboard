import { ModuloEnDesarrollo } from "@/components/layout/ModuloEnDesarrollo";
import { exigirSeccion } from "@/lib/acceso-servidor";

/**
 * Solo entra quien puede ver la sección según permisos_rol. Mientras el módulo
 * esté en desarrollo (MODULOS_EN_DESARROLLO), nadie ve su contenido, admin
 * incluido: quien lo verá al liberarse recibe solo el aviso "Módulo en desarrollo".
 */
export default async function SeccionLayout({ children }: { children: React.ReactNode }) {
  const acceso = await exigirSeccion("inteligencia");
  if (acceso === "en_desarrollo") return <ModuloEnDesarrollo seccion="inteligencia" />;
  return children;
}
