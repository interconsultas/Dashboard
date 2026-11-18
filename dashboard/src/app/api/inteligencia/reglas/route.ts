import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";
import { PERMISOS_API } from "@/lib/acceso";
import { clearCachePrefix } from "@/lib/cache";
import { leerReglas, PREFIJO_CACHE_ALERTAS } from "@/lib/inteligencia/datosAlertas";
import { validarCambiosReglas } from "@/lib/inteligencia/reglas";

export async function GET() {
  const { error } = await requirePermiso(PERMISOS_API["/api/inteligencia/reglas"].GET);
  if (error) return error;
  return NextResponse.json({ reglas: await leerReglas() });
}

class ReglaInexistente extends Error {}

/**
 * Cambia reglas de alerta: { reglas: [{ clave, activa, umbral, periodos, minimo }] }.
 * Se valida todo antes de escribir; se guarda en una sola transacción con
 * quién y cuándo, y se invalida el caché de alertas.
 */
export async function PUT(request: Request) {
  const { error, user } = await requirePermiso(PERMISOS_API["/api/inteligencia/reglas"].PUT);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const validacion = validarCambiosReglas(body);
  if ("error" in validacion) return NextResponse.json({ error: validacion.error }, { status: 400 });
  const { cambios } = validacion;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const c of cambios) {
      const res = await client.query(
        `UPDATE reglas_alerta
         SET activa = $2, umbral = $3, periodos = $4, minimo = $5,
             actualizado_en = NOW(), actualizado_por = $6
         WHERE clave = $1`,
        [c.clave, c.activa, c.umbral, c.periodos, c.minimo, user?.email ?? null]
      );
      if (!res.rowCount) throw new ReglaInexistente(c.clave);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err instanceof ReglaInexistente) {
      return NextResponse.json({ error: `La regla ${err.message} no existe en la base de datos` }, { status: 409 });
    }
    console.error("[inteligencia/reglas] Update failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "No se pudieron guardar las reglas" }, { status: 500 });
  } finally {
    client.release();
  }

  clearCachePrefix(PREFIJO_CACHE_ALERTAS);
  return NextResponse.json({ actualizadas: cambios.length, reglas: await leerReglas() });
}
