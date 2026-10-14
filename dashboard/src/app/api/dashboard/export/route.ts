import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth, regionalClause } from "@/lib/middleware-roles";
import { type FiltrosBody, wb, toW, buildAll, parseBody } from "@/lib/dashboard-filters";
import { resolveView, getViewFilters } from "@/lib/view-registry";
import { EXPORT_COLUMNS } from "@/lib/export-columns";

const MAX_ROWS = 500_000;
const CHUNK_SIZE = 2_000;

/* ── CSV helpers ─────────────────────────────── */

function escapeCsv(val: unknown): string {
  if (val == null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/* ── Handler ─────────────────────────────────── */

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["admin", "direccion_medica", "coordinador"]);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body: FiltrosBody = await req.json().catch(() => ({}));
  const view = resolveView(body.view);
  const viewFilters = getViewFilters(view);

  // Los filtros de la vista siempre tienen prioridad (son las condiciones fijas)
  const merged: FiltrosBody = { ...body, ...viewFilters };
  const p = parseBody(merged);
  const reg = regionalClause(user, 1, "r");

  const b = wb();
  buildAll(b, p, reg);

  const selectCols = EXPORT_COLUMNS.map((c) => `${c.sql} AS ${c.alias}`).join(", ");
  const sql = `SELECT ${selectCols} FROM autorizaciones r ${toW(b)} ORDER BY periodo, nombre_medico LIMIT ${MAX_ROWS}`;

  // Nombre del archivo incluye la vista para identificar la exportación
  const viewLabel = view === "vm_filtros_dashboard" ? "general" : view.replace("vm_dash_", "");
  const filename = `autorizaciones_${viewLabel}_${p.desde ?? "todos"}_${p.hasta ?? "todos"}.csv`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const client = await pool.connect();
      try {
        // Sin timeout para consultas de exportación
        await client.query("SET statement_timeout = 0");

        // Enviar BOM + encabezados inmediatamente
        const header = "﻿" + EXPORT_COLUMNS.map((c) => escapeCsv(c.header)).join(",") + "\r\n";
        controller.enqueue(encoder.encode(header));

        // Ejecutar consulta
        const result = await client.query(sql, b.params);

        // Enviar filas en chunks para no saturar memoria
        for (let i = 0; i < result.rows.length; i += CHUNK_SIZE) {
          const chunk = result.rows.slice(i, i + CHUNK_SIZE);
          const lines = chunk
            .map((row) => EXPORT_COLUMNS.map((c) => escapeCsv(row[c.alias])).join(","))
            .join("\r\n") + "\r\n";
          controller.enqueue(encoder.encode(lines));
        }

        controller.close();
      } catch (err) {
        console.error("Export error:", err);
        controller.error(err);
      } finally {
        await client.query("SET statement_timeout = DEFAULT").catch(() => {});
        client.release();
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache",
    },
  });
}
