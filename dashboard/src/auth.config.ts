import type { NextAuthConfig } from "next-auth";
import { esRol } from "./lib/acceso";

/**
 * Configuración Edge-compatible (sin Node.js crypto).
 * Usada en middleware.ts para exigir sesión sin acceder a la BD. El acceso por
 * sección depende de permisos_rol (BD): lo validan los layouts del servidor
 * (exigirSeccion) y las rutas /api (requirePermiso).
 * Los providers con bcrypt van en lib/auth.ts (Node.js runtime).
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const isOnLogin = pathname.startsWith("/login");
      const rol = (auth?.user as { rol?: unknown } | undefined)?.rol;

      // Si está en /login y ya autenticado → la raíz resuelve el inicio del rol
      if (isOnLogin) {
        if (isLoggedIn && esRol(rol)) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      // Cualquier otra ruta requiere autenticación
      if (!isLoggedIn) return false;

      // Las rutas /api validan su propio permiso con requirePermiso (403 en JSON)
      if (pathname === "/api" || pathname.startsWith("/api/")) return true;

      // Sin un rol válido no hay página a la cual enviarlo: vuelve al login
      return esRol(rol);
    },
    async jwt({ token, user }) {
      if (user) {
        token.rol = (user as { rol?: string }).rol;
        token.regional = (user as { regional?: string | null }).regional;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { rol?: string }).rol = token.rol as string;
        (session.user as { regional?: string | null }).regional =
          token.regional as string | null;
        (session.user as { id?: string }).id = token.sub ?? "";
      }
      return session;
    },
  },
  providers: [], // Los providers reales se agregan en lib/auth.ts
  session: { strategy: "jwt" },
};
