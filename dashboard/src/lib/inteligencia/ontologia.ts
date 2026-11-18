/**
 * Ontología de la sección Inteligencia: los tipos de objeto de la IPS y los
 * tipos de relación entre ellos, con la fuente de datos de cada uno.
 *
 * Módulo puro (sin BD): el mapa de relaciones, la API y la leyenda leen de
 * aquí. Las instancias se calculan en cada consulta sobre las vistas que ya
 * existen (ver lib/inteligencia/sql.ts); no hay tablas de grafo.
 *
 * Identidad del profesional entre fuentes: el documento de las citas
 * (v_citas_area.documento) es medicos.identificacion. Las órdenes se le
 * atribuyen con el mismo criterio que Cumplimiento (CUMPLIMIENTO_ATRIBUCION).
 */
import { CATEGORIAS } from "@/lib/cumplimiento/categorias";
import { COLORES_AREA } from "@/lib/productividad/presentacion";

/* ── Tipos de objeto ────────────────────────── */

/** Orden fijo: define el color de cada tipo y el orden de la leyenda. */
export const TIPOS_OBJETO = [
  "area",
  "servicio",
  "profesional",
  "especialidad",
  "programa",
  "categoria",
  "regional",
] as const;

export type TipoObjeto = (typeof TIPOS_OBJETO)[number];

export interface DefTipoObjeto {
  clave: TipoObjeto;
  etiqueta: string;
  plural: string;
  descripcion: string;
  /** Qué identifica a cada instancia. */
  llave: string;
}

export const OBJETOS: readonly DefTipoObjeto[] = [
  {
    clave: "area",
    etiqueta: "Área de servicio",
    plural: "Áreas de servicio",
    descripcion: "Agrupación de servicios de citas (Citas › Áreas).",
    llave: "Nombre del área",
  },
  {
    clave: "servicio",
    etiqueta: "Servicio",
    plural: "Servicios",
    descripcion: "Servicio de la agenda con citas en el periodo.",
    llave: "Código del servicio",
  },
  {
    clave: "profesional",
    etiqueta: "Profesional",
    plural: "Profesionales",
    descripcion: "Profesional con citas en el periodo.",
    llave: "Documento (cédula)",
  },
  {
    clave: "especialidad",
    etiqueta: "Especialidad",
    plural: "Especialidades",
    descripcion: "Programa o especialidad del catálogo de médicos.",
    llave: "Nombre de la especialidad",
  },
  {
    clave: "programa",
    etiqueta: "Programa de metas",
    plural: "Programas de metas",
    descripcion: "Programa al que se asignan las metas de órdenes por cita.",
    llave: "Nombre del programa",
  },
  {
    clave: "categoria",
    etiqueta: "Categoría de autorización",
    plural: "Categorías de autorización",
    descripcion: "Una de las 7 categorías de órdenes del módulo de cumplimiento.",
    llave: "Clave de la categoría",
  },
  {
    clave: "regional",
    etiqueta: "Regional",
    plural: "Regionales",
    descripcion: "Regional del afiliado en las autorizaciones.",
    llave: "Nombre de la regional",
  },
];

const POR_TIPO = new Map(OBJETOS.map((o) => [o.clave, o]));

export function esTipoObjeto(valor: unknown): valor is TipoObjeto {
  return typeof valor === "string" && POR_TIPO.has(valor as TipoObjeto);
}

export function defTipo(tipo: TipoObjeto): DefTipoObjeto {
  return POR_TIPO.get(tipo)!;
}

/** Color categórico del tipo (misma paleta que las áreas de Productividad). */
export function colorTipo(tipo: TipoObjeto): string {
  return COLORES_AREA[TIPOS_OBJETO.indexOf(tipo)];
}

/* ── Tipos de relación ──────────────────────── */

export type FormatoMetrica = "numero" | "pct" | "decimal";

export interface DefMetrica {
  clave: string;
  etiqueta: string;
  formato: FormatoMetrica;
}

export type TipoRelacion =
  | "pertenece_a"
  | "atiende"
  | "tiene_especialidad"
  | "cuenta_en_programa"
  | "tiene_meta"
  | "ordena"
  | "autorizada_en";

export interface DefRelacion {
  clave: TipoRelacion;
  etiqueta: string;
  origen: TipoObjeto;
  destino: TipoObjeto;
  descripcion: string;
  /** Tabla o vista de donde sale. */
  fuente: string;
  metricas: readonly DefMetrica[];
  /** Métrica que da el grosor de la arista y el orden de los vecinos. */
  peso: string;
}

const ASIGNADAS: DefMetrica = { clave: "asignadas", etiqueta: "Citas asignadas", formato: "numero" };
const ORDENES: DefMetrica = { clave: "ordenes", etiqueta: "Órdenes", formato: "numero" };
const CANTIDAD: DefMetrica = { clave: "cantidad", etiqueta: "Cantidad autorizada", formato: "numero" };

export const RELACIONES: readonly DefRelacion[] = [
  {
    clave: "pertenece_a",
    etiqueta: "pertenece a",
    origen: "servicio",
    destino: "area",
    descripcion: "Área asignada al servicio.",
    fuente: "servicios_citas.area",
    metricas: [ASIGNADAS],
    peso: "asignadas",
  },
  {
    clave: "atiende",
    etiqueta: "atiende",
    origen: "profesional",
    destino: "servicio",
    descripcion: "Citas del profesional en el servicio durante el periodo.",
    fuente: "v_citas_area",
    metricas: [
      ASIGNADAS,
      { clave: "inasistidas", etiqueta: "Inasistidas", formato: "numero" },
      { clave: "pct_inasistencia", etiqueta: "% inasistencia", formato: "pct" },
      { clave: "disponibles", etiqueta: "Disponibles", formato: "numero" },
    ],
    peso: "asignadas",
  },
  {
    clave: "tiene_especialidad",
    etiqueta: "tiene la especialidad",
    origen: "profesional",
    destino: "especialidad",
    descripcion: "Especialidad del profesional en el catálogo de médicos.",
    fuente: "medicos.programa_especialidad",
    metricas: [ASIGNADAS],
    peso: "asignadas",
  },
  {
    clave: "cuenta_en_programa",
    etiqueta: "cuenta en el programa",
    origen: "especialidad",
    destino: "programa",
    descripcion: "Programa de metas de la especialidad (Metas › Programas por especialidad).",
    fuente: "programa_meta_mapeo",
    metricas: [{ clave: "profesionales", etiqueta: "Profesionales", formato: "numero" }],
    peso: "profesionales",
  },
  {
    clave: "tiene_meta",
    etiqueta: "tiene meta",
    origen: "programa",
    destino: "categoria",
    descripcion: "Meta de órdenes del programa en la categoría para el año del periodo.",
    fuente: "metas",
    metricas: [{ clave: "valor_meta", etiqueta: "Meta", formato: "decimal" }],
    peso: "valor_meta",
  },
  {
    clave: "ordena",
    etiqueta: "ordena",
    origen: "profesional",
    destino: "categoria",
    descripcion: "Órdenes atribuidas al profesional con el criterio de Cumplimiento.",
    fuente: "vm_cumpl_ordenes",
    metricas: [ORDENES, CANTIDAD],
    peso: "ordenes",
  },
  {
    clave: "autorizada_en",
    etiqueta: "autorizaciones por regional",
    origen: "categoria",
    destino: "regional",
    descripcion: "Órdenes de la categoría por regional del afiliado.",
    fuente: "vm_dash_*",
    metricas: [ORDENES, CANTIDAD],
    peso: "ordenes",
  },
];

const POR_RELACION = new Map(RELACIONES.map((r) => [r.clave, r]));

export function defRelacion(clave: TipoRelacion): DefRelacion {
  return POR_RELACION.get(clave)!;
}

/**
 * Vista vm_dash_* de cada categoría (las mismas que une 013 en
 * vm_cumpl_ordenes). Solo nombres fijos: nunca vienen de la solicitud.
 */
export const VISTA_CATEGORIA: Readonly<Record<string, string>> = {
  medicamentos: "vm_dash_medicamentos",
  laboratorios: "vm_dash_laboratorios",
  proc_dx: "vm_dash_proc_dx",
  rx: "vm_dash_rx",
  ecografias: "vm_dash_ecografias",
  remisiones_cap: "vm_dash_remisiones_cap",
  remisiones_ext: "vm_dash_remisiones_ext",
};

/* ── Identificadores ────────────────────────── */

/** Id de un nodo: "tipo:clave". */
export function idNodo(tipo: TipoObjeto, clave: string): string {
  return `${tipo}:${clave}`;
}

/** Separa "tipo:clave" por el primer ":" (la clave puede contener ":"). */
export function parseIdNodo(id: string): { tipo: TipoObjeto; clave: string } | null {
  const i = id.indexOf(":");
  if (i <= 0) return null;
  const tipo = id.slice(0, i);
  const clave = id.slice(i + 1);
  if (!esTipoObjeto(tipo) || !esClaveValida(tipo, clave)) return null;
  return { tipo, clave };
}

const RE_DOCUMENTO = /^\d{1,15}$/;
const RE_SERVICIO = /^[A-Za-z0-9._-]{1,20}$/;
const MAX_TEXTO = 150;

/** ¿La clave tiene la forma que corresponde al tipo? (antes de ir a la BD o al caché). */
export function esClaveValida(tipo: TipoObjeto, clave: string): boolean {
  switch (tipo) {
    case "profesional":
      return RE_DOCUMENTO.test(clave);
    case "servicio":
      return RE_SERVICIO.test(clave);
    case "categoria":
      return CATEGORIAS.some((c) => c.clave === clave);
    default:
      return clave.trim() !== "" && clave.length <= MAX_TEXTO && !/[\u0000-\u001f\u007f]/.test(clave);
  }
}
