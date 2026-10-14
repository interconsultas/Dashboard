/** Fila que retorna GET /api/admin/citas-atendidas. */
export interface FilaCitasApi {
  documento: string;
  nombre: string | null;
  estado: string | null;
  /** Programa de metas que resulta de la especialidad del profesional. */
  programa: string | null;
  cantidad_citas: number | null;
}

/** Valores editados de una fila que todavía no se han guardado. */
export interface EdicionCitas {
  citas?: string;
}

export type Ediciones = Record<string, EdicionCitas>;

/** Fila lista para mostrar: valores guardados más las ediciones pendientes. */
export interface FilaGrilla {
  documento: string;
  nombre: string;
  estado: string | null;
  /** Texto del campo de citas; vacío significa "sin registro en el periodo". */
  citas: string;
  /** Programa de la especialidad (solo lectura); vacío significa "sin programa". */
  programa: string;
  /** El periodo ya tiene un registro guardado para este profesional. */
  guardada: boolean;
  citasInvalida: boolean;
  cambiada: boolean;
}

/** Fila que recibe PUT /api/admin/citas-atendidas. */
export interface CambioCitas {
  documento: string;
  cantidad_citas: number | null;
}

const MAX_CITAS = 2147483647;

/** Retorna null si el texto está vacío y NaN si no es un entero mayor o igual que cero. */
export function parseCitas(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === "") return null;
  if (!/^\d+$/.test(limpio)) return NaN;
  const n = Number(limpio);
  return n <= MAX_CITAS ? n : NaN;
}

export function construirFilas(api: FilaCitasApi[], ediciones: Ediciones): FilaGrilla[] {
  return api.map((f) => {
    const guardada = f.cantidad_citas !== null;
    const edicion = ediciones[f.documento];
    const citas = edicion?.citas ?? (guardada ? String(f.cantidad_citas) : "");

    const cantidad = parseCitas(citas);
    const cambiada = cantidad !== f.cantidad_citas;

    return {
      documento: f.documento,
      nombre: f.nombre ?? "—",
      estado: f.estado,
      citas,
      programa: f.programa ?? "",
      guardada,
      citasInvalida: Number.isNaN(cantidad),
      cambiada,
    };
  });
}

/** Filas a enviar al guardar. Las citas vacías se envían como null (eliminar). */
export function cambiosPendientes(filas: FilaGrilla[]): CambioCitas[] {
  return filas
    .filter((f) => f.cambiada && !f.citasInvalida)
    .map((f) => ({ documento: f.documento, cantidad_citas: parseCitas(f.citas) }));
}

export function filtrarFilas(
  filas: FilaGrilla[],
  { mostrarTodos, busqueda }: { mostrarTodos: boolean; busqueda: string }
): FilaGrilla[] {
  const q = busqueda.trim().toUpperCase();
  return filas.filter((f) => {
    if (!mostrarTodos && !f.programa && !f.guardada && f.citas === "") return false;
    if (!q) return true;
    return f.nombre.toUpperCase().includes(q) || f.documento.includes(q);
  });
}

export function contarFilas(filas: FilaGrilla[]): {
  total: number;
  conCitas: number;
  sinPrograma: number;
} {
  const conCitas = filas.filter((f) => f.citas.trim() !== "" && !f.citasInvalida);
  return {
    total: filas.length,
    conCitas: conCitas.length,
    sinPrograma: conCitas.filter((f) => f.programa === "").length,
  };
}
