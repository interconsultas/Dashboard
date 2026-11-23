import { query } from "@/lib/db";
import {
  PERMISOS_POR_DEFECTO,
  ROLES,
  SECCIONES,
  permisosEfectivos,
  seccionesEnDesarrolloVisibles,
  type FilaPermiso,
  type Permisos,
  type Rol,
  type Seccion,
} from "@/lib/acceso";
import { modulosEnDesarrollo } from "@/lib/modulos";

/**
 * Lectura de permisos_rol con caché en memoria (Node.js runtime).
 *
 * La tabla es pequeña (roles × secciones): se lee completa y se guarda
 * TTL_PERMISOS_MS. PUT /api/admin/permisos llama a invalidarPermisos(), así que
 * en el mismo proceso los cambios se ven en la siguiente solicitud; el TTL
 * acota la espera si hubiera varios procesos.
 *
 * El caché vive en globalThis: Next.js puede cargar este módulo más de una vez
 * (páginas y rutas /api, recargas en desarrollo) y todas deben compartirlo.
 */
export const TTL_PERMISOS_MS = 30_000;

interface CachePermisos {
  filas: Promise<FilaPermiso[]> | null;
  expira: number;
}

declare global {
  // eslint-disable-next-line no-var
  var _permisosRol: CachePermisos | undefined;
}

function cache(): CachePermisos {
  return (globalThis._permisosRol ??= { filas: null, expira: 0 });
}

/** Filas equivalentes al acceso fijo anterior (si 018 aún no se aplicó). */
function filasPorDefecto(): FilaPermiso[] {
  return ROLES.flatMap((rol) =>
    SECCIONES.map((s) => ({ rol, seccion: s.clave, nivel: PERMISOS_POR_DEFECTO[rol][s.clave] })),
  );
}

async function leerFilas(): Promise<FilaPermiso[]> {
  try {
    return await query<FilaPermiso>("SELECT rol, seccion, nivel FROM permisos_rol");
  } catch (err) {
    if ((err as { code?: string }).code === "42P01") {
      console.error("[permisos] Falta la tabla permisos_rol (018): se usa el acceso por defecto");
      return filasPorDefecto();
    }
    throw err;
  }
}

async function filasEnCache(): Promise<FilaPermiso[]> {
  const c = cache();
  if (!c.filas || Date.now() > c.expira) {
    const lectura = leerFilas();
    c.filas = lectura;
    c.expira = Date.now() + TTL_PERMISOS_MS;
    // Un error no queda guardado: la siguiente solicitud vuelve a intentar
    lectura.catch(() => {
      if (c.filas === lectura) c.filas = null;
    });
  }
  return c.filas;
}

/**
 * Permisos efectivos del rol. admin no consulta la base: siempre tiene acceso total.
 * Las secciones en desarrollo (MODULOS_EN_DESARROLLO) quedan sin acceso para los demás.
 */
export async function obtenerPermisos(rol: Rol): Promise<Permisos> {
  if (rol === "admin") return permisosEfectivos("admin", []);
  return permisosEfectivos(rol, await filasEnCache(), modulosEnDesarrollo());
}

/** Secciones en desarrollo que el rol vería ya liberadas (admin: todas, como vista previa). */
export async function obtenerEnDesarrollo(rol: Rol): Promise<Seccion[]> {
  const enDesarrollo = modulosEnDesarrollo();
  if (rol === "admin" || enDesarrollo.length === 0) return seccionesEnDesarrolloVisibles(rol, [], enDesarrollo);
  return seccionesEnDesarrolloVisibles(rol, await filasEnCache(), enDesarrollo);
}

/** Descarta el caché; llamar después de guardar permisos. */
export function invalidarPermisos(): void {
  const c = cache();
  c.filas = null;
  c.expira = 0;
}
