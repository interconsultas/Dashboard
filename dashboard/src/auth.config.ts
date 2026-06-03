import type { NextAuthConfig } from "next-auth";

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
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      // Si está en /login y ya autenticado → redirigir al panel
      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/admin/carga", nextUrl));
        }
        return true;
      }

      // Cualquier otra ruta requiere autenticación
      if (!isLoggedIn) return false;

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
