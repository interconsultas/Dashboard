/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...args: unknown[]) => mockUseSWR(...args) }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/dashboard/inteligencia",
  useSearchParams: () => new URLSearchParams("pestana=alertas"),
}));
jest.mock("@/components/layout/RolContext", () => ({ usePuedeVer: () => true, usePuedeEditar: () => false }));
jest.mock("@/components/productividad/Grafico", () => ({
  Grafico: ({ etiqueta }: { etiqueta: string }) => <div role="img" aria-label={etiqueta} />,
}));

import { AlertasVista } from "@/components/inteligencia/AlertasVista";
import type { Alerta } from "@/lib/inteligencia/alertas";
import type { Prioridad } from "@/lib/inteligencia/prioridades";
import { CLAVES_REGLAS, REGLAS_POR_DEFECTO } from "@/lib/inteligencia/reglas";
import type { RespuestaAlertas } from "@/lib/inteligencia/tipos";

const ALERTA: Alerta = {
  regla: "inasistencia_servicio",
  gravedad: "alta",
  ambito: { tipo: "servicio", id: "890", nombre: "PSICOLOGIA", area: "Psicosocial" },
  mensaje: "Psicosocial — PSICOLOGIA: inasistencia 36,2 % y 35,0 % en los dos últimos meses (umbral 20 %)",
  valores: { actual: 0.35, umbral: 0.2, serie: [] },
  magnitud: 0.15,
  enlace: "/dashboard/productividad?periodo=202610&area=Psicosocial&servicio=890",
};

const PRIORIDAD: Prioridad = {
  id: "inasistencia|Psicosocial",
  tipo: "inasistencia_area",
  area: "Psicosocial",
  titular: "Psicosocial: 1 servicio con inasistencia sostenida sobre 20 % — PSICOLOGIA (35 %)",
  citas: 80,
  referencia: "por encima de la meta del 10 %",
  profesionales: 0.8,
  revisar: "Revisar recordatorios y sobreagenda en Psicosocial",
  enlace: "/dashboard/productividad?periodo=202610&area=Psicosocial",
  detalle: [],
  novedad: "nuevo",
  citas_anterior: null,
};

const DATOS: RespuestaAlertas = {
  periodo: { clave: "202610", etiqueta: "Oct 2026", etiqueta_larga: "Octubre 2026", fecha_inicial: "2026-10-01", fecha_final: "2026-10-31" },
  siguiente: { clave: "202611", etiqueta: "Nov 2026", etiqueta_larga: "Noviembre 2026" },
  alertas: [ALERTA, { ...ALERTA, ambito: { ...ALERTA.ambito, id: "891", nombre: "OTRO" }, mensaje: "Psicosocial — OTRO" }],
  conteo: { inasistencia_servicio: 2, disponibilidad_servicio: 0, inasistencia_profesional: 0, proyeccion_sobre_meta: 0 },
  total: 2,
  proyeccion: { areas: [], servicios: [] },
  granularidad: "mensual",
  meta: 0.1,
  periodos_cargados: 4,
  min_periodos_proyeccion: 3,
  reglas: CLAVES_REGLAS.map((clave) => ({ clave, ...REGLAS_POR_DEFECTO[clave], actualizado_en: null, actualizado_por: null })),
  prioridades: [PRIORIDAD],
  periodo_anterior: "202609",
  impacto_minimo: 50,
};

describe("AlertasVista", () => {
  beforeEach(() => {
    mockUseSWR.mockReset();
    mockUseSWR.mockReturnValue({ data: DATOS, error: undefined, isValidating: false, isLoading: false, mutate: jest.fn() });
  });

  it("orden ejecutivo: proyección, prioridades, todas las alertas y reglas", () => {
    render(<AlertasVista />);
    const titulos = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    const indice = (re: RegExp) => titulos.findIndex((t) => re.test(t ?? ""));
    expect(indice(/^Proyección para Noviembre 2026/)).toBe(0);
    expect(indice(/^Prioridades$/)).toBe(1);
    const verTodas = screen.getByRole("button", { name: "Ver todas las alertas (2)" });
    const reglas = screen.getByRole("heading", { name: /Reglas/ });
    expect(screen.getByRole("heading", { name: "Prioridades" }).compareDocumentPosition(verTodas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(verTodas.compareDocumentPosition(reglas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("la lista completa de alertas empieza plegada y se despliega con sus filtros", () => {
    render(<AlertasVista />);
    expect(screen.getByText(PRIORIDAD.titular)).toBeInTheDocument();
    expect(screen.queryByText(ALERTA.mensaje)).not.toBeInTheDocument();
    const boton = screen.getByRole("button", { name: "Ver todas las alertas (2)" });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(ALERTA.mensaje)).toBeInTheDocument();
    expect(screen.getByLabelText("Gravedad")).toBeInTheDocument();
  });
});
