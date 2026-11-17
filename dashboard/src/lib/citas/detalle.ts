/** Métricas del informe de citas detallado por profesional de Agenda Web. */
export const METRICAS = [
  "creadas",
  "bloqueadas",
  "ofertadas",
  "disponibles",
  "asignadas",
  "confirmadas",
  "confirmadas_sin_atencion",
  "inasistidas",
  "canceladas",
  "pendientes_por_asistir",
] as const;

export type Metrica = (typeof METRICAS)[number];
export type Metricas = Record<Metrica, number>;

export const ETIQUETAS_METRICA: Record<Metrica, string> = {
  creadas: "Creadas",
  bloqueadas: "Bloqueadas",
  ofertadas: "Ofertadas",
  disponibles: "Disponibles",
  asignadas: "Asignadas",
  confirmadas: "Confirmadas",
  confirmadas_sin_atencion: "Confirmadas sin atención",
  inasistidas: "Inasistidas",
  canceladas: "Canceladas",
  pendientes_por_asistir: "Pendientes por asistir",
};

export interface ServicioCitas extends Metricas {
  codigo_servicio: string;
  nombre_servicio: string;
}

export interface ProfesionalCitas extends Metricas {
  tipo_documento: string;
  documento: string;
  nombre: string;
  num_servicios: number;
  servicios: ServicioCitas[];
}

export interface DetalleCitas {
  periodo: number;
  periodos: number[];
  profesionales: ProfesionalCitas[];
  totales: Metricas & { profesionales: number };
}

/** Fila profesional × servicio tal como la devuelve la consulta agregada. */
export type FilaServicioDb = {
  tipo_documento: string;
  documento: string;
  nombre: string;
  codigo_servicio: string;
  nombre_servicio: string;
} & Record<Metrica, number | string>;

function ceros(): Metricas {
  return Object.fromEntries(METRICAS.map((m) => [m, 0])) as Metricas;
}

function sumar(destino: Metricas, origen: Metricas) {
  for (const m of METRICAS) destino[m] += origen[m];
}

/** Agrupa las filas profesional × servicio por profesional y calcula los totales. */
export function agruparDetalle(
  filas: FilaServicioDb[]
): Pick<DetalleCitas, "profesionales" | "totales"> {
  const porProfesional = new Map<string, ProfesionalCitas>();
  const totales = { ...ceros(), profesionales: 0 };

  for (const f of filas) {
    const servicio: ServicioCitas = {
      codigo_servicio: f.codigo_servicio,
      nombre_servicio: f.nombre_servicio,
      ...(Object.fromEntries(METRICAS.map((m) => [m, Number(f[m])])) as Metricas),
    };
    const clave = `${f.tipo_documento}|${f.documento}`;
    let prof = porProfesional.get(clave);
    if (!prof) {
      prof = {
        tipo_documento: f.tipo_documento,
        documento: String(f.documento),
        nombre: f.nombre,
        num_servicios: 0,
        servicios: [],
        ...ceros(),
      };
      porProfesional.set(clave, prof);
    }
    prof.servicios.push(servicio);
    prof.num_servicios = prof.servicios.length;
    sumar(prof, servicio);
    sumar(totales, servicio);
  }

  const profesionales = Array.from(porProfesional.values());
  totales.profesionales = profesionales.length;
  return { profesionales, totales };
}

/** Filtra por nombre o cédula, sin distinguir mayúsculas ni tildes. */
export function filtrarProfesionales(
  profesionales: ProfesionalCitas[],
  busqueda: string
): ProfesionalCitas[] {
  const normalizar = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = normalizar(busqueda.trim());
  if (!q) return profesionales;
  return profesionales.filter(
    (p) => normalizar(p.nombre).includes(q) || p.documento.includes(q)
  );
}

export type ColumnaOrden = "nombre" | "num_servicios" | Metrica;
export interface Orden {
  columna: ColumnaOrden;
  descendente: boolean;
}

export function ordenarProfesionales(
  profesionales: ProfesionalCitas[],
  { columna, descendente }: Orden
): ProfesionalCitas[] {
  const signo = descendente ? -1 : 1;
  return [...profesionales].sort((a, b) => {
    const cmp =
      columna === "nombre"
        ? a.nombre.localeCompare(b.nombre, "es")
        : a[columna] - b[columna];
    return cmp * signo || a.nombre.localeCompare(b.nombre, "es");
  });
}

export function fmtNumero(valor: number): string {
  return valor.toLocaleString("es-CO");
}
