import { esSeccion, type Seccion } from "./acceso";

/**
 * Módulos en desarrollo: ya están desplegados pero aún no se entregan
 * oficialmente según el cronograma. Para todos los roles, admin incluido,
 * cuentan como sin acceso (ver permisosEfectivos): solo se muestra el aviso.
 *
 * Se configura con MODULOS_EN_DESARROLLO (solo en el servidor; no se expone
 * al navegador): lista de secciones separadas por comas. Vacía = ninguno en
 * desarrollo (todos liberados). Sin definir = este valor por defecto, que deja
 * bloqueado lo que aún no se entrega.
 */
export const MODULOS_EN_DESARROLLO_POR_DEFECTO: readonly Seccion[] = ["productividad", "inteligencia"];

/** Interpreta el valor de la variable. Ignora claves desconocidas y repetidas. */
export function leerModulosEnDesarrollo(valor: string | undefined): Seccion[] {
  if (valor === undefined) return [...MODULOS_EN_DESARROLLO_POR_DEFECTO];
  const claves = valor.split(",").map((c) => c.trim().toLowerCase());
  return Array.from(new Set(claves.filter(esSeccion)));
}

/** Secciones en desarrollo según el entorno del servidor. */
export function modulosEnDesarrollo(): Seccion[] {
  return leerModulosEnDesarrollo(process.env.MODULOS_EN_DESARROLLO);
}
