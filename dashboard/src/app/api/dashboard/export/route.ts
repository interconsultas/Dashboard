import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth, regionalClause } from "@/lib/middleware-roles";
import { type FiltrosBody, wb, toW, buildAll, parseBody } from "@/lib/dashboard-filters";
import { resolveView, getViewFilters } from "@/lib/view-registry";

/* ── Columnas a exportar ────────────────────── */

const EXPORT_COLUMNS = [
  { sql: "periodo",                                                          alias: "periodo",                  header: "Periodo" },
  { sql: "numero_documento",                                                 alias: "numero_documento",         header: "Documento" },
  { sql: "primer_apellido",                                                  alias: "primer_apellido",          header: "Primer Apellido" },
  { sql: "segundo_apellido",                                                 alias: "segundo_apellido",         header: "Segundo Apellido" },
  { sql: "primer_nombre",                                                    alias: "primer_nombre",            header: "Primer Nombre" },
  { sql: "segundo_nombre",                                                   alias: "segundo_nombre",           header: "Segundo Nombre" },
  { sql: "edad",                                                             alias: "edad",                     header: "Edad" },
  { sql: "sexo",                                                             alias: "sexo",                     header: "Sexo" },
  { sql: "desc_regional_afiliado",                                           alias: "desc_regional_afiliado",   header: "Regional Afiliado" },
  { sql: "ciudad_afiliado",                                                  alias: "ciudad_afiliado",          header: "Ciudad Afiliado" },
  { sql: "nombre_medico",                                                    alias: "nombre_medico",            header: "Profesional" },
  { sql: "estado_medico",                                                    alias: "estado_medico",            header: "Estado Medico" },
  { sql: "programa_especialidad",                                            alias: "programa_especialidad",    header: "Programa / Especialidad" },
  { sql: "tipo_convenio_desc",                                               alias: "tipo_convenio_desc",       header: "Tipo Convenio" },
  { sql: "orden_agrup_prest_desc",                                           alias: "orden_agrup_prest_desc",   header: "Orden Agrup Prest" },
  { sql: "agrup_salud_prest_desc",                                           alias: "agrup_salud_prest_desc",   header: "Agrup Salud Prest" },
  { sql: "codigo_prestacion",                                                alias: "codigo_prestacion",        header: "Codigo Prestacion" },
  { sql: "descripcion_prestacion",                                           alias: "descripcion_prestacion",   header: "Prestacion" },
  { sql: "codigo_diagnostico",                                               alias: "codigo_diagnostico",       header: "Codigo Diagnostico" },
  { sql: "diagnostico_desc",                                                 alias: "diagnostico_desc",         header: "Diagnostico" },
  { sql: "TO_CHAR(fecha_emision, 'DD/MM/YYYY')",                            alias: "fecha_emision",            header: "Fecha Emision" },
  { sql: "TO_CHAR(fecha_atencion_ivr, 'DD/MM/YYYY HH12:MI:SS AM')",         alias: "fecha_atencion",           header: "Fecha Atencion" },
  { sql: "estado_autorizacion_desc",                                         alias: "estado_autorizacion_desc", header: "Estado Autorizacion" },
  { sql: "cantidad_autorizada",                                              alias: "cantidad_autorizada",      header: "Cantidad Autorizada" },
  { sql: "valor_autorizado_prestacion",                                      alias: "valor_autorizado",         header: "Valor Autorizado" },
  { sql: "descripcion_sucursal_emite",                                       alias: "sucursal_emite",           header: "Sucursal Emite" },
  { sql: "descripcion_prestador_atiende",                                    alias: "prestador_atiende",        header: "Prestador Atiende" },
];

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
