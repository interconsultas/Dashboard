import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";
import { invalidarPermisos } from "@/lib/permisos";
import {
  PERMISOS_API,
  ROLES,
  permisosEfectivos,
  validarCambiosPermisos,
  type FilaPermiso,
  type Permisos,
  type Rol,
} from "@/lib/acceso";

/** Permisos efectivos de cada rol leídos directo de la tabla (sin caché). */
async function matrizPermisos(): Promise<Record<Rol, Permisos>> {
  const filas = await query<FilaPermiso>("SELECT rol, seccion, nivel FROM permisos_rol");
  return Object.fromEntries(ROLES.map((rol) => [rol, permisosEfectivos(rol, filas)])) as Record<
    Rol,
    Permisos
  >;
}

export async function GET() {
  const { error } = await requirePermiso(PERMISOS_API["/api/admin/permisos"].GET);
  if (error) return error;

  return NextResponse.json({ permisos: await matrizPermisos() });
}

/**
 * Cambia niveles de permisos: { cambios: [{ rol, seccion, nivel }] }.
 * No se aceptan cambios a admin ni a la sección usuarios. Se valida todo
 * antes de escribir y se guarda en un único INSERT (una sola transacción).
 */
export async function PUT(request: Request) {
  const { error } = await requirePermiso(PERMISOS_API["/api/admin/permisos"].PUT);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const validacion = validarCambiosPermisos(body);
  if ("error" in validacion) {
    return NextResponse.json({ error: validacion.error }, { status: 400 });
  }
  const { cambios } = validacion;

  const values: string[] = [];
  const tuplas = cambios.map((c) => {
    const base = values.length;
    values.push(c.rol, c.seccion, c.nivel);
    return `($${base + 1}, $${base + 2}, $${base + 3})`;
  });

  await query(
    `INSERT INTO permisos_rol (rol, seccion, nivel)
     VALUES ${tuplas.join(", ")}
     ON CONFLICT (rol, seccion) DO UPDATE
       SET nivel = EXCLUDED.nivel, actualizado_en = NOW()`,
    values,
  );
  invalidarPermisos();

  return NextResponse.json({ actualizados: cambios.length, permisos: await matrizPermisos() });
}
