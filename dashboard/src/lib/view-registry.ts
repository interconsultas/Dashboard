import { type FiltrosBody } from "./dashboard-filters";

const REGISTRY: Record<string, Partial<FiltrosBody>> = {
  vm_filtros_dashboard: {},
  vm_dash_laboratorios: {
    tipo_convenio: ["CAPITADO"],
    orden_agrup: ["LABORATORIO CLINICO", "ACT Y PROCEDIMIENTOS OTROS POS"],
    agrup_salud: ["PROCEDIMIENTOS DIAGNOSTICOS"],
  },
  vm_dash_rx: {
    orden_agrup: ["RADIOLOGIA"],
    agrup_salud: ["PROCEDIMIENTOS DIAGNOSTICOS"],
  },
  vm_dash_ecografias: {
    tipo_convenio: ["CAPITADO"],
    orden_agrup: ["ECOGRAFIA"],
    agrup_salud: ["PROCEDIMIENTOS DIAGNOSTICOS"],
  },
  vm_dash_remisiones_cap: {
    tipo_convenio: ["CAPITADO"],
    orden_agrup: ["CONSULTA ESP BASICAS", "CONSULTA MEDICO GENERAL", "CONSULTA OTRAS ESP.", "PROMOCION Y PREVENCION", "SALUD EN CASA"],
    agrup_salud: ["CONSULTAS MEDICAS", "NIVEL BASICO Y ATENCION DOMICIALIARIA"],
    // Los dobles espacios ("CONTROL  EN ...") son intencionales: así vienen en
    // los datos de origen. Debe coincidir con 006/015 (test_sql_filtros_remisiones.py).
    prestacion: [
      "CONTROL  EN PEDIATRIA",
      "CONSULTA  EN PEDIATRIA",
      "CONTROL PEDIATRA",
      "CONSULTA PEDIATRA",
      "CONTROL  EN MEDICINA INTERNA",
      "CONSULTA  EN MEDICINA INTERNA",
      "CONTROL MEDICINA INTERNA (NO VIGENTE, USAR CODIGO 890366)",
      "CONTROL MEDICINA INTERNA",
      "CONSULTA MEDICINA INTERNA",
      "CONTROL GINECOLOGIA",
      "CONSULTA GINECOLOGIA",
      "CONTROL GINECOLOGO (A) (NO VIGENTE, USAR CODIGO 890350)",
      "CONTROL GINECOLOGO (A)",
      "CONSULTA GINECOLOGO",
      "CONTROL  EN DERMATOLOGIA",
      "CONSULTA  EN DERMATOLOGIA",
      "CONTROL DERMATOLOGO (A)",
      "CONSULTA DERMATOLOGIA",
    ],
  },
  vm_dash_medicamentos: {
    exclude_orden_agrup: ["PROGRAMAS ESPECIALES"],
    agrup_salud: ["MEDICAMENTOS NO PBS", "MEDICAMENTOS PBS AMBULATORIOS"],
  },
  vm_dash_remisiones_ext: {
    tipo_convenio: ["ACTIVIDAD"],
    orden_agrup: ["CONSULTA ESP BASICAS", "CONSULTA MEDICA URGENTE", "CONSULTA MEDICO GENERAL", "CONSULTA OTRAS ESP."],
    agrup_salud: ["CONSULTAS MEDICAS", "NIVEL BASICO Y ATENCION DOMICIALIARIA"],
  },
  vm_dash_proc_dx: {
    tipo_convenio: ["ACTIVIDAD", "VALOR AGREGADO", "COMPRAS POR VOLUMEN"],
    agrup_salud: ["ENDOSCOPIAS DIAGNOST Y TERAPEUTICAS", "NIVEL BASICO Y ATENCION DOMICILIARIA", "PROCEDIMIENTOS DIAGNOSTICOS"],
  },
};

export const DEFAULT_VIEW = "vm_filtros_dashboard";

export function isAllowedView(name: string): boolean {
  return name in REGISTRY;
}

export function resolveView(name?: string | null): string {
  if (!name) return DEFAULT_VIEW;
  return isAllowedView(name) ? name : DEFAULT_VIEW;
}

export function getViewFilters(name: string): Partial<FiltrosBody> {
  return REGISTRY[name] ?? {};
}
