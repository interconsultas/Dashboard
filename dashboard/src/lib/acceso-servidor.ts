import { redirect } from "next/navigation";
import { cumpleRequisito, destinoSinAcceso, rutaInicio, RUTA_SIN_SECCIONES } from "@/lib/acceso";
import type { Permisos, Rol, Seccion } from "@/lib/acceso";
import { rolDeSesion } from "@/lib/middleware-roles";
import { obtenerEnDesarrollo, obtenerPermisos } from "@/lib/permisos";

/**
 * Validación de acceso a páginas en el servidor (layouts y páginas). El
 * middleware (Edge) solo exige sesión porque no puede leer permisos_rol.
 */

/**
 * Rol, permisos efectivos y secciones en desarrollo que el rol vería ya
 * liberadas (el menú las muestra con la etiqueta "En desarrollo").
 */
export async function sesionConPermisos(): Promise<
  | { rol: Rol; permisos: Permisos; enDesarrollo: Seccion[] }
  | { rol: null; permisos: null; enDesarrollo: Seccion[] }
> {
  const rol = await rolDeSesion();
  if (!rol) return { rol: null, permisos: null, enDesarrollo: [] };
  const [permisos, enDesarrollo] = await Promise.all([obtenerPermisos(rol), obtenerEnDesarrollo(rol)]);
  return { rol, permisos, enDesarrollo };
}

/**
 * Cómo se abre una sección:
 *   - completo: contenido normal.
 *   - vista_previa: módulo en desarrollo abierto por admin (contenido + aviso).
 *   - en_desarrollo: módulo en desarrollo que el rol vería ya liberado (solo el aviso).
 */
export type AccesoSeccion = "completo" | "vista_previa" | "en_desarrollo";

/** Redirige si el rol de la sesión no puede ver la sección. Llamar desde el layout de la sección. */
export async function exigirSeccion(seccion: Seccion): Promise<AccesoSeccion> {
  const { rol, permisos, enDesarrollo } = await sesionConPermisos();
  if (!rol) redirect("/login");
  const enDesarrolloVisible = enDesarrollo.includes(seccion);
  if (cumpleRequisito(permisos, { secciones: [seccion], nivel: "ver" })) {
    return enDesarrolloVisible ? "vista_previa" : "completo";
  }
  if (enDesarrolloVisible) return "en_desarrollo";
  redirect(destinoSinAcceso(rol, permisos));
}

/** Página a la que va la raíz "/": inicio del rol, /sin-acceso o el login. */
export async function rutaDeEntrada(): Promise<string> {
  const { rol, permisos } = await sesionConPermisos();
  if (!rol) return "/login";
  return rutaInicio(rol, permisos) ?? RUTA_SIN_SECCIONES;
}
