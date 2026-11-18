/**
 * Permisos por rol: única fuente de verdad para las páginas, el menú lateral,
 * los enlaces y controles de edición, y las rutas /api.
 *
 * Módulo puro (sin BD ni APIs de Node). Los niveles de cada rol se guardan en
 * la tabla permisos_rol (etl/sql/018) y se editan en Administración › Usuarios;
 * lib/permisos.ts los lee con caché. Reglas fijas que el código impone siempre:
 *   - admin tiene 'editar' en todo (evita quedar sin acceso por un error de configuración).
 *   - 'usuarios' (cuentas y permisos) es solo de admin y no se configura.
 */

export type Rol = "admin" | "direccion_medica" | "coordinador";

export const ROLES: readonly Rol[] = ["admin", "direccion_medica", "coordinador"];

/** Roles cuyos permisos se configuran (admin siempre tiene acceso total). */
export const ROLES_CONFIGURABLES: readonly Rol[] = ["direccion_medica", "coordinador"];

export type Seccion =
  | "dashboard"
  | "cumplimiento"
  | "productividad"
  | "inteligencia"
  | "carga"
  | "profesionales"
  | "metas"
  | "citas"
  | "usuarios";

export type Nivel = "ninguno" | "ver" | "editar";

export const NIVELES: readonly Nivel[] = ["ninguno", "ver", "editar"];

export type Permisos = Record<Seccion, Nivel>;

export interface DefSeccion {
  clave: Seccion;
  etiqueta: string;
  descripcion: string;
  /** Página de entrada de la sección (inicio y menú). */
  ruta: string;
  /** ¿Tiene acciones de escritura? Si no, el nivel máximo es 'ver'. */
  admiteEdicion: boolean;
  /** ¿Se puede cambiar desde la matriz de permisos? */
  configurable: boolean;
}

/** Secciones en el orden del menú lateral. */
export const SECCIONES: readonly DefSeccion[] = [
  {
    clave: "dashboard",
    etiqueta: "Dashboard",
    descripcion: "Autorizaciones: indicadores y tipos de prestación.",
    ruta: "/dashboard",
    admiteEdicion: false,
    configurable: true,
  },
  {
    clave: "cumplimiento",
    etiqueta: "Cumplimiento",
    descripcion: "Cumplimiento de metas por profesional.",
    ruta: "/dashboard/cumplimiento",
    admiteEdicion: false,
    configurable: true,
  },
  {
    clave: "productividad",
    etiqueta: "Productividad",
    descripcion: "Tablero de citas y ficha de cada profesional.",
    ruta: "/dashboard/productividad",
    admiteEdicion: false,
    configurable: true,
  },
  {
    clave: "inteligencia",
    etiqueta: "Inteligencia",
    descripcion: "Mapa de relaciones, simulador y alertas (editar = configurar las reglas de alerta).",
    ruta: "/dashboard/inteligencia",
    admiteEdicion: true,
    configurable: true,
  },
  {
    clave: "carga",
    etiqueta: "Carga de archivos",
    descripcion: "Subir, validar y eliminar archivos de autorizaciones.",
    ruta: "/admin/carga",
    admiteEdicion: true,
    configurable: true,
  },
  {
    clave: "profesionales",
    etiqueta: "Profesionales",
    descripcion: "Catálogo de médicos y profesionales.",
    ruta: "/admin/medicos",
    admiteEdicion: true,
    configurable: true,
  },
  {
    clave: "metas",
    etiqueta: "Metas",
    descripcion: "Metas por programa y programas por especialidad.",
    ruta: "/admin/metas",
    admiteEdicion: true,
    configurable: true,
  },
  {
    clave: "citas",
    etiqueta: "Citas",
    descripcion: "Carga de citas atendidas y áreas de servicio.",
    ruta: "/admin/citas",
    admiteEdicion: true,
    configurable: true,
  },
  {
    clave: "usuarios",
    etiqueta: "Usuarios",
    descripcion: "Cuentas de usuario y permisos por rol.",
    ruta: "/admin/usuarios",
    admiteEdicion: true,
    configurable: false,
  },
];

const POR_CLAVE = new Map(SECCIONES.map((s) => [s.clave, s]));

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

export function esSeccion(valor: unknown): valor is Seccion {
  return typeof valor === "string" && POR_CLAVE.has(valor as Seccion);
}

export function esNivel(valor: unknown): valor is Nivel {
  return typeof valor === "string" && (NIVELES as readonly string[]).includes(valor);
}

function todas(nivel: Nivel): Permisos {
  return Object.fromEntries(SECCIONES.map((s) => [s.clave, nivel])) as Permisos;
}

/** Acceso fijo anterior a los permisos configurables; es la semilla de 018. */
export const PERMISOS_POR_DEFECTO: Readonly<Record<Rol, Permisos>> = {
  admin: todas("editar"),
  direccion_medica: {
    ...todas("ninguno"),
    dashboard: "ver",
    cumplimiento: "ver",
    productividad: "ver",
    inteligencia: "ver",
    metas: "ver",
  },
  coordinador: { ...todas("ninguno"), dashboard: "ver" },
};

export interface FilaPermiso {
  rol: string;
  seccion: string;
  nivel: string;
}

/** Permisos de un rol a partir de las filas de permisos_rol, con las reglas fijas aplicadas. */
export function permisosEfectivos(rol: Rol, filas: readonly FilaPermiso[]): Permisos {
  if (rol === "admin") return todas("editar");

  const permisos = todas("ninguno");
  for (const f of filas) {
    if (f.rol !== rol || !esSeccion(f.seccion) || !esNivel(f.nivel)) continue;
    const def = POR_CLAVE.get(f.seccion)!;
    if (!def.configurable) continue;
    permisos[f.seccion] = f.nivel === "editar" && !def.admiteEdicion ? "ver" : f.nivel;
  }
  return permisos;
}

/** Requisito de una página o ruta /api: basta con tener el nivel en una de las secciones. */
export interface Requisito {
  secciones: readonly Seccion[];
  nivel: Exclude<Nivel, "ninguno">;
}

function alcanza(tiene: Nivel, pide: Requisito["nivel"]): boolean {
  return pide === "ver" ? tiene !== "ninguno" : tiene === "editar";
}

export function cumpleRequisito(permisos: Permisos | null | undefined, req: Requisito): boolean {
  if (!permisos) return false;
  return req.secciones.some((s) => alcanza(permisos[s], req.nivel));
}

export function puedeEditar(permisos: Permisos | null | undefined, seccion: Seccion): boolean {
  return cumpleRequisito(permisos, { secciones: [seccion], nivel: "editar" });
}

/** Página → sección. Gana el prefijo más largo (por segmentos completos). */
const RUTAS_PAGINA: ReadonlyArray<{ prefijo: string; seccion: Seccion }> = [
  { prefijo: "/dashboard", seccion: "dashboard" }, // incluye /dashboard/tipo/*
  { prefijo: "/dashboard/cumplimiento", seccion: "cumplimiento" },
  { prefijo: "/dashboard/productividad", seccion: "productividad" },
  { prefijo: "/dashboard/inteligencia", seccion: "inteligencia" },
  // Cualquier otra página de administración es solo de admin (como 'usuarios')
  { prefijo: "/admin", seccion: "usuarios" },
  { prefijo: "/admin/carga", seccion: "carga" },
  { prefijo: "/admin/medicos", seccion: "profesionales" },
  { prefijo: "/admin/metas", seccion: "metas" },
  { prefijo: "/admin/citas", seccion: "citas" },
  { prefijo: "/admin/citas-atendidas", seccion: "citas" }, // redirige a /admin/citas
  { prefijo: "/admin/usuarios", seccion: "usuarios" },
];

function coincide(pathname: string, prefijo: string): boolean {
  return pathname === prefijo || pathname.startsWith(`${prefijo}/`);
}

export function seccionDeRuta(pathname: string): Seccion | null {
  const ruta = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  let mejor: { prefijo: string; seccion: Seccion } | null = null;
  for (const r of RUTAS_PAGINA) {
    if (coincide(ruta, r.prefijo) && (!mejor || r.prefijo.length > mejor.prefijo.length)) mejor = r;
  }
  return mejor?.seccion ?? null;
}

/** ¿Pueden estos permisos abrir la página? Rutas sin sección: no. */
export function puedeVer(permisos: Permisos | null | undefined, pathname: string): boolean {
  const seccion = seccionDeRuta(pathname);
  return seccion !== null && cumpleRequisito(permisos, { secciones: [seccion], nivel: "ver" });
}

/** Parámetro que se agrega al inicio cuando se niega una página. */
export const PARAM_SIN_ACCESO = "sin_acceso";

/** Página para quien no tiene ninguna sección asignada (no exige ninguna sección). */
export const RUTA_SIN_SECCIONES = "/sin-acceso";

/**
 * Inicio del rol: admin conserva Carga de archivos; los demás, la primera
 * sección visible en el orden del menú. null si no ve ninguna.
 */
export function rutaInicio(rol: Rol, permisos: Permisos): string | null {
  if (rol === "admin") return "/admin/carga";
  const primera = SECCIONES.find((s) => permisos[s.clave] !== "ninguno");
  return primera?.ruta ?? null;
}

/** A dónde enviar a quien abre una página sin permiso. Nunca es una página vedada (sin bucles). */
export function destinoSinAcceso(rol: Rol, permisos: Permisos): string {
  const inicio = rutaInicio(rol, permisos);
  return inicio ? `${inicio}?${PARAM_SIN_ACCESO}=1` : RUTA_SIN_SECCIONES;
}

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const ver = (...secciones: Seccion[]): Requisito => ({ secciones, nivel: "ver" });
const editar = (...secciones: Seccion[]): Requisito => ({ secciones, nivel: "editar" });

/**
 * Requisito de cada ruta /api por método: lecturas → ver, escrituras → editar.
 * Los POST de consulta (filtros, export, cumplimiento) solo leen.
 * Fuentes de datos compartidas: algunos GET de /api/admin los usa también
 * Cumplimiento (catálogo de médicos y citas atendidas), así que quedan
 * abiertos a quien ve esa sección.
 */
export const PERMISOS_API = {
  "/api/dashboard/kpis": { GET: ver("dashboard") },
  "/api/dashboard/filtros": { POST: ver("dashboard") },
  "/api/dashboard/export": { POST: ver("dashboard") },
  "/api/cumplimiento": { POST: ver("cumplimiento") },
  // El simulador de Inteligencia parte de estos mismos agregados
  "/api/productividad": { GET: ver("productividad", "inteligencia") },
  "/api/productividad/profesional": { GET: ver("productividad") },
  // El informe mensual agrega prioridades solo si además se ve Inteligencia
  "/api/informes/excel": { GET: ver("productividad") },
  "/api/inteligencia/grafo": { GET: ver("inteligencia") },
  "/api/inteligencia/alertas": { GET: ver("inteligencia") },
  "/api/inteligencia/alertas/conteo": { GET: ver("inteligencia") },
  "/api/inteligencia/reglas": { GET: ver("inteligencia"), PUT: editar("inteligencia") },
  "/api/admin/metas": { GET: ver("metas"), PUT: editar("metas") },
  "/api/admin/metas/programas": { GET: ver("metas"), PUT: editar("metas") },
  "/api/admin/medicos": { GET: ver("profesionales", "cumplimiento"), POST: editar("profesionales") },
  "/api/admin/medicos/[id]": { PATCH: editar("profesionales"), DELETE: editar("profesionales") },
  "/api/admin/medicos/importar": { POST: editar("profesionales") },
  "/api/admin/citas-atendidas": { GET: ver("citas", "cumplimiento"), PUT: editar("citas") },
  "/api/admin/citas-atendidas/importar": { POST: editar("citas") },
  "/api/admin/citas/detalle": { GET: ver("citas", "cumplimiento") },
  "/api/admin/citas/areas": { GET: ver("citas"), PUT: editar("citas") },
  "/api/carga/historial": { GET: ver("carga") },
  "/api/carga/validacion/[jobId]": { GET: ver("carga") },
  "/api/carga/preview/[jobId]": { GET: ver("carga") },
  "/api/carga/upload": { POST: editar("carga") },
  "/api/carga/confirm/[jobId]": { POST: editar("carga") },
  "/api/carga/cancel/[jobId]": { POST: editar("carga") },
  "/api/carga/[jobId]": { DELETE: editar("carga") },
  "/api/admin/usuarios": { GET: ver("usuarios"), POST: editar("usuarios") },
  "/api/admin/usuarios/[id]": { PATCH: editar("usuarios"), DELETE: editar("usuarios") },
  "/api/admin/permisos": { GET: ver("usuarios"), PUT: editar("usuarios") },
} as const satisfies Record<string, Partial<Record<Metodo, Requisito>>>;

export interface CambioPermiso {
  rol: Rol;
  seccion: Seccion;
  nivel: Nivel;
}

const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  direccion_medica: "Dirección médica",
  coordinador: "Coordinador",
};

export function etiquetaRol(rol: Rol): string {
  return ETIQUETA_ROL[rol];
}

/** Valida el cuerpo de PUT /api/admin/permisos: { cambios: [{ rol, seccion, nivel }] }. */
export function validarCambiosPermisos(
  cuerpo: unknown,
): { cambios: CambioPermiso[] } | { error: string } {
  const lista = (cuerpo as { cambios?: unknown } | null)?.cambios;
  if (!Array.isArray(lista) || lista.length === 0) {
    return { error: "Debe enviar al menos un cambio de permisos" };
  }

  const cambios: CambioPermiso[] = [];
  const vistos = new Set<string>();
  for (let i = 0; i < lista.length; i++) {
    const fila = lista[i] as Partial<Record<keyof CambioPermiso, unknown>> | null;
    const n = `Fila ${i + 1}`;
    if (!fila || typeof fila !== "object") return { error: `${n}: formato no válido` };
    const { rol, seccion, nivel } = fila;
    if (!esRol(rol) || !ROLES_CONFIGURABLES.includes(rol)) {
      return { error: `${n}: el rol no es configurable` };
    }
    if (!esSeccion(seccion)) return { error: `${n}: sección no válida` };
    const def = POR_CLAVE.get(seccion)!;
    if (!def.configurable) return { error: `${n}: ${def.etiqueta} no es configurable` };
    if (!esNivel(nivel)) return { error: `${n}: nivel no válido` };
    if (nivel === "editar" && !def.admiteEdicion) {
      return { error: `${n}: ${def.etiqueta} solo admite consulta` };
    }
    const clave = `${rol}:${seccion}`;
    if (vistos.has(clave)) return { error: `${n}: el permiso está repetido` };
    vistos.add(clave);
    cambios.push({ rol, seccion, nivel });
  }
  return { cambios };
}
