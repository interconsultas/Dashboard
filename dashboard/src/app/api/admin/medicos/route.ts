import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";

export async function GET() {
  const { error } = await requireAuth(["admin", "direccion_medica"]);
  if (error) return error;

  const rows = await query<{
    usuario_txt: string;
    identificacion: number;
    nombre: string;
    estado: string | null;
    programa_especialidad: string | null;
    area: string | null;
  }>(
    `SELECT usuario_txt, identificacion, nombre, estado,
            programa_especialidad, area
     FROM medicos ORDER BY nombre`
  );
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const body = await request.json();
  const { usuario_txt, identificacion, nombre, estado, programa_especialidad, area } = body;

  if (!usuario_txt || !identificacion || !nombre) {
    return NextResponse.json(
      { error: "Campos requeridos: usuario_txt, identificacion, nombre" },
      { status: 400 }
    );
  }

  const existing = await queryOne(
    "SELECT usuario_txt FROM medicos WHERE usuario_txt = $1",
    [usuario_txt]
  );
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe un profesional con ese usuario TXT" },
      { status: 409 }
    );
  }

  await queryOne(
    `INSERT INTO medicos (usuario_txt, identificacion, nombre, estado, programa_especialidad, area)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [usuario_txt, identificacion, nombre, estado || "ACTIVO", programa_especialidad || null, area || null]
  );

  return NextResponse.json({ usuario_txt }, { status: 201 });
}
