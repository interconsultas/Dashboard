/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { PropsGrafico } from "@/components/productividad/Grafico";

const mockGraficos: Record<string, PropsGrafico> = {};
jest.mock("@/components/productividad/Grafico", () => ({
  Grafico: (props: PropsGrafico) => {
    mockGraficos[props.etiqueta] = props;
    return <div role="img" aria-label={props.etiqueta} />;
  },
}));

import { ListaAlertas } from "@/components/inteligencia/ListaAlertas";
import { PanelProyeccion } from "@/components/inteligencia/PanelProyeccion";
import { PanelPrioridades } from "@/components/inteligencia/PanelPrioridades";
import { PanelReglas } from "@/components/inteligencia/PanelReglas";
import type { Prioridad } from "@/lib/inteligencia/prioridades";
import type { Alerta, SerieProyectada } from "@/lib/inteligencia/alertas";
import { CLAVES_REGLAS, REGLAS_POR_DEFECTO, type ReglaAlerta } from "@/lib/inteligencia/reglas";

/* ── Fixtures ── */

const REGLAS: ReglaAlerta[] = CLAVES_REGLAS.map((clave) => ({
  clave,
  ...REGLAS_POR_DEFECTO[clave],
  actualizado_en: "2026-11-18T15:00:00Z",
  actualizado_por: clave === "inasistencia_servicio" ? "admin@ips.local" : null,
}));

const alerta = (extra: Partial<Alerta>): Alerta => ({
  regla: "inasistencia_servicio",
  gravedad: "alta",
  ambito: { tipo: "servicio", id: "890", nombre: "PSICOLOGIA", area: "Psicosocial" },
  mensaje: "Psicosocial — PSICOLOGIA: inasistencia 36,2 % y 35,0 % en los dos últimos meses (umbral 20 %)",
  valores: { actual: 0.35, umbral: 0.2, serie: [] },
  magnitud: 0.15,
  enlace: "/dashboard/productividad?periodo=202610&area=Psicosocial&servicio=890",
  ...extra,
});

const ALERTAS: Alerta[] = [
  alerta({}),
  alerta({
    regla: "disponibilidad_servicio",
    gravedad: "media",
    ambito: { tipo: "servicio", id: "100", nombre: "CONSULTA", area: "Medicina general" },
    mensaje: "Medicina general — CONSULTA: disponibilidad 18,4 % en Octubre 2026 (umbral 15 %); 120 de 652 citas ofertadas sin asignar",
    enlace: "/dashboard/productividad?periodo=202610&area=Medicina+general&servicio=100",
  }),
];

const serie = (id: string, valor: number | null, direccion: "sube" | "baja" | "estable" = "sube"): SerieProyectada => ({
  id,
  nombre: id,
  area: id,
  asignadas_ultimo: 1000,
  historia: [
    { clave: "202609", etiqueta: "Sep 2026", valor: 0.1 },
    { clave: "202610", etiqueta: "Oct 2026", valor: 0.12 },
  ],
  inasistencia: valor === null ? null : { valor, min: valor - 0.02, max: valor + 0.02, error: 0.02, pendiente: 0.01, direccion, periodos: 3 },
  asignadas: valor === null ? null : { valor: 1010, min: 990, max: 1030, error: 20, pendiente: 5, direccion: "estable", periodos: 3 },
});

const SIGUIENTE = { clave: "202611", etiqueta: "Nov 2026", etiqueta_larga: "Noviembre 2026" };

/* ── ListaAlertas ── */

describe("ListaAlertas", () => {
  it("cada alerta muestra gravedad con ícono y texto, ámbito, mensaje y enlace", () => {
    render(<ListaAlertas alertas={ALERTAS} reglas={REGLAS} veProductividad />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const primera = within(items[0]);
    expect(primera.getByText("Alta")).toBeInTheDocument();
    expect(primera.getByTestId("icono-gravedad")).toBeInTheDocument();
    expect(primera.getByText(/Servicio · Psicosocial/)).toBeInTheDocument();
    expect(primera.getByText(ALERTAS[0].mensaje)).toBeInTheDocument();
    expect(primera.getByRole("link", { name: /Ver en Productividad/ })).toHaveAttribute("href", ALERTAS[0].enlace);
    expect(within(items[1]).getByText("Media")).toBeInTheDocument();
  });

  it("sin acceso a Productividad no muestra enlaces", () => {
    render(<ListaAlertas alertas={ALERTAS} reglas={REGLAS} veProductividad={false} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("filtra por gravedad y por regla", () => {
    render(<ListaAlertas alertas={ALERTAS} reglas={REGLAS} veProductividad />);
    fireEvent.change(screen.getByLabelText("Gravedad"), { target: { value: "media" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText(ALERTAS[1].mensaje)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Gravedad"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Regla"), { target: { value: "inasistencia_servicio" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText(ALERTAS[0].mensaje)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Gravedad"), { target: { value: "media" } });
    expect(screen.getByText("Ninguna alerta coincide con el filtro")).toBeInTheDocument();
  });

  it("sin alertas: estado vacío", () => {
    render(<ListaAlertas alertas={[]} reglas={REGLAS} veProductividad />);
    expect(screen.getByText("Sin alertas activas")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});

/* ── PanelProyeccion ── */

describe("PanelProyeccion", () => {
  beforeEach(() => {
    for (const k of Object.keys(mockGraficos)) delete mockGraficos[k];
  });

  it("tabla por área con proyección, rango, dirección y comparación con la meta", () => {
    render(
      <PanelProyeccion
        areas={[serie("Psicosocial", 0.16), serie("Salud oral", 0.08, "baja"), serie("Nutrición", null)]}
        servicios={[]}
        siguiente={SIGUIENTE}
        meta={0.1}
        minPeriodos={3}
        periodosCargados={4}
      />
    );
    expect(screen.getByRole("heading", { name: /Proyección para Noviembre 2026/ })).toBeInTheDocument();
    const fila = (n: string) => within(screen.getByRole("row", { name: new RegExp(n) }));
    expect(fila("Psicosocial").getByText("16,0 %")).toBeInTheDocument();
    expect(fila("Psicosocial").getByText("14,0 %–18,0 %")).toBeInTheDocument();
    expect(fila("Psicosocial").getByText("Sube")).toBeInTheDocument();
    expect(fila("Psicosocial").getByText("Sobre la meta")).toBeInTheDocument();
    expect(fila("Salud oral").getByText("Baja")).toBeInTheDocument();
    expect(fila("Salud oral").getByText("Bajo la meta")).toBeInTheDocument();
    expect(fila("Nutrición").getByText("Sin datos suficientes")).toBeInTheDocument();
    // Estado frente a la meta con ícono además del texto
    expect(fila("Psicosocial").getByTestId("icono-meta-sobre")).toBeInTheDocument();
    expect(fila("Salud oral").getByTestId("icono-meta-bajo")).toBeInTheDocument();
  });

  it("compacta: áreas ordenadas por proyección descendente (sin datos al final)", () => {
    render(
      <PanelProyeccion
        areas={[serie("Salud oral", 0.08, "baja"), serie("Nutrición", null), serie("Psicosocial", 0.16), serie("Medicina", 0.12)]}
        servicios={[]}
        siguiente={SIGUIENTE}
        meta={0.1}
        minPeriodos={3}
        periodosCargados={4}
      />
    );
    const filas = within(screen.getByRole("table", { name: "Proyección por área" })).getAllByRole("row").slice(1);
    expect(filas.map((f) => within(f).getByRole("rowheader").textContent)).toEqual(["Psicosocial", "Medicina", "Salud oral", "Nutrición"]);
  });

  it("las gráficas y los servicios aparecen al expandir", () => {
    render(
      <PanelProyeccion
        areas={[serie("Psicosocial", 0.16), serie("Nutrición", null)]}
        servicios={[{ ...serie("890", 0.2), nombre: "PSICOLOGIA", area: "Psicosocial" }]}
        siguiente={SIGUIENTE}
        meta={0.1}
        minPeriodos={3}
        periodosCargados={4}
      />
    );
    const boton = screen.getByRole("button", { name: /Ver gráficas y servicios/ });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /PSICOLOGIA/ })).not.toBeInTheDocument();
    fireEvent.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    // Una gráfica por área con proyección
    expect(screen.getByRole("img", { name: "Proyección de inasistencia: Psicosocial" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Nutrición/ })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /PSICOLOGIA/ })).toHaveTextContent("20,0 %");
  });

  it("con menos periodos que el mínimo explica por qué no hay proyección", () => {
    render(
      <PanelProyeccion areas={[serie("Psicosocial", null)]} servicios={[]} siguiente={SIGUIENTE} meta={0.1} minPeriodos={3} periodosCargados={2} />
    );
    expect(screen.getByText(/Hay 2 periodos cargados; la proyección necesita al menos 3/)).toBeInTheDocument();
  });

});

/* ── PanelPrioridades ── */

const prioridad = (extra: Partial<Prioridad>): Prioridad => ({
  id: "inasistencia|Psicosocial",
  tipo: "inasistencia_area",
  area: "Psicosocial",
  titular: "Psicosocial: 2 servicios con inasistencia sostenida sobre 20 % — PSICOLOGIA (36 %) y TRABAJO SOCIAL (31 %)",
  citas: 1234,
  referencia: "por encima de la meta del 10 %",
  profesionales: 2.46,
  revisar: "Revisar recordatorios y sobreagenda en Psicosocial",
  enlace: "/dashboard/productividad?periodo=202610&area=Psicosocial",
  detalle: [
    { nombre: "PSICOLOGIA", texto: "36,0 % · 80 citas de más", enlace: "/dashboard/productividad?periodo=202610&area=Psicosocial&servicio=890" },
  ],
  novedad: "nuevo",
  citas_anterior: null,
  ...extra,
});

describe("PanelPrioridades", () => {
  it("cada prioridad: titular, impacto en citas y profesionales, novedad con ícono, qué revisar y enlace", () => {
    render(<PanelPrioridades prioridades={[prioridad({})]} impactoMinimo={50} veProductividad />);
    expect(screen.getByRole("heading", { name: "Prioridades" })).toBeInTheDocument();
    const item = within(screen.getAllByRole("listitem")[0]);
    expect(item.getByText(/Psicosocial: 2 servicios con inasistencia sostenida/)).toBeInTheDocument();
    expect(item.getByText("≈ 1.234 citas por encima de la meta del 10 %")).toBeInTheDocument();
    expect(item.getByText("≈ 2,5 profesionales equivalentes")).toBeInTheDocument();
    expect(item.getByText("Nuevo")).toBeInTheDocument();
    expect(item.getByTestId("icono-novedad")).toBeInTheDocument();
    expect(item.getByText("Revisar recordatorios y sobreagenda en Psicosocial")).toBeInTheDocument();
    expect(item.getByRole("link", { name: "Ver en Productividad" })).toHaveAttribute("href", prioridad({}).enlace);
  });

  it("Empeora muestra el impacto anterior; Persiste también se distingue", () => {
    render(
      <PanelPrioridades
        prioridades={[prioridad({ novedad: "empeora", citas_anterior: 900 }), prioridad({ id: "x", novedad: "persiste", citas_anterior: 1200 })]}
        impactoMinimo={50}
        veProductividad
      />
    );
    const [a, b] = screen.getAllByRole("listitem").filter((li) => li.closest("ul")?.getAttribute("aria-label") === "Prioridades");
    expect(within(a).getByText("Empeora")).toBeInTheDocument();
    expect(within(a).getByText(/antes 900/)).toBeInTheDocument();
    expect(within(b).getByText("Persiste")).toBeInTheDocument();
  });

  it("el detalle se despliega con sus enlaces", () => {
    render(<PanelPrioridades prioridades={[prioridad({})]} impactoMinimo={50} veProductividad />);
    const boton = screen.getByRole("button", { name: /Ver detalle/ });
    expect(screen.queryByText("36,0 % · 80 citas de más")).not.toBeInTheDocument();
    fireEvent.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("36,0 % · 80 citas de más")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver PSICOLOGIA en Productividad" })).toHaveAttribute("href", prioridad({}).detalle[0].enlace);
  });

  it("profesionales: el detalle enlaza a la ficha", () => {
    render(
      <PanelPrioridades
        prioridades={[
          prioridad({
            id: "profesionales",
            tipo: "profesionales",
            area: null,
            titular: "3 profesionales con inasistencia sobre 30 %",
            detalle: [{ nombre: "PROFESIONAL A", texto: "45,0 % · 30 citas de más", enlace: "/dashboard/productividad?periodo=202610&ficha=1" }],
          }),
        ]}
        impactoMinimo={50}
        veProductividad
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Ver detalle/ }));
    expect(screen.getByRole("link", { name: "Ver ficha de PROFESIONAL A" })).toHaveAttribute("href", "/dashboard/productividad?periodo=202610&ficha=1");
  });

  it("sin acceso a Productividad no muestra enlaces; sin profesionales equivalentes no los menciona", () => {
    render(<PanelPrioridades prioridades={[prioridad({ profesionales: null })]} impactoMinimo={50} veProductividad={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver detalle/ }));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/profesionales equivalentes/)).not.toBeInTheDocument();
  });

  it("sin prioridades: estado vacío positivo", () => {
    render(<PanelPrioridades prioridades={[]} impactoMinimo={50} veProductividad />);
    expect(screen.getByText("Sin prioridades: nada supera el impacto mínimo este periodo")).toBeInTheDocument();
    expect(screen.getByText(/50 citas/)).toBeInTheDocument();
  });
});

/* ── PanelReglas ── */

describe("PanelReglas", () => {
  it("sin permiso de edición es de solo lectura", () => {
    render(<PanelReglas reglas={REGLAS} editable={false} meta={0.1} onGuardar={jest.fn()} />);
    expect(screen.getByText(/Solo consulta/)).toBeInTheDocument();
    for (const s of screen.getAllByRole("switch")) expect(s).toBeDisabled();
    expect(screen.getByLabelText("Umbral (%): Inasistencia alta sostenida por servicio")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });

  it("muestra los valores en % y quién la cambió", () => {
    render(<PanelReglas reglas={REGLAS} editable meta={0.1} onGuardar={jest.fn()} />);
    expect(screen.getByLabelText("Umbral (%): Inasistencia alta sostenida por servicio")).toHaveValue(20);
    expect(screen.getByLabelText("Periodos consecutivos: Inasistencia alta sostenida por servicio")).toHaveValue(2);
    expect(screen.getByLabelText("Mínimo de citas: Inasistencia alta por profesional")).toHaveValue(50);
    expect(screen.getByLabelText("Umbral (%): Proyección por encima de la meta")).toHaveAttribute("placeholder", "Meta 10 %");
    expect(screen.getByText(/admin@ips\.local/)).toBeInTheDocument();
  });

  it("editar → Guardar pide confirmación y envía solo las reglas cambiadas (en fracción)", async () => {
    const onGuardar = jest.fn().mockResolvedValue(undefined);
    render(<PanelReglas reglas={REGLAS} editable meta={0.1} onGuardar={onGuardar} />);
    const guardar = screen.getByRole("button", { name: "Guardar" });
    expect(guardar).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Umbral (%): Inasistencia alta sostenida por servicio"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("switch", { name: "Activa: Citas sin asignar por servicio" }));
    expect(guardar).toBeEnabled();
    fireEvent.click(guardar);

    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveTextContent("2 reglas");
    await act(async () => {
      fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar cambios" }));
    });
    expect(onGuardar).toHaveBeenCalledWith([
      { clave: "inasistencia_servicio", activa: true, umbral: 0.25, periodos: 2, minimo: 30 },
      { clave: "disponibilidad_servicio", activa: false, umbral: 0.15, periodos: null, minimo: 30 },
    ]);
  });

  it("umbral vacío en la proyección se envía como null (usa la meta)", async () => {
    const onGuardar = jest.fn().mockResolvedValue(undefined);
    const reglas = REGLAS.map((r) => (r.clave === "proyeccion_sobre_meta" ? { ...r, umbral: 0.12 } : r));
    render(<PanelReglas reglas={reglas} editable meta={0.1} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText("Umbral (%): Proyección por encima de la meta"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    });
    expect(onGuardar).toHaveBeenCalledWith([{ clave: "proyeccion_sobre_meta", activa: true, umbral: null, periodos: null, minimo: null }]);
  });

  it("valores fuera de rango bloquean Guardar con un mensaje", () => {
    render(<PanelReglas reglas={REGLAS} editable meta={0.1} onGuardar={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Umbral (%): Inasistencia alta sostenida por servicio"), { target: { value: "120" } });
    expect(screen.getByText("El umbral debe estar entre 0 % y 100 %")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Periodos consecutivos: Inasistencia alta sostenida por servicio"), { target: { value: "7" } });
    expect(screen.getByText("Entre 1 y 6 periodos")).toBeInTheDocument();
  });

  it("Descartar vuelve a los valores guardados", () => {
    render(<PanelReglas reglas={REGLAS} editable meta={0.1} onGuardar={jest.fn()} />);
    const umbral = screen.getByLabelText("Umbral (%): Inasistencia alta sostenida por servicio");
    fireEvent.change(umbral, { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(umbral).toHaveValue(20);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("un error al guardar se muestra y conserva los cambios", async () => {
    const onGuardar = jest.fn().mockRejectedValue(new Error("Fila 1: el umbral debe estar entre 0 % y 100 %"));
    render(<PanelReglas reglas={REGLAS} editable meta={0.1} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText("Mínimo de citas: Inasistencia alta por profesional"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Fila 1: el umbral");
    expect(screen.getByLabelText("Mínimo de citas: Inasistencia alta por profesional")).toHaveValue(60);
  });
});
