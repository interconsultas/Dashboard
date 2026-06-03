import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Middleware corre en Edge Runtime — solo usa authConfig (sin Node.js crypto)
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /*
     * Proteger todas las rutas excepto:
     * - /login
     * - /_next (assets de Next.js)
     * - /favicon.ico
     * - /api/auth (callbacks de NextAuth)
     */
    "/((?!login|_next/static|_next/image|favicon.ico|api/auth|api/health|.*\\..*).*)",
  ],
};
