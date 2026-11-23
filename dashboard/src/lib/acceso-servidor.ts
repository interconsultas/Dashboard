import { redirect } from "next/navigation";
import { cumpleRequisito, destinoSinAcceso, rutaInicio, RUTA_SIN_SECCIONES } from "@/lib/acceso";
import type { Permisos, Rol, Seccion } from "@/lib/acceso";
import { rolDeSesion } from "@/lib/middleware-roles";
import { obtenerPermisos } from "@/lib/permisos";

/**
 * Validación de acceso a páginas en el servidor (layouts y páginas). El
 * middleware (Edge) solo exige sesión porque no puede leer permisos_rol.
 */

export async function sesionConPermisos(): Promise<
  { rol: Rol; permisos: Permisos } | { rol: null; permisos: null }
> {
  const rol = await rolDeSesion();
  if (!rol) return { rol: null, permisos: null };
  return { rol, permisos: await obtenerPermisos(rol) };
}

/** Redirige si el rol de la sesión no puede ver la sección. Llamar desde el layout de la sección. */
export async function exigirSeccion(seccion: Seccion): Promise<void> {
  const { rol, permisos } = await sesionConPermisos();
  if (!rol) redirect("/login");
  if (!cumpleRequisito(permisos, { secciones: [seccion], nivel: "ver" })) {
    redirect(destinoSinAcceso(rol, permisos));
  }
}

/** Página a la que va la raíz "/": inicio del rol, /sin-acceso o el login. */
export async function rutaDeEntrada(): Promise<string> {
  const { rol, permisos } = await sesionConPermisos();
  if (!rol) return "/login";
  return rutaInicio(rol, permisos) ?? RUTA_SIN_SECCIONES;
}
