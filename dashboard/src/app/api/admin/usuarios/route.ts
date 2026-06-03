import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import bcrypt from "bcryptjs";

const VALID_ROLES = new Set(["admin", "direccion_medica", "coordinador"]);

export async function GET() {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const rows = await query<{
    id: number; email: string; nombre: string;
    rol: string; regional: string | null; activo: boolean; last_login: string | null;
  }>(
    `SELECT id, email, nombre, rol, regional, activo,
            TO_CHAR(last_login, 'DD/MM/YYYY HH24:MI') AS last_login
     FROM usuarios ORDER BY nombre`
  );
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const body = await request.json();
  const { email, nombre, password, rol, regional } = body;

  if (!email || !nombre || !password || !rol) {
    return NextResponse.json({ error: "Campos requeridos: email, nombre, password, rol" }, { status: 400 });
  }

  if (!VALID_ROLES.has(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const existing = await queryOne("SELECT id FROM usuarios WHERE email = $1", [email]);
  if (existing) {
    return NextResponse.json({ error: "Ya existe un usuario con ese correo" }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 12);
  const row = await queryOne<{ id: number }>(
    `INSERT INTO usuarios (email, nombre, password_hash, rol, regional, activo)
     VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
    [email, nombre, hash, rol, regional ?? null]
  );

  return NextResponse.json({ id: row?.id }, { status: 201 });
}
