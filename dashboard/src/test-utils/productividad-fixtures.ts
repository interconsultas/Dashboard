/** Datos de prueba compartidos por los tests de componentes de productividad. */
import { indicadores, metricasVacias, type Metricas } from "@/lib/productividad/metricas";
import type { NodoArea, RespuestaProductividad } from "@/lib/productividad/tipos";

export function met(ofertadas: number, asignadas: number, inasistidas: number, disponibles: number): Metricas {
  return { ...metricasVacias(), ofertadas, asignadas, inasistidas, disponibles };
}

export const AREAS = ["Medicina general", "Salud oral", "Enfermería"];

export const SERVICIOS = [
  { codigo: "11", nombre: "CONSULTA MEDICINA GENERAL", area: "Medicina general" },
  { codigo: "12", nombre: "CONTROL MEDICINA GENERAL", area: "Medicina general" },
  { codigo: "152", nombre: "ODONTOLOGIA", area: "Salud oral" },
];

export const NODOS: NodoArea[] = [
  {
    area: "Medicina general",
    ...indicadores(met(220, 200, 38, 20)),
    servicios: [
      { codigo: "11", nombre: "CONSULTA MEDICINA GENERAL", ...indicadores(met(200, 180, 36, 20)) },
      { codigo: "12", nombre: "CONTROL MEDICINA GENERAL", ...indicadores(met(20, 20, 2, 0)) },
    ],
  },
  {
    area: "Salud oral",
    ...indicadores(met(60, 50, 15, 10)),
    servicios: [{ codigo: "152", nombre: "ODONTOLOGIA", ...indicadores(met(60, 50, 15, 10)) }],
  },
];

export const PERIODOS = {
  mensual: [
    { clave: "202609", etiqueta: "Sep 2026", etiqueta_larga: "Septiembre 2026", fecha_inicial: "2026-09-01", fecha_final: "2026-09-30" },
    { clave: "202610", etiqueta: "Oct 2026", etiqueta_larga: "Octubre 2026", fecha_inicial: "2026-10-01", fecha_final: "2026-10-31" },
  ],
  semanal: [],
};

const actual = indicadores(met(280, 250, 53, 30));
const anterior = indicadores(met(110, 90, 20, 20));

export const RESPUESTA: RespuestaProductividad = {
  granularidad: "mensual",
  periodos: PERIODOS,
  periodo: "202610",
  opciones: {
    areas: AREAS,
    servicios: SERVICIOS,
    profesionales: [
      { documento: "1053", nombre: "PROFESIONAL UNO" },
      { documento: "2077", nombre: "PROFESIONAL DOS" },
    ],
  },
  kpis: {
    actual,
    anterior,
    periodo_anterior: "202609",
    serie: [
      { clave: "202609", etiqueta: "Sep 2026", ...anterior },
      { clave: "202610", etiqueta: "Oct 2026", ...actual },
    ],
  },
  tendencia: [
    { clave: "202609", etiqueta: "Sep 2026", ...anterior },
    { clave: "202610", etiqueta: "Oct 2026", ...actual },
  ],
  embudo: { ofertadas: 280, asignadas: 250, atendidas: 197, disponibles: 30, inasistidas: 53 },
  mapa_calor: {
    areas: AREAS,
    periodos: [{ clave: "202609", etiqueta: "Sep 2026" }, { clave: "202610", etiqueta: "Oct 2026" }],
    celdas: [{ area: "Medicina general", clave: "202610", pct_inasistencia: 0.19, inasistidas: 38, asignadas: 200 }],
  },
  arbol: NODOS,
  matriz: { areas: NODOS, total: actual },
  profesionales: { con_agenda: 12, destacados: 3, lista: [] },
};
