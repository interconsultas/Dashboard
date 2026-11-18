import type { NextAuthConfig } from "next-auth";
import { esRol, PARAM_SIN_ACCESO, puedeVer, rutaInicio } from "./lib/acceso";

/**
 * Configuración Edge-compatible (sin Node.js crypto).
 * Usada en middleware.ts para proteger rutas sin acceder a la BD.
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

      // Si está en /login y ya autenticado → redirigir al inicio de su rol
      if (isOnLogin) {
        if (isLoggedIn && esRol(rol)) {
          return Response.redirect(new URL(rutaInicio(rol), nextUrl));
        }
        return true;
      }

      // Cualquier otra ruta requiere autenticación
      if (!isLoggedIn) return false;

      // Las rutas /api validan su propio rol con requireAuth (403 en JSON)
      if (pathname === "/api" || pathname.startsWith("/api/")) return true;

      // Sin un rol válido no hay página a la cual enviarlo: vuelve al login
      if (!esRol(rol)) return false;

      if (pathname === "/") {
        return Response.redirect(new URL(rutaInicio(rol), nextUrl));
      }

      if (!puedeVer(rol, pathname)) {
        const destino = new URL(rutaInicio(rol), nextUrl);
        destino.searchParams.set(PARAM_SIN_ACCESO, "1");
        return Response.redirect(destino);
      }

      return true;
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
