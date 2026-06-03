import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import bcrypt from "bcryptjs";

const VALID_ROLES = new Set(["admin", "direccion_medica", "coordinador"]);

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error, user } = await requireAuth(["admin"]);
  if (error) return error;

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await request.json();
  const { nombre, rol, regional, activo, password } = body;

  // Auto-protección: el admin no puede cambiarse a sí mismo de rol ni desactivarse.
  const isSelf = String(id) === user!.id;
  if (isSelf) {
    if (rol !== undefined && rol !== user!.rol) {
      return NextResponse.json(
        { error: "No puedes cambiar tu propio rol" },
        { status: 400 }
      );
    }
    if (activo === false) {
      return NextResponse.json(
        { error: "No puedes desactivar tu propia cuenta" },
        { status: 400 }
      );
    }
  }

  if (rol !== undefined && !VALID_ROLES.has(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  if (password) {
    const hash = await bcrypt.hash(password, 12);
    await queryOne(
      `UPDATE usuarios SET password_hash = $1 WHERE id = $2`,
      [hash, id]
    );
  }

  // UPDATE dinámico: solo tocar los campos presentes en el body.
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (nombre !== undefined)   { updates.push(`nombre=$${idx++}`);   values.push(nombre); }
  if (rol !== undefined)      { updates.push(`rol=$${idx++}`);      values.push(rol); }
  if (regional !== undefined) { updates.push(`regional=$${idx++}`); values.push(regional ?? null); }
  if (activo !== undefined)   { updates.push(`activo=$${idx++}`);   values.push(activo); }

  if (updates.length > 0) {
    values.push(id);
    await queryOne(
      `UPDATE usuarios SET ${updates.join(", ")} WHERE id=$${idx}`,
      values
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { error, user } = await requireAuth(["admin"]);
  if (error) return error;

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  if (String(id) === user!.id) {
    return NextResponse.json(
      { error: "No puedes desactivar tu propia cuenta" },
      { status: 400 }
    );
  }

  await queryOne("UPDATE usuarios SET activo = false WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
