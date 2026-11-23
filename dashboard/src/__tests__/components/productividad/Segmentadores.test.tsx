/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Segmentadores, type PropsSegmentadores } from "@/components/productividad/Segmentadores";
import { FILTROS_VACIOS } from "@/lib/productividad/filtros";
import { RESPUESTA } from "@/test-utils/productividad-fixtures";

function renderizar(props: Partial<PropsSegmentadores> = {}) {
  const handlers = {
    onGranularidad: jest.fn(),
    onPeriodo: jest.fn(),
    onArea: jest.fn(),
    onServicio: jest.fn(),
    onProfesional: jest.fn(),
    onLimpiar: jest.fn(),
  };
  render(
    <Segmentadores
      filtros={FILTROS_VACIOS}
      periodo="202610"
      periodos={RESPUESTA.periodos}
      opciones={RESPUESTA.opciones}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

describe("Segmentadores", () => {
  it("granularidad: Semanal deshabilitado con explicación cuando no hay cargas semanales", () => {
    renderizar();
    expect(screen.getByRole("button", { name: "Mensual" })).toHaveAttribute("aria-pressed", "true");
    const semanal = screen.getByRole("button", { name: "Semanal" });
    expect(semanal).toBeDisabled();
    expect(semanal).toHaveAttribute("title", expect.stringMatching(/semanal/i));
  });

  it("granularidad: Semanal habilitado y clicable cuando hay semanas", () => {
    const h = renderizar({
      periodos: { ...RESPUESTA.periodos, semanal: [{ clave: "2026-10-05", etiqueta: "5–11 oct", etiqueta_larga: "5–11 oct 2026", fecha_inicial: "2026-10-05", fecha_final: "2026-10-11" }] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Semanal" }));
    expect(h.onGranularidad).toHaveBeenCalledWith("semanal");
  });

  it("mes: lista los periodos del más reciente al más antiguo y selecciona el vigente", () => {
    const h = renderizar();
    const mes = screen.getByLabelText("Mes") as HTMLSelectElement;
    expect(within(mes).getAllByRole("option").map((o) => o.textContent)).toEqual(["Octubre 2026", "Septiembre 2026"]);
    expect(mes.value).toBe("202610");
    fireEvent.change(mes, { target: { value: "202609" } });
    expect(h.onPeriodo).toHaveBeenCalledWith("202609");
  });

  it("área: Todas + catálogo; elegir y volver a Todas", () => {
    const h = renderizar();
    const area = screen.getByLabelText("Área de servicio");
    fireEvent.change(area, { target: { value: "Salud oral" } });
    expect(h.onArea).toHaveBeenCalledWith("Salud oral");
    fireEvent.change(area, { target: { value: "" } });
    expect(h.onArea).toHaveBeenCalledWith(null);
  });

  it("servicio: las opciones se filtran por el área elegida", () => {
    renderizar({ filtros: { ...FILTROS_VACIOS, area: "Salud oral" } });
    const servicio = screen.getByLabelText("Servicio");
    expect(within(servicio).getAllByRole("option").map((o) => o.textContent)).toEqual(["Todos", "ODONTOLOGIA"]);
  });

  it("servicio: sin área muestra todos y elegir uno llama onServicio con el código", () => {
    const h = renderizar();
    const servicio = screen.getByLabelText("Servicio");
    expect(within(servicio).getAllByRole("option")).toHaveLength(4);
    fireEvent.change(servicio, { target: { value: "152" } });
    expect(h.onServicio).toHaveBeenCalledWith("152");
  });

  it("profesional: buscador con datalist; una opción exacta filtra por cédula", () => {
    const h = renderizar();
    const input = screen.getByLabelText("Profesional");
    expect(input).toHaveAttribute("list");
    expect(document.querySelectorAll("datalist option")).toHaveLength(2);
    fireEvent.change(input, { target: { value: "PROFESIONAL DOS · 2077" } });
    expect(h.onProfesional).toHaveBeenCalledWith("2077");
  });

  it("profesional: vaciar el buscador quita el filtro; texto parcial no filtra", () => {
    const h = renderizar({ filtros: { ...FILTROS_VACIOS, profesional: "1053" } });
    const input = screen.getByLabelText("Profesional");
    fireEvent.change(input, { target: { value: "PROF" } });
    expect(h.onProfesional).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "" } });
    expect(h.onProfesional).toHaveBeenCalledWith(null);
  });

  it("chips: periodo fijo y un chip con × por cada filtro activo", () => {
    const h = renderizar({
      filtros: { ...FILTROS_VACIOS, area: "Medicina general", servicio: "11", profesional: "1053" },
    });
    const chips = screen.getByRole("list", { name: "Filtros activos" });
    expect(within(chips).getByText("Octubre 2026")).toBeInTheDocument();
    expect(within(chips).getByText("Medicina general")).toBeInTheDocument();
    expect(within(chips).getByText("CONSULTA MEDICINA GENERAL")).toBeInTheDocument();
    expect(within(chips).getByText("PROFESIONAL UNO")).toBeInTheDocument();
    expect(within(chips).getAllByRole("button")).toHaveLength(3);

    fireEvent.click(within(chips).getByRole("button", { name: "Quitar Medicina general" }));
    expect(h.onArea).toHaveBeenCalledWith(null);
    fireEvent.click(within(chips).getByRole("button", { name: "Quitar CONSULTA MEDICINA GENERAL" }));
    expect(h.onServicio).toHaveBeenCalledWith(null);
    fireEvent.click(within(chips).getByRole("button", { name: "Quitar PROFESIONAL UNO" }));
    expect(h.onProfesional).toHaveBeenCalledWith(null);
  });

  it("Limpiar filtros", () => {
    const h = renderizar({ filtros: { ...FILTROS_VACIOS, area: "Salud oral" } });
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(h.onLimpiar).toHaveBeenCalled();
  });

  it("profesional: el chip ofrece Ver ficha sin abrirla al elegirlo", () => {
    const documento = RESPUESTA.opciones.profesionales[0].documento;
    const onVerFicha = jest.fn();
    renderizar({ filtros: { ...FILTROS_VACIOS, profesional: documento }, onVerFicha });
    expect(onVerFicha).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /ver ficha/i }));
    expect(onVerFicha).toHaveBeenCalledWith(documento);
  });

  it("sin profesional filtrado no hay botón Ver ficha", () => {
    renderizar({ onVerFicha: jest.fn() });
    expect(screen.queryByRole("button", { name: /ver ficha/i })).not.toBeInTheDocument();
  });
});
