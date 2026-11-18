/** Respuestas mínimas de productividad, ficha y alertas para las pruebas de informes. */
import { indicadores, metricasVacias, type Indicadores } from "@/lib/productividad/metricas";
import type { RespuestaFichaProfesional, RespuestaProductividad } from "@/lib/productividad/tipos";
import type { RespuestaAlertas } from "@/lib/inteligencia/tipos";

export function ind(v: { ofertadas: number; asignadas: number; inasistidas: number; disponibles: number }): Indicadores {
  return indicadores({ ...metricasVacias(), ...v });
}

const OCT = ind({ ofertadas: 1000, asignadas: 800, inasistidas: 120, disponibles: 200 });
const SEP = ind({ ofertadas: 900, asignadas: 700, inasistidas: 70, disponibles: 200 });
const MG = ind({ ofertadas: 600, asignadas: 500, inasistidas: 100, disponibles: 100 });
const SO = ind({ ofertadas: 400, asignadas: 300, inasistidas: 20, disponibles: 100 });

export const PRODUCTIVIDAD: RespuestaProductividad = {
  granularidad: "mensual",
  periodos: {
    mensual: [
      { clave: "202609", etiqueta: "Sep 2026", etiqueta_larga: "Septiembre 2026", fecha_inicial: "2026-09-01", fecha_final: "2026-09-30" },
      { clave: "202610", etiqueta: "Oct 2026", etiqueta_larga: "Octubre 2026", fecha_inicial: "2026-10-01", fecha_final: "2026-10-31" },
    ],
    semanal: [],
  },
  periodo: "202610",
  opciones: {
    areas: ["Medicina general", "Salud oral"],
    servicios: [
      { codigo: "11", nombre: "CONSULTA", area: "Medicina general" },
      { codigo: "22", nombre: "HIGIENE", area: "Salud oral" },
    ],
    profesionales: [
      { documento: "1053", nombre: "PROFESIONAL A" },
      { documento: "2077", nombre: "PROFESIONAL B" },
    ],
  },
  kpis: {
    actual: OCT,
    anterior: SEP,
    periodo_anterior: "202609",
    serie: [
      { clave: "202609", etiqueta: "Sep 2026", ...SEP },
      { clave: "202610", etiqueta: "Oct 2026", ...OCT },
    ],
  },
  tendencia: [
    { clave: "202609", etiqueta: "Sep 2026", ...SEP },
    { clave: "202610", etiqueta: "Oct 2026", ...OCT },
  ],
  embudo: null,
  mapa_calor: { areas: [], periodos: [], celdas: [] },
  arbol: [],
  matriz: {
    areas: [
      { area: "Medicina general", ...MG, servicios: [{ codigo: "11", nombre: "CONSULTA", ...MG }] },
      { area: "Salud oral", ...SO, servicios: [{ codigo: "22", nombre: "HIGIENE", ...SO }] },
    ],
    total: OCT,
  },
  profesionales: {
    con_agenda: 2,
    destacados: 1,
    lista: [
      { documento: "1053", nombre: "PROFESIONAL A", area_principal: "Salud oral", ...SO },
      { documento: "2077", nombre: "PROFESIONAL B", area_principal: "Medicina general", ...MG },
    ],
  },
};

export const FICHA: RespuestaFichaProfesional = {
  documento: "1053",
  nombre: "PROFESIONAL A",
  area_principal: "Salud oral",
  granularidad: "mensual",
  periodo: "202610",
  etiqueta_periodo: "Octubre 2026",
  actual: SO,
  institucion: { pct_inasistencia: 0.15 },
  percentil: 80,
  pares: 25,
  servicios: [{ codigo: "22", nombre: "HIGIENE", ...SO }],
  tendencia: [
    { clave: "202609", etiqueta: "Sep 2026", ...SEP },
    { clave: "202610", etiqueta: "Oct 2026", ...SO },
  ],
};

export const ALERTAS = {
  granularidad: "mensual",
  periodo: PRODUCTIVIDAD.periodos.mensual[1],
  siguiente: { clave: "202611", etiqueta: "Nov 2026", etiqueta_larga: "Noviembre 2026" },
  alertas: [],
  conteo: {},
  total: 0,
  meta: 0.1,
  periodos_cargados: 2,
  min_periodos_proyeccion: 3,
  reglas: [],
  periodo_anterior: "202609",
  impacto_minimo: 50,
  prioridades: [
    {
      id: "inasistencia_area:Medicina general",
      tipo: "inasistencia_area",
      area: "Medicina general",
      titular: "Medicina general: 50 citas inasistidas por encima de la meta",
      citas: 50,
      referencia: "por encima de la meta del 10 %",
      profesionales: 1.25,
      revisar: "Confirmación de citas",
      enlace: "/dashboard/productividad?area=Medicina+general",
      detalle: [{ nombre: "CONSULTA", texto: "CONSULTA: 20 %", enlace: "" }],
      novedad: "nuevo",
      citas_anterior: null,
    },
  ],
  proyeccion: {
    areas: [
      {
        id: "Medicina general",
        nombre: "Medicina general",
        area: null,
        historia: [
          { clave: "202609", etiqueta: "Sep 2026", valor: 0.1 },
          { clave: "202610", etiqueta: "Oct 2026", valor: 0.2 },
        ],
        asignadas_ultimo: 500,
        inasistencia: { valor: 0.22, min: 0.18, max: 0.26, error: 0.04, pendiente: 0.01, direccion: "sube", periodos: 6 },
        asignadas: { valor: 520, min: 480, max: 560, error: 40, pendiente: 10, direccion: "estable", periodos: 6 },
      },
    ],
    servicios: [],
  },
} as unknown as RespuestaAlertas;
