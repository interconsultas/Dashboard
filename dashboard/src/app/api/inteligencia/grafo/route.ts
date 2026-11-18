import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePermiso } from "@/lib/middleware-roles";
import { PERMISOS_API } from "@/lib/acceso";
import { getCached, setCache } from "@/lib/cache";
import { getAtribucion, type Atribucion } from "@/lib/cumplimiento/config";
import { PROGRAMA_TOTAL_MGI } from "@/lib/cumplimiento/categorias";
import { SQL_CARGAS } from "@/lib/productividad/sql";
import { cargasDe, periodoCarga, resolverCarga, type CargaBD } from "@/lib/productividad/construir";
import { validarParametrosGrafo } from "@/lib/inteligencia/parametros";
import {
  SQL_AREAS,
  SQL_ATIENDE,
  SQL_MAPEO,
  SQL_MEDICOS,
  SQL_METAS,
  SQL_REGIONALES,
  sqlOrdenes,
} from "@/lib/inteligencia/sql";
import {
  buscar,
  construirGrafo,
  esquema,
  vecindario,
  type FilaAtiende,
  type FilaMapeo,
  type FilaMedico,
  type FilaMeta,
  type FilaOrdenes,
  type FilaRegional,
  type Grafo,
} from "@/lib/inteligencia/grafo";
import { idNodo } from "@/lib/inteligencia/ontologia";
import type { ContextoGrafo, RespuestaGrafo } from "@/lib/inteligencia/tipos";

/* ── Constants ──────────────────────────────── */

/** El grafo de un periodo se arma una vez y se reutiliza 5 minutos. */
const CACHE_TTL_MS = 300_000;

/* ── Datos ───────────────────────────────────── */

const num = (v: unknown) => Number(v ?? 0);

/** Consulta las fuentes del periodo y arma el grafo (o lo toma del caché). */
async function obtenerGrafo(carga: CargaBD | null, atribucion: Atribucion): Promise<Grafo> {
  if (carga === null) {
    const areas = (await query<{ nombre: string }>(SQL_AREAS)).map((r) => r.nombre);
    return construirGrafo({ areas, atiende: [], medicos: [], mapeo: [], metas: [], ordenes: [], regionales: [] });
  }

  const clave = `inteligencia:grafo:${atribucion}:${carga.granularidad}:${carga.fecha_inicial}:${carga.fecha_final}`;
  const cached = getCached<Grafo>(clave);
  if (cached) return cached;

  const rango = [carga.granularidad, carga.fecha_inicial, carga.fecha_final];
  const [areasR, atiendeR, medicosR, mapeoR, metasR, ordenesR, regionalesR] = await Promise.all([
    query<{ nombre: string }>(SQL_AREAS),
    query<FilaAtiende>(SQL_ATIENDE, rango),
    query<FilaMedico>(SQL_MEDICOS),
    query<FilaMapeo>(SQL_MAPEO),
    query<FilaMeta>(SQL_METAS, [Math.floor(carga.periodo / 100), PROGRAMA_TOTAL_MGI]),
    query<FilaOrdenes>(sqlOrdenes(atribucion), [carga.periodo, ...rango]),
    query<FilaRegional>(SQL_REGIONALES, [carga.periodo]),
  ]);

  // pg entrega BIGINT y NUMERIC como texto: se convierten aquí; documentos y claves siguen como texto
  const grafo = construirGrafo({
    areas: areasR.map((r) => r.nombre),
    atiende: atiendeR.map((r) => ({
      ...r,
      documento: String(r.documento),
      asignadas: num(r.asignadas),
      inasistidas: num(r.inasistidas),
      disponibles: num(r.disponibles),
    })),
    medicos: medicosR.map((r) => ({ documento: String(r.documento), especialidad: r.especialidad })),
    mapeo: mapeoR,
    metas: metasR.map((r) => ({ ...r, valor_meta: num(r.valor_meta) })),
    ordenes: ordenesR.map((r) => ({ ...r, documento: String(r.documento), ordenes: num(r.ordenes), cantidad: num(r.cantidad) })),
    regionales: regionalesR.map((r) => ({ ...r, ordenes: num(r.ordenes), cantidad: num(r.cantidad) })),
  });
  setCache(clave, grafo, CACHE_TTL_MS);
  return grafo;
}

/* ── Handler ─────────────────────────────────── */

export async function GET(request: Request) {
  // Solo consulta; el coordinador no ve la sección por defecto (019_inteligencia.sql)
  const { error } = await requirePermiso(PERMISOS_API["/api/inteligencia/grafo"].GET);
  if (error) return error;

  const validacion = validarParametrosGrafo(new URL(request.url).searchParams);
  if ("error" in validacion) {
    return NextResponse.json({ error: validacion.error }, { status: 400 });
  }
  const { parametros: p } = validacion;

  try {
    const cargas = (await query<CargaBD>(SQL_CARGAS)).map((c) => ({ ...c, periodo: Number(c.periodo) }));
    const carga = resolverCarga(cargas, p.granularidad, p.periodo);
    const atribucion = getAtribucion();
    const grafo = await obtenerGrafo(carga, atribucion);

    const contexto: ContextoGrafo = {
      granularidad: p.granularidad,
      periodo: carga ? periodoCarga(carga) : null,
      periodos: {
        mensual: cargasDe(cargas, "mensual").map(periodoCarga),
        semanal: cargasDe(cargas, "semanal").map(periodoCarga),
      },
      periodo_autorizaciones: carga ? carga.periodo : null,
      atribucion,
    };

    let respuesta: RespuestaGrafo;
    if (p.modo === "vecindario") {
      const v = vecindario(grafo, idNodo(p.tipo!, p.id!), p.limite);
      if (!v) return NextResponse.json({ error: "El elemento no existe en el periodo" }, { status: 404 });
      respuesta = { ...contexto, modo: "vecindario", vecindario: v };
    } else if (p.modo === "buscar") {
      respuesta = { ...contexto, modo: "buscar", resultados: buscar(grafo, { q: p.q, tipo: p.tipo, limite: p.limite }) };
    } else {
      respuesta = { ...contexto, modo: "esquema", esquema: esquema(grafo) };
    }
    return NextResponse.json(respuesta);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[inteligencia] Query failed:", msg);
    if (/timeout|lock|concurrent|materialized/i.test(msg)) {
      return NextResponse.json(
        { error: "Los datos se están actualizando, reintente en unos segundos", retryable: true },
        { status: 503, headers: { "Retry-After": "5" } }
      );
    }
    return NextResponse.json({ error: "Error al consultar los datos" }, { status: 500 });
  }
}
