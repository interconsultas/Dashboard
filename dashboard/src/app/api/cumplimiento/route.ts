import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { getCached, setCache } from "@/lib/cache";
import { esProgramaMeta } from "@/lib/cumplimiento/categorias";
import { mesesEntre, parsePeriodo, restarMeses } from "@/lib/cumplimiento/periodo";
import { MAX_MESES_RANGO } from "@/lib/cumplimiento/filtros";
import { COLUMNA_ORDENES, getAtribucion, joinOrdenes } from "@/lib/cumplimiento/config";
import {
  construirCumplimiento,
  type EntradaCumplimiento,
  type MetaCumplimiento,
} from "@/lib/cumplimiento/calcular";
import type { RespuestaCumplimiento } from "@/lib/cumplimiento/tipos";

/* ── Constants ──────────────────────────────── */

const PERIODOS_POR_DEFECTO = 6;

/**
 * Citas, programas y metas se editan desde las pantallas de administración,
 * que no vacían el caché: se usa un TTL corto para que un resultado guardado
 * no sobreviva más de un minuto a una edición.
 */
const CACHE_TTL_MS = 60_000;

/* ── Helpers ─────────────────────────────────── */

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/* ── Handler ─────────────────────────────────── */

export async function POST(req: NextRequest) {
  // El rol coordinador queda fuera a propósito: las citas atendidas (denominador) no tienen dimensión regional.
  const { error } = await requireAuth(["admin", "direccion_medica"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("El cuerpo de la solicitud no es válido");
  }

  // ── Periodos: ambos o ninguno (sin periodos se usan los últimos con citas) ──
  const sinDesde = body.periodo_desde === undefined || body.periodo_desde === null;
  const sinHasta = body.periodo_hasta === undefined || body.periodo_hasta === null;
  let desde: number | null = null;
  let hasta: number | null = null;
  if (!(sinDesde && sinHasta)) {
    desde = parsePeriodo(body.periodo_desde);
    if (desde === null) return badRequest("El periodo inicial debe tener el formato AAAAMM");
    hasta = parsePeriodo(body.periodo_hasta);
    if (hasta === null) return badRequest("El periodo final debe tener el formato AAAAMM");
    if (desde > hasta) {
      return badRequest("El periodo inicial no puede ser posterior al periodo final");
    }
    if (mesesEntre(desde, hasta) > MAX_MESES_RANGO) {
      return badRequest(`El rango no puede superar los ${MAX_MESES_RANGO} meses`);
    }
  }

  // ── Programas ──
  let programas: string[] = [];
  if (body.programas !== undefined && body.programas !== null) {
    if (!Array.isArray(body.programas) || !body.programas.every(esProgramaMeta)) {
      return badRequest("La lista de programas contiene un valor no válido");
    }
    programas = Array.from(new Set<string>(body.programas)).sort();
  }

  // ── Documento: texto de solo dígitos (BIGINT en la BD) ──
  let documento: string | null = null;
  if (body.documento !== undefined && body.documento !== null) {
    if (typeof body.documento !== "string" || !/^\d{1,15}$/.test(body.documento)) {
      return badRequest("El documento debe contener solo dígitos");
    }
    documento = body.documento;
  }

  const atribucion = getAtribucion();

  // ── Cache ──
  const cacheStr = `cumplimiento:${JSON.stringify({ atribucion, desde, hasta, programas, documento })}`;
  const cached = getCached<RespuestaCumplimiento>(cacheStr);
  if (cached) return NextResponse.json(cached);

  let result: RespuestaCumplimiento;
  try {
    // ── Periodos con citas: sin filtros, para que la UI ofrezca solo esos ──
    const periodosR = await query<{ periodo: number }>(
      `SELECT DISTINCT periodo FROM citas_atendidas ORDER BY 1`
    );
    const disponibles = periodosR.map((r) => Number(r.periodo));

    if (desde === null || hasta === null) {
      if (disponibles.length === 0) {
        return NextResponse.json({
          atribucion,
          periodos_disponibles: [],
          periodo_desde: null,
          periodo_hasta: null,
          periodos: [],
          ...construirCumplimiento({ entradas: [], metas: [] }),
        } satisfies RespuestaCumplimiento);
      }
      hasta = disponibles[disponibles.length - 1];
      desde = Math.max(
        disponibles[Math.max(0, disponibles.length - PERIODOS_POR_DEFECTO)],
        restarMeses(hasta, MAX_MESES_RANGO - 1)
      );
    }

    // ── Filas: citas del rango con sus órdenes por categoría ──
    const columna = COLUMNA_ORDENES[atribucion];
    const params: unknown[] = [desde, hasta];
    const filtros: string[] = [];
    if (documento !== null) {
      params.push(documento);
      filtros.push(`AND c.documento = $${params.length}`);
    }
    if (programas.length > 0) {
      params.push(programas);
      filtros.push(`AND COALESCE(c.programa, m.programa_meta) = ANY($${params.length})`);
    }

    const [filasR, metasR] = await Promise.all([
      query<{
        documento: string;
        nombre: string | null;
        periodo: number;
        citas: number | null;
        programa: string | null;
        categoria: string | null;
        ordenes: string | null;
      }>(
        `SELECT c.documento::text AS documento,
                COALESCE(m.nombre, c.nombre_medico) AS nombre,
                c.periodo,
                c.cantidad_citas AS citas,
                COALESCE(c.programa, m.programa_meta) AS programa,
                o.categoria,
                o.ordenes
         FROM citas_atendidas c
         LEFT JOIN medicos m ON m.identificacion = c.documento
         LEFT JOIN (
           SELECT categoria, periodo, ${columna}, SUM(ordenes) AS ordenes
           FROM vm_cumpl_ordenes
           WHERE periodo BETWEEN $1 AND $2
           GROUP BY 1, 2, 3
         ) o ON o.periodo = c.periodo AND ${joinOrdenes(atribucion, "o", "c", "m")}
         WHERE c.periodo BETWEEN $1 AND $2
           ${filtros.join("\n           ")}
         ORDER BY c.periodo, c.documento`,
        params
      ),
      // ── Metas activas de los años que cubre el rango ──
      query<{ anio: number; programa: string; tipo_prestacion: string; valor_meta: string }>(
        `SELECT anio, programa, tipo_prestacion, valor_meta
         FROM metas
         WHERE activo = TRUE AND anio BETWEEN $1 AND $2`,
        [Math.floor(desde / 100), Math.floor(hasta / 100)]
      ),
    ]);

    // pg entrega BIGINT y NUMERIC como texto: se convierten aquí; el documento sigue siendo texto
    const entradas: EntradaCumplimiento[] = filasR.map((r) => ({
      documento: String(r.documento),
      nombre: r.nombre ?? "",
      periodo: Number(r.periodo),
      citas: r.citas === null ? null : Number(r.citas),
      programa: r.programa,
      categoria: r.categoria,
      ordenes: r.ordenes === null ? null : Number(r.ordenes),
    }));
    const metas: MetaCumplimiento[] = metasR.map((r) => ({
      anio: Number(r.anio),
      programa: r.programa,
      categoria: r.tipo_prestacion,
      valor: Number(r.valor_meta),
    }));

    const rangoDesde = desde;
    const rangoHasta = hasta;
    result = {
      atribucion,
      periodos_disponibles: disponibles,
      periodo_desde: rangoDesde,
      periodo_hasta: rangoHasta,
      periodos: disponibles.filter((p) => p >= rangoDesde && p <= rangoHasta),
      ...construirCumplimiento({ entradas, metas }),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRefresh = /timeout|lock|concurrent|materialized/i.test(msg);
    console.error("[cumplimiento] Query failed:", msg);
    if (isRefresh) {
      return NextResponse.json(
        { error: "Los datos se están actualizando, reintente en unos segundos", retryable: true },
        { status: 503, headers: { "Retry-After": "5" } }
      );
    }
    return NextResponse.json({ error: "Error al consultar los datos" }, { status: 500 });
  }

  setCache(cacheStr, result, CACHE_TTL_MS);

  return NextResponse.json(result);
}
