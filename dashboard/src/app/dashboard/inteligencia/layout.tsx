import { exigirSeccion } from "@/lib/acceso-servidor";

/** Solo entra quien puede ver la sección según permisos_rol. */
export default async function SeccionLayout({ children }: { children: React.ReactNode }) {
  await exigirSeccion("inteligencia");
  return children;
}
