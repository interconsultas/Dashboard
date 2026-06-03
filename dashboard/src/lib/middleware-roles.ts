import { auth } from "./auth";
import { NextResponse } from "next/server";

export type Rol = "admin" | "direccion_medica" | "coordinador";

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

/**
 * Valida sesión y roles en API Routes (Node.js runtime).
 * Uso: const { error, user } = await requireAuth(["admin", "direccion_medica"]);
 *      if (error) return error;
 */
export async function requireAuth(allowedRoles?: Rol[]): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
      user: null,
    };
  }

  const u = session.user as SessionUser;

  if (allowedRoles && !allowedRoles.includes(u.rol)) {
    return {
      error: NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 }),
      user: null,
    };
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
