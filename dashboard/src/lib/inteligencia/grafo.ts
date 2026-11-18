/**
 * Grafo de instancias de un periodo, armado a partir de las filas que trae
 * la BD (lib/inteligencia/sql.ts). Funciones puras: la API consulta, arma el
 * grafo una vez por periodo (con caché) y de él saca el esquema, los
 * vecindarios y las búsquedas.
 *
 * Profesionales: son los que tienen citas en el periodo (documento =
 * medicos.identificacion). Los que solo aparecen en autorizaciones (externos
 * o fuera del catálogo, sin citas) no son nodos: sus órdenes se cuentan en
 * la categoría como "Sin profesional con citas".
 */
import { CATEGORIAS, type Escala } from "@/lib/cumplimiento/categorias";
import {
  OBJETOS,
  RELACIONES,
  TIPOS_OBJETO,
  colorTipo,
  idNodo,
  type DefRelacion,
  type DefTipoObjeto,
  type TipoObjeto,
  type TipoRelacion,
} from "./ontologia";

/* ── Filas de la BD ─────────────────────────── */

/** Profesional × servicio en la carga (v_citas_area). */
export interface FilaAtiende {
  documento: string;
  nombre: string;
  codigo_servicio: string;
  nombre_servicio: string;
  area: string;
  asignadas: number;
  inasistidas: number;
  disponibles: number;
}

export interface FilaMedico {
  documento: string;
  /** UPPER(TRIM(programa_especialidad)). */
  especialidad: string;
}

export interface FilaMapeo {
  especialidad: string;
  programa: string;
}

export interface FilaMeta {
  programa: string;
  categoria: string;
  valor_meta: number;
  escala: string;
}

/** Órdenes ya atribuidas a un profesional con citas (criterio de Cumplimiento). */
export interface FilaOrdenes {
  documento: string;
  categoria: string;
  ordenes: number;
  cantidad: number;
}

export interface FilaRegional {
  categoria: string;
  regional: string | null;
  ordenes: number;
  cantidad: number;
}

export interface DatosGrafo {
  /** Áreas en el orden de presentación (areas_servicio.orden). */
  areas: string[];
  atiende: FilaAtiende[];
  medicos: FilaMedico[];
  mapeo: FilaMapeo[];
  metas: FilaMeta[];
  ordenes: FilaOrdenes[];
  regionales: FilaRegional[];
}

/* ── Grafo ──────────────────────────────────── */

export type FormatoPropiedad = "texto" | "numero" | "pct" | "decimal";

export interface Propiedad {
  etiqueta: string;
  valor: string | number | null;
  formato: FormatoPropiedad;
}

export interface Nodo {
  id: string;
  tipo: TipoObjeto;
  clave: string;
  etiqueta: string;
  /** Tamaño del nodo: citas asignadas (citas) u órdenes (autorizaciones). */
  peso: number;
  propiedades: Propiedad[];
}

export interface Arista {
  id: string;
  relacion: TipoRelacion;
  origen: string;
  destino: string;
  peso: number;
  metricas: Record<string, number | null>;
}

export interface Grafo {
  nodos: Map<string, Nodo>;
  aristas: Arista[];
  /** Aristas que tocan cada nodo (como origen o destino). */
  porNodo: Map<string, Arista[]>;
}

export const SIN_REGIONAL = "Sin regional";
const FUERA_CATALOGO = "Fuera del catálogo de médicos";
const SIN_PROGRAMA = "Sin programa";

const ESCALA_TEXTO: Record<Escala, string> = {
  ratio: "Órdenes por cita",
  x100: "Órdenes por cada 100 citas",
};

function razon(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

const texto = (etiqueta: string, valor: string | null): Propiedad => ({ etiqueta, valor, formato: "texto" });
const numero = (etiqueta: string, valor: number): Propiedad => ({ etiqueta, valor, formato: "numero" });
const pct = (etiqueta: string, valor: number | null): Propiedad => ({ etiqueta, valor, formato: "pct" });

interface Citas {
  asignadas: number;
  inasistidas: number;
  disponibles: number;
}

const citasVacias = (): Citas => ({ asignadas: 0, inasistidas: 0, disponibles: 0 });

function sumar(a: Citas, b: Citas): void {
  a.asignadas += b.asignadas;
  a.inasistidas += b.inasistidas;
  a.disponibles += b.disponibles;
}

function propiedadesCitas(c: Citas): Propiedad[] {
  return [
    numero("Citas asignadas", c.asignadas),
    numero("Inasistidas", c.inasistidas),
    pct("% inasistencia", razon(c.inasistidas, c.asignadas)),
    numero("Disponibles", c.disponibles),
  ];
}

function agrupar<K, V>(mapa: Map<K, V>, clave: K, crear: () => V): V {
  let v = mapa.get(clave);
  if (v === undefined) {
    v = crear();
    mapa.set(clave, v);
  }
  return v;
}

export function construirGrafo(d: DatosGrafo): Grafo {
  const nodos = new Map<string, Nodo>();
  const aristas: Arista[] = [];
  const etiquetaCategoria = new Map(CATEGORIAS.map((c) => [c.clave, c.etiqueta]));

  const agregarNodo = (tipo: TipoObjeto, clave: string, etiqueta: string, peso: number, propiedades: Propiedad[]) => {
    const id = idNodo(tipo, clave);
    nodos.set(id, { id, tipo, clave, etiqueta, peso, propiedades });
    return id;
  };
  const agregarArista = (
    relacion: TipoRelacion,
    origen: string,
    destino: string,
    peso: number,
    metricas: Record<string, number | null>
  ) => {
    aristas.push({ id: `${relacion}|${origen}|${destino}`, relacion, origen, destino, peso, metricas });
  };

  /* ── Citas: profesionales, servicios y áreas ── */

  const porServicio = new Map<string, { nombre: string; area: string; citas: Citas; profesionales: Set<string> }>();
  const porArea = new Map<string, { citas: Citas; servicios: Set<string>; profesionales: Set<string> }>();
  const porProfesional = new Map<string, { nombre: string; citas: Citas; porArea: Map<string, number>; servicios: number }>();

  for (const f of d.atiende) {
    const c: Citas = { asignadas: f.asignadas, inasistidas: f.inasistidas, disponibles: f.disponibles };
    const s = agrupar(porServicio, f.codigo_servicio, () => ({
      nombre: f.nombre_servicio,
      area: f.area,
      citas: citasVacias(),
      profesionales: new Set<string>(),
    }));
    sumar(s.citas, c);
    s.profesionales.add(f.documento);

    const a = agrupar(porArea, f.area, () => ({ citas: citasVacias(), servicios: new Set<string>(), profesionales: new Set<string>() }));
    sumar(a.citas, c);
    a.servicios.add(f.codigo_servicio);
    a.profesionales.add(f.documento);

    const p = agrupar(porProfesional, f.documento, () => ({
      nombre: f.nombre,
      citas: citasVacias(),
      porArea: new Map<string, number>(),
      servicios: 0,
    }));
    sumar(p.citas, c);
    p.servicios += 1;
    p.porArea.set(f.area, (p.porArea.get(f.area) ?? 0) + f.asignadas);
  }

  const areas = [...d.areas, ...Array.from(porArea.keys()).filter((a) => !d.areas.includes(a))];
  for (const nombre of areas) {
    const a = porArea.get(nombre);
    const citas = a?.citas ?? citasVacias();
    agregarNodo("area", nombre, nombre, citas.asignadas, [
      numero("Servicios", a?.servicios.size ?? 0),
      numero("Profesionales", a?.profesionales.size ?? 0),
      ...propiedadesCitas(citas),
    ]);
  }

  for (const [codigo, s] of Array.from(porServicio)) {
    const id = agregarNodo("servicio", codigo, s.nombre, s.citas.asignadas, [
      texto("Código", codigo),
      texto("Área", s.area),
      numero("Profesionales", s.profesionales.size),
      ...propiedadesCitas(s.citas),
    ]);
    agregarArista("pertenece_a", id, idNodo("area", s.area), s.citas.asignadas, { asignadas: s.citas.asignadas });
  }

  /* ── Catálogo: especialidad y programa de cada profesional ── */

  const especialidadDe = new Map(d.medicos.map((m) => [m.documento, m.especialidad]));
  const programaDe = new Map(d.mapeo.map((m) => [m.especialidad, m.programa]));

  const ordenesPorProfesional = new Map<string, Map<string, { ordenes: number; cantidad: number }>>();
  for (const o of d.ordenes) {
    if (!porProfesional.has(o.documento) || !etiquetaCategoria.has(o.categoria) || o.ordenes <= 0) continue;
    const m = agrupar(ordenesPorProfesional, o.documento, () => new Map<string, { ordenes: number; cantidad: number }>());
    const previo = m.get(o.categoria) ?? { ordenes: 0, cantidad: 0 };
    m.set(o.categoria, { ordenes: previo.ordenes + o.ordenes, cantidad: previo.cantidad + o.cantidad });
  }

  const porEspecialidad = new Map<string, { citas: Citas; profesionales: number }>();
  const ordenArea = (a: string) => {
    const i = areas.indexOf(a);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };

  for (const [documento, p] of Array.from(porProfesional)) {
    const especialidad = especialidadDe.get(documento) ?? null;
    const programa = especialidad ? programaDe.get(especialidad) ?? null : null;
    const principal =
      Array.from(p.porArea.entries()).sort((x, y) => y[1] - x[1] || ordenArea(x[0]) - ordenArea(y[0]))[0]?.[0] ?? null;
    const ordenes = ordenesPorProfesional.get(documento) ?? new Map<string, { ordenes: number; cantidad: number }>();
    const totalOrdenes = Array.from(ordenes.values()).reduce((n, o) => n + o.ordenes, 0);

    const id = agregarNodo("profesional", documento, p.nombre, p.citas.asignadas, [
      texto("Documento", documento),
      texto("Especialidad", especialidad ?? FUERA_CATALOGO),
      texto("Programa de metas", programa ?? SIN_PROGRAMA),
      texto("Área principal", principal),
      numero("Servicios", p.servicios),
      ...propiedadesCitas(p.citas),
      numero("Órdenes", totalOrdenes),
      ...CATEGORIAS.filter((c) => ordenes.has(c.clave)).map((c) => numero(`Órdenes · ${c.etiqueta}`, ordenes.get(c.clave)!.ordenes)),
    ]);

    if (especialidad) {
      const e = agrupar(porEspecialidad, especialidad, () => ({ citas: citasVacias(), profesionales: 0 }));
      sumar(e.citas, p.citas);
      e.profesionales += 1;
      agregarArista("tiene_especialidad", id, idNodo("especialidad", especialidad), p.citas.asignadas, {
        asignadas: p.citas.asignadas,
      });
    }
    for (const c of CATEGORIAS) {
      const o = ordenes.get(c.clave);
      if (o) agregarArista("ordena", id, idNodo("categoria", c.clave), o.ordenes, { ordenes: o.ordenes, cantidad: o.cantidad });
    }
  }

  // Especialidades: las de profesionales activos y las del mapeo (parte del modelo)
  const especialidades = new Set(Array.from(porEspecialidad.keys()).concat(d.mapeo.map((m) => m.especialidad)));
  const porPrograma = new Map<string, { citas: Citas; profesionales: number; especialidades: number }>();
  for (const nombre of Array.from(especialidades)) {
    const e = porEspecialidad.get(nombre) ?? { citas: citasVacias(), profesionales: 0 };
    const programa = programaDe.get(nombre) ?? null;
    const id = agregarNodo("especialidad", nombre, nombre, e.citas.asignadas, [
      texto("Programa de metas", programa ?? SIN_PROGRAMA),
      numero("Profesionales con citas", e.profesionales),
      ...propiedadesCitas(e.citas),
    ]);
    if (programa) {
      const pr = agrupar(porPrograma, programa, () => ({ citas: citasVacias(), profesionales: 0, especialidades: 0 }));
      sumar(pr.citas, e.citas);
      pr.profesionales += e.profesionales;
      pr.especialidades += 1;
      agregarArista("cuenta_en_programa", id, idNodo("programa", programa), e.profesionales, { profesionales: e.profesionales });
    }
  }

  /* ── Metas: programa → categoría ── */

  const metas = d.metas.filter((m) => etiquetaCategoria.has(m.categoria));
  const programas = new Set(Array.from(porPrograma.keys()).concat(metas.map((m) => m.programa)));
  for (const nombre of Array.from(programas)) {
    const pr = porPrograma.get(nombre) ?? { citas: citasVacias(), profesionales: 0, especialidades: 0 };
    agregarNodo("programa", nombre, nombre, pr.citas.asignadas, [
      numero("Especialidades", pr.especialidades),
      numero("Profesionales con citas", pr.profesionales),
      numero("Metas", metas.filter((m) => m.programa === nombre).length),
      ...propiedadesCitas(pr.citas),
    ]);
  }
  for (const m of metas) {
    agregarArista("tiene_meta", idNodo("programa", m.programa), idNodo("categoria", m.categoria), m.valor_meta, {
      valor_meta: m.valor_meta,
    });
  }

  /* ── Autorizaciones: categorías y regionales ── */

  const porRegional = new Map<string, { ordenes: number; cantidad: number; categorias: Set<string> }>();
  const totalCategoria = new Map<string, { ordenes: number; cantidad: number }>();
  const regionales = d.regionales.filter((r) => etiquetaCategoria.has(r.categoria));
  for (const r of regionales) {
    const nombre = r.regional?.trim() || SIN_REGIONAL;
    const g = agrupar(porRegional, nombre, () => ({ ordenes: 0, cantidad: 0, categorias: new Set<string>() }));
    g.ordenes += r.ordenes;
    g.cantidad += r.cantidad;
    g.categorias.add(r.categoria);
    const t = agrupar(totalCategoria, r.categoria, () => ({ ordenes: 0, cantidad: 0 }));
    t.ordenes += r.ordenes;
    t.cantidad += r.cantidad;
  }

  const atribuidas = new Map<string, number>();
  for (const m of Array.from(ordenesPorProfesional.values())) {
    for (const [cat, o] of Array.from(m)) atribuidas.set(cat, (atribuidas.get(cat) ?? 0) + o.ordenes);
  }

  for (const c of CATEGORIAS) {
    const t = totalCategoria.get(c.clave) ?? { ordenes: 0, cantidad: 0 };
    const at = atribuidas.get(c.clave) ?? 0;
    agregarNodo("categoria", c.clave, c.etiqueta, t.ordenes, [
      texto("Escala de la meta", ESCALA_TEXTO[c.escala]),
      numero("Órdenes", t.ordenes),
      numero("Cantidad autorizada", t.cantidad),
      numero("Atribuidas a profesionales con citas", at),
      numero("Sin profesional con citas", Math.max(0, t.ordenes - at)),
    ]);
  }

  for (const [nombre, g] of Array.from(porRegional)) {
    agregarNodo("regional", nombre, nombre, g.ordenes, [
      numero("Órdenes", g.ordenes),
      numero("Cantidad autorizada", g.cantidad),
      numero("Categorías", g.categorias.size),
    ]);
  }
  // Una arista por categoría × regional (las filas pueden repetir la regional vacía)
  const porPar = new Map<string, { categoria: string; regional: string; ordenes: number; cantidad: number }>();
  for (const r of regionales) {
    const regional = r.regional?.trim() || SIN_REGIONAL;
    const g = agrupar(porPar, `${r.categoria}|${regional}`, () => ({ categoria: r.categoria, regional, ordenes: 0, cantidad: 0 }));
    g.ordenes += r.ordenes;
    g.cantidad += r.cantidad;
  }
  for (const g of Array.from(porPar.values())) {
    agregarArista("autorizada_en", idNodo("categoria", g.categoria), idNodo("regional", g.regional), g.ordenes, {
      ordenes: g.ordenes,
      cantidad: g.cantidad,
    });
  }

  // Profesional → servicio: una arista por fila de citas (ya viene agrupada por documento y servicio)
  for (const f of d.atiende) {
    agregarArista("atiende", idNodo("profesional", f.documento), idNodo("servicio", f.codigo_servicio), f.asignadas, {
      asignadas: f.asignadas,
      inasistidas: f.inasistidas,
      pct_inasistencia: razon(f.inasistidas, f.asignadas),
      disponibles: f.disponibles,
    });
  }

  const porNodo = new Map<string, Arista[]>();
  for (const a of aristas) {
    agrupar(porNodo, a.origen, () => []).push(a);
    agrupar(porNodo, a.destino, () => []).push(a);
  }
  return { nodos, aristas, porNodo };
}

/* ── Vecindario ─────────────────────────────── */

export interface GrupoOculto {
  relacion: TipoRelacion;
  /** Tipo de los vecinos del grupo. */
  tipo: TipoObjeto;
  mostrados: number;
  total: number;
}

export interface Vecindario {
  centro: Nodo;
  /** El centro primero, luego los vecinos. */
  nodos: Nodo[];
  aristas: Arista[];
  /** Grupos con más vecinos de los que se muestran ("N más"). */
  mas: GrupoOculto[];
}

const porPesoYNombre = (x: { peso: number; etiqueta: string }, y: { peso: number; etiqueta: string }) =>
  y.peso - x.peso || x.etiqueta.localeCompare(y.etiqueta, "es");

/** El nodo y sus vecinos: los `limite` de más peso por tipo de relación. */
export function vecindario(g: Grafo, id: string, limite: number): Vecindario | null {
  const centro = g.nodos.get(id);
  if (!centro) return null;

  const grupos = new Map<string, { relacion: TipoRelacion; tipo: TipoObjeto; items: { arista: Arista; vecino: Nodo }[] }>();
  for (const a of g.porNodo.get(id) ?? []) {
    const otro = g.nodos.get(a.origen === id ? a.destino : a.origen);
    if (!otro) continue;
    agrupar(grupos, `${a.relacion}|${otro.tipo}`, () => ({ relacion: a.relacion, tipo: otro.tipo, items: [] })).items.push({
      arista: a,
      vecino: otro,
    });
  }

  const nodos: Nodo[] = [centro];
  const vistos = new Set([id]);
  const aristas: Arista[] = [];
  const mas: GrupoOculto[] = [];
  for (const grupo of Array.from(grupos.values())) {
    const orden = grupo.items.sort(
      (x, y) => y.arista.peso - x.arista.peso || x.vecino.etiqueta.localeCompare(y.vecino.etiqueta, "es")
    );
    const visibles = orden.slice(0, limite);
    for (const { arista, vecino } of visibles) {
      aristas.push(arista);
      if (!vistos.has(vecino.id)) {
        vistos.add(vecino.id);
        nodos.push(vecino);
      }
    }
    if (orden.length > visibles.length) {
      mas.push({ relacion: grupo.relacion, tipo: grupo.tipo, mostrados: visibles.length, total: orden.length });
    }
  }
  return { centro, nodos, aristas, mas };
}

/* ── Esquema ────────────────────────────────── */

export interface TipoEsquema extends DefTipoObjeto {
  color: string;
  cantidad: number;
}

export interface RelacionEsquema extends DefRelacion {
  cantidad: number;
}

export interface Esquema {
  tipos: TipoEsquema[];
  relaciones: RelacionEsquema[];
}

export function esquema(g: Grafo): Esquema {
  const porTipo = new Map<TipoObjeto, number>();
  for (const n of Array.from(g.nodos.values())) porTipo.set(n.tipo, (porTipo.get(n.tipo) ?? 0) + 1);
  const porRelacion = new Map<TipoRelacion, number>();
  for (const a of g.aristas) porRelacion.set(a.relacion, (porRelacion.get(a.relacion) ?? 0) + 1);
  return {
    tipos: OBJETOS.map((o) => ({ ...o, color: colorTipo(o.clave), cantidad: porTipo.get(o.clave) ?? 0 })),
    relaciones: RELACIONES.map((r) => ({ ...r, cantidad: porRelacion.get(r.clave) ?? 0 })),
  };
}

/* ── Búsqueda ───────────────────────────────── */

export interface ResultadoBusqueda {
  id: string;
  tipo: TipoObjeto;
  clave: string;
  etiqueta: string;
  peso: number;
}

export function normalizarTexto(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Instancias que coinciden con `q` por nombre o clave (documento, código).
 * Orden: coincidencia exacta, luego al inicio, luego en cualquier parte; en
 * cada grupo, por peso y nombre. Sin texto, lista el `tipo` por peso.
 */
export function buscar(
  g: Grafo,
  opciones: { q: string; tipo: TipoObjeto | null; limite: number }
): ResultadoBusqueda[] {
  const q = normalizarTexto(opciones.q);
  const candidatos: { nodo: Nodo; rango: number }[] = [];
  for (const nodo of Array.from(g.nodos.values())) {
    if (opciones.tipo !== null && nodo.tipo !== opciones.tipo) continue;
    if (!q) {
      candidatos.push({ nodo, rango: 0 });
      continue;
    }
    const textos = [normalizarTexto(nodo.etiqueta), normalizarTexto(nodo.clave)];
    const rango = textos.some((t) => t === q) ? 0 : textos.some((t) => t.startsWith(q)) ? 1 : textos.some((t) => t.includes(q)) ? 2 : -1;
    if (rango >= 0) candidatos.push({ nodo, rango });
  }
  return candidatos
    .sort((x, y) => x.rango - y.rango || porPesoYNombre(x.nodo, y.nodo) || TIPOS_OBJETO.indexOf(x.nodo.tipo) - TIPOS_OBJETO.indexOf(y.nodo.tipo))
    .slice(0, opciones.limite)
    .map(({ nodo }) => ({ id: nodo.id, tipo: nodo.tipo, clave: nodo.clave, etiqueta: nodo.etiqueta, peso: nodo.peso }));
}
