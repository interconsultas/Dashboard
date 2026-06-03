import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const usuario_txt = decodeURIComponent(params.id);
  const body = await request.json();
  const { identificacion, nombre, estado, programa_especialidad, area } = body;

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (identificacion !== undefined) { updates.push(`identificacion=$${idx++}`); values.push(identificacion); }
  if (nombre !== undefined)         { updates.push(`nombre=$${idx++}`);         values.push(nombre); }
  if (estado !== undefined)         { updates.push(`estado=$${idx++}`);         values.push(estado); }
  if (programa_especialidad !== undefined) { updates.push(`programa_especialidad=$${idx++}`); values.push(programa_especialidad); }
  if (area !== undefined)           { updates.push(`area=$${idx++}`);           values.push(area); }

  if (updates.length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  values.push(usuario_txt);
  await queryOne(
    `UPDATE medicos SET ${updates.join(", ")} WHERE usuario_txt=$${idx}`,
    values
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const usuario_txt = decodeURIComponent(params.id);

  await queryOne("DELETE FROM medicos WHERE usuario_txt = $1", [usuario_txt]);
  return NextResponse.json({ ok: true });
}
