/**
 * Visibilidad de páginas por rol: única fuente de verdad para el middleware,
 * el menú lateral y los enlaces dentro de las páginas.
 *
 * Módulo puro y Edge-compatible (sin BD ni APIs de Node): lo usa auth.config.ts.
 * Refleja lo que ya permiten las rutas /api con requireAuth([...]).
 */

export type Rol = "admin" | "direccion_medica" | "coordinador";

const ROLES: readonly Rol[] = ["admin", "direccion_medica", "coordinador"];

interface ReglaAcceso {
  prefijo: string;
  roles: readonly Rol[];
}

/** Gana la regla de prefijo más largo (por segmentos completos). */
export const REGLAS_ACCESO: readonly ReglaAcceso[] = [
  // Raíz: solo redirige al inicio de cada rol
  { prefijo: "/", roles: ROLES },
  // Dashboard de autorizaciones (incluye /dashboard/tipo/*)
  { prefijo: "/dashboard", roles: ROLES },
  { prefijo: "/dashboard/cumplimiento", roles: ["admin", "direccion_medica"] },
  { prefijo: "/dashboard/productividad", roles: ["admin", "direccion_medica"] },
  // Administración: por defecto solo admin (carga, médicos, citas, usuarios y lo que se agregue)
  { prefijo: "/admin", roles: ["admin"] },
  // Metas: dirección médica consulta; editar sigue siendo solo admin (PUT /api/admin/metas*)
  { prefijo: "/admin/metas", roles: ["admin", "direccion_medica"] },
];

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

function coincide(pathname: string, prefijo: string): boolean {
  if (prefijo === "/") return pathname.startsWith("/");
  return pathname === prefijo || pathname.startsWith(`${prefijo}/`);
}

/** ¿Puede el rol abrir la página? Rol ausente o desconocido: no. */
export function puedeVer(rol: string | null | undefined, pathname: string): boolean {
  if (!esRol(rol)) return false;
  const ruta = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  let regla: ReglaAcceso | null = null;
  for (const r of REGLAS_ACCESO) {
    if (coincide(ruta, r.prefijo) && (!regla || r.prefijo.length > regla.prefijo.length)) {
      regla = r;
    }
  }
  return regla !== null && regla.roles.includes(rol);
}

/** Parámetro que el middleware agrega al inicio cuando niega una página. */
export const PARAM_SIN_ACCESO = "sin_acceso";

/** Página de inicio de cada rol (destino tras el login y al negar el acceso). */
export function rutaInicio(rol: Rol): string {
  return rol === "admin" ? "/admin/carga" : "/dashboard";
}

/** Editar metas y el mapeo de programas: solo admin, igual que los PUT de la API. */
export function puedeEditarMetas(rol: string | null | undefined): boolean {
  return rol === "admin";
}
