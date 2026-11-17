import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { getCached, setCache } from "@/lib/cache";
import { validarParametros, type OpcionServicio } from "@/lib/productividad/filtros";
import { CLAVES_METRICAS } from "@/lib/productividad/metricas";
import {
  construirProductividad,
  resolverCarga,
  type CargaBD,
  type FilaProfesionalBD,
  type FilaServicioBD,
} from "@/lib/productividad/construir";
import type { RespuestaProductividad } from "@/lib/productividad/tipos";

/* ── Constants ──────────────────────────────── */

/** Las áreas se editan en Citas › Áreas, que no vacía el caché: TTL corto. */
const CACHE_TTL_MS = 60_000;

/** SUM de cada métrica; los nombres salen de una lista fija, nunca de la solicitud. */
const SUMAS = CLAVES_METRICAS.map((k) => `SUM(v.${k})::int AS ${k}`).join(",\n                ");

/* ── Helpers ─────────────────────────────────── */

/** pg puede entregar enteros grandes como texto: se normalizan a número. */
function conNumeros<T extends object>(fila: T): T {
  const copia = { ...fila } as Record<string, unknown>;
  for (const k of CLAVES_METRICAS) copia[k] = Number(copia[k] ?? 0);
  return copia as T;
}

/* ── Handler ─────────────────────────────────── */

export async function GET(request: Request) {
  // Paso 4 de la fase 2 refina el acceso por rol (coordinador por regional).
  const { error } = await requireAuth(["admin", "direccion_medica"]);
  if (error) return error;

  try {
    const areas = (
      await query<{ nombre: string }>(`SELECT nombre FROM areas_servicio ORDER BY orden, nombre`)
    ).map((r) => r.nombre);

    const validacion = validarParametros(new URL(request.url).searchParams, areas);
    if ("error" in validacion) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }
    const { filtros } = validacion;

    const cacheStr = `productividad:${JSON.stringify(filtros)}`;
    const cached = getCached<RespuestaProductividad>(cacheStr);
    if (cached) return NextResponse.json(cached);

    // Filas por carga × servicio de la granularidad; el profesional se filtra aquí
    const paramsFilas: unknown[] = [filtros.granularidad];
    let filtroProfesional = "";
    if (filtros.profesional !== null) {
      paramsFilas.push(filtros.profesional);
      filtroProfesional = `AND v.documento = $${paramsFilas.length}`;
    }

    const [cargasR, serviciosR, filasR] = await Promise.all([
      query<CargaBD>(
        `SELECT DISTINCT granularidad, periodo, fecha_inicial, fecha_final
         FROM citas_profesional_servicio
         ORDER BY fecha_inicial`
      ),
      query<OpcionServicio>(
        `SELECT s.codigo_servicio AS codigo, s.nombre_servicio AS nombre, s.area
         FROM servicios_citas s
         JOIN areas_servicio a ON a.nombre = s.area
         WHERE EXISTS (
           SELECT 1 FROM citas_profesional_servicio c
           WHERE c.codigo_servicio = s.codigo_servicio AND c.granularidad = $1
         )
         ORDER BY a.orden, s.nombre_servicio`,
        [filtros.granularidad]
      ),
      query<FilaServicioBD>(
        `SELECT v.fecha_inicial, v.codigo_servicio, v.nombre_servicio, v.area,
                ${SUMAS}
         FROM v_citas_area v
         WHERE v.granularidad = $1
           ${filtroProfesional}
         GROUP BY v.fecha_inicial, v.codigo_servicio, v.nombre_servicio, v.area`,
        paramsFilas
      ),
    ]);

    const cargas = cargasR.map((c) => ({ ...c, periodo: Number(c.periodo) }));
    const carga = resolverCarga(cargas, filtros.granularidad, filtros.periodo);

    // Profesionales × servicio de la carga seleccionada, con su área principal
    const profesionalesR =
      carga === null
        ? []
        : await query<FilaProfesionalBD>(
            `SELECT v.documento::text AS documento,
                    MAX(v.nombre_profesional) AS nombre,
                    v.codigo_servicio, v.area, p.area_principal,
                    ${SUMAS}
             FROM v_citas_area v
             LEFT JOIN v_citas_area_principal p
               ON p.granularidad = v.granularidad
              AND p.fecha_inicial = v.fecha_inicial
              AND p.fecha_final = v.fecha_final
              AND p.tipo_documento = v.tipo_documento
              AND p.documento = v.documento
             WHERE v.granularidad = $1 AND v.fecha_inicial = $2 AND v.fecha_final = $3
             GROUP BY v.documento, v.codigo_servicio, v.area, p.area_principal`,
            [carga.granularidad, carga.fecha_inicial, carga.fecha_final]
          );

    const result = construirProductividad({
      filtros,
      carga,
      cargas,
      areas,
      servicios: serviciosR,
      filas: filasR.map(conNumeros),
      profesionales: profesionalesR.map(conNumeros),
    });

    setCache(cacheStr, result, CACHE_TTL_MS);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[productividad] Query failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Error al consultar los datos" }, { status: 500 });
  }
}
