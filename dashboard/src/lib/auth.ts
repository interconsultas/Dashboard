import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { queryOne } from "./db";
import { authConfig } from "@/auth.config";

interface UsuarioDB {
  id: number;
  email: string;
  password_hash: string;
  nombre: string;
  rol: string;
  regional: string | null;
  activo: boolean;
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}

function clearRateLimit(email: string): void {
  loginAttempts.delete(email);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase();
        if (!checkRateLimit(email)) return null;

        const user = await queryOne<UsuarioDB>(
          "SELECT id, email, password_hash, nombre, rol, regional, activo FROM usuarios WHERE email = $1",
          [email]
        );

        if (!user || !user.activo) return null;

        const ok = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );
        if (!ok) return null;

        clearRateLimit(email);

        await queryOne(
          "UPDATE usuarios SET last_login = NOW() WHERE id = $1",
          [user.id]
        );

        return {
          id: String(user.id),
          email: user.email,
          name: user.nombre,
          rol: user.rol,
          regional: user.regional,
        };
      },
    }),
  ],
});
