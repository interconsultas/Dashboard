import { auth } from "./auth";
import { NextResponse } from "next/server";
import { cumpleRequisito, esRol, type Requisito, type Rol } from "./acceso";
import { obtenerPermisos } from "./permisos";

export type { Rol };

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  rol: Rol;
  regional: string | null;
}

export interface AuthResult {
  error: NextResponse | null;
  user: SessionUser | null;
}

/** Rol de la sesión actual para las páginas (server components); null sin sesión o rol inválido. */
export async function rolDeSesion(): Promise<Rol | null> {
  const session = await auth();
  const rol = (session?.user as { rol?: unknown } | undefined)?.rol;
  return esRol(rol) ? rol : null;
}

const noAutenticado = () => NextResponse.json({ error: "No autenticado" }, { status: 401 });
const sinPermisos = () => NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });

/**
 * Valida sesión y permisos en API Routes (Node.js runtime) según permisos_rol.
 * Uso: const { error, user } = await requirePermiso(PERMISOS_API["/api/admin/metas"].GET);
 *      if (error) return error;
 */
export async function requirePermiso(requisito: Requisito): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user) return { error: noAutenticado(), user: null };

  const u = session.user as SessionUser;
  if (!esRol(u.rol)) return { error: sinPermisos(), user: null };

  if (!cumpleRequisito(await obtenerPermisos(u.rol), requisito)) {
    return { error: sinPermisos(), user: null };
  }
  return { error: null, user: u };
}

/**
 * Agrega cláusula WHERE de regional si el rol es coordinador.
 * Retorna { clause: string, params: any[] } para inyectar en la query.
 */
export function regionalClause(
  user: SessionUser,
  paramIndex: number,
  tableAlias = "a"
): { clause: string; params: (string | null)[] } {
  if (user.rol === "coordinador" && user.regional) {
    return {
      clause: `AND ${tableAlias}.desc_regional_afiliado = $${paramIndex}`,
      params: [user.regional],
    };
  }
  return { clause: "", params: [] };
}
