import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";
import { PERMISOS_API } from "@/lib/acceso";

export async function GET() {
  const { error } = await requirePermiso(PERMISOS_API["/api/dashboard/kpis"].GET);
  if (error) return error;

  const [row] = await query<{
    total_autorizaciones: string;
    periodo_max: number | null;
  }>(
    `SELECT COUNT(*) AS total_autorizaciones,
            MAX(periodo) AS periodo_max
     FROM autorizaciones`
  );

  return NextResponse.json({
    total_autorizaciones: Number(row?.total_autorizaciones ?? 0),
    periodo_max: row?.periodo_max ?? null,
  });
}
