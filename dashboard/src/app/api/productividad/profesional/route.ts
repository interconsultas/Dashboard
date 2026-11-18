import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { getCached, setCache } from "@/lib/cache";
import { esDocumento, validarParametros } from "@/lib/productividad/filtros";
import { resolverCarga, type CargaBD, type FilaProfesionalBD } from "@/lib/productividad/construir";
import { construirFicha, type FilaFichaBD } from "@/lib/productividad/ficha";
import { SQL_CARGAS, SQL_PROFESIONALES_CARGA, SUMAS, conNumeros } from "@/lib/productividad/sql";
import type { RespuestaFichaProfesional } from "@/lib/productividad/tipos";

/* ── Constants ──────────────────────────────── */

/** Igual que /api/productividad: las áreas se editan sin vaciar el caché. */
const CACHE_TTL_MS = 60_000;

/* ── Handler ─────────────────────────────────── */

/**
 * Ficha individual de un profesional: totales y servicios del periodo,
 * tendencia en todas las cargas de la granularidad, institución y percentil.
 * Acepta los mismos filtros que /api/productividad más `documento`.
 */
export async function GET(request: Request) {
  const { error } = await requireAuth(["admin", "direccion_medica"]);
  if (error) return error;

  const params = new URL(request.url).searchParams;
  const documentos = params.getAll("documento");
  if (documentos.length > 1) {
    return NextResponse.json({ error: "El parámetro documento está repetido" }, { status: 400 });
  }
  const documento = documentos[0]?.trim() ?? "";
  if (!esDocumento(documento)) {
    return NextResponse.json({ error: "El documento del profesional debe contener solo dígitos" }, { status: 400 });
  }

  try {
    const areas = (
      await query<{ nombre: string }>(`SELECT nombre FROM areas_servicio ORDER BY orden, nombre`)
    ).map((r) => r.nombre);

    const validacion = validarParametros(params, areas);
    if ("error" in validacion) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }
    const filtros = { ...validacion.filtros, profesional: null };

    const cacheStr = `productividad-ficha:${documento}:${JSON.stringify(filtros)}`;
    const cached = getCached<RespuestaFichaProfesional>(cacheStr);
    if (cached) return NextResponse.json(cached);

    const [cargasR, filasR] = await Promise.all([
      query<CargaBD>(SQL_CARGAS),
      query<FilaFichaBD>(
        `SELECT v.fecha_inicial, v.codigo_servicio, v.nombre_servicio, v.area,
                MAX(v.nombre_profesional) AS nombre,
                ${SUMAS}
         FROM v_citas_area v
         WHERE v.granularidad = $1 AND v.documento = $2
         GROUP BY v.fecha_inicial, v.codigo_servicio, v.nombre_servicio, v.area`,
        [filtros.granularidad, documento]
      ),
    ]);

    if (filasR.length === 0) {
      return NextResponse.json({ error: "El profesional no tiene agenda en los periodos cargados" }, { status: 404 });
    }

    const cargas = cargasR.map((c) => ({ ...c, periodo: Number(c.periodo) }));
    const carga = resolverCarga(cargas, filtros.granularidad, filtros.periodo);

    const paresR =
      carga === null
        ? []
        : await query<FilaProfesionalBD>(SQL_PROFESIONALES_CARGA, [
            carga.granularidad,
            carga.fecha_inicial,
            carga.fecha_final,
          ]);

    const result = construirFicha({
      filtros,
      documento,
      carga,
      cargas,
      filas: filasR.map(conNumeros),
      pares: paresR.map(conNumeros),
    });
    if (result === null) {
      return NextResponse.json({ error: "El profesional no tiene agenda en los periodos cargados" }, { status: 404 });
    }

    setCache(cacheStr, result, CACHE_TTL_MS);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[productividad/profesional] Query failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Error al consultar los datos" }, { status: 500 });
  }
}
