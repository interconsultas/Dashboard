/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TablaCitasPeriodo } from "@/components/citas/TablaCitasPeriodo";
import { agruparDetalle, type DetalleCitas, type FilaServicioDb } from "@/lib/citas/detalle";

function fila(
  documento: string,
  nombre: string,
  codigo: string,
  servicio: string,
  creadas: number
): FilaServicioDb {
  return {
    tipo_documento: "CC", documento, nombre, codigo_servicio: codigo, nombre_servicio: servicio,
    creadas, bloqueadas: 0, ofertadas: 2, disponibles: 3, asignadas: 4, confirmadas: 5,
    confirmadas_sin_atencion: 6, inasistidas: 7, canceladas: 8, pendientes_por_asistir: 9,
  };
}

function detalle(filas: FilaServicioDb[], periodos = [202610], periodo = 202610): DetalleCitas {
  return { periodo, periodos, ...agruparDetalle(filas) };
}

const DETALLE = detalle([
  fila("10234567", "PEREZ JUAN", "890201", "CONSULTA GENERAL", 1200),
  fila("10234567", "PEREZ JUAN", "890301", "CONTROL CRONICOS", 300),
  fila("30345678", "GÓMEZ ANA", "890201", "CONSULTA GENERAL", 50),
]);

function filasCuerpo() {
  const [, cuerpo] = screen.getAllByRole("rowgroup");
  return within(cuerpo).getAllByRole("row");
}

describe("TablaCitasPeriodo", () => {
  it("muestra una fila por profesional con cédula, servicios y métricas en formato es-CO", () => {
    render(<TablaCitasPeriodo detalle={DETALLE} onIrAPeriodo={jest.fn()} />);

    const perez = screen.getByText("PEREZ JUAN").closest("tr")!;
    expect(within(perez).getByText("CC 10234567")).toBeInTheDocument();
    expect(within(perez).getByText("1.500")).toBeInTheDocument();
    expect(within(perez).getByText("2")).toBeInTheDocument();
    expect(screen.getByText("GÓMEZ ANA")).toBeInTheDocument();
    for (const h of ["Profesional", "Servicios", "Creadas", "Bloqueadas", "Ofertadas", "Disponibles", "Asignadas", "Confirmadas", "Inasistidas", "Canceladas"]) {
      expect(screen.getByRole("columnheader", { name: new RegExp(`^${h}`) })).toBeInTheDocument();
    }
  });

  it("muestra la fila de totales del periodo", () => {
    render(<TablaCitasPeriodo detalle={DETALLE} onIrAPeriodo={jest.fn()} />);

    const totales = screen.getByText("Total (2 profesionales)").closest("tr")!;
    expect(within(totales).getByText("1.550")).toBeInTheDocument();
    expect(within(totales).getByText("21")).toBeInTheDocument(); // inasistidas: 7 × 3 servicios
  });

  it("despliega el desglose por servicio con confirmadas sin atención y pendientes", () => {
    render(<TablaCitasPeriodo detalle={DETALLE} onIrAPeriodo={jest.fn()} />);

    expect(screen.queryByText("CONTROL CRONICOS")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver servicios de PEREZ JUAN" }));

    expect(screen.getByText("CONTROL CRONICOS")).toBeInTheDocument();
    expect(screen.getByText("890301")).toBeInTheDocument();
    expect(screen.getAllByText("Confirmadas sin atención").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pendientes por asistir").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Ocultar servicios de PEREZ JUAN" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("busca por nombre sin tildes y por cédula", () => {
    render(<TablaCitasPeriodo detalle={DETALLE} onIrAPeriodo={jest.fn()} />);
    const buscador = screen.getByPlaceholderText("Buscar por nombre o cédula…");

    fireEvent.change(buscador, { target: { value: "gomez" } });
    expect(screen.getByText("GÓMEZ ANA")).toBeInTheDocument();
    expect(screen.queryByText("PEREZ JUAN")).not.toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: "102345" } });
    expect(screen.getByText("PEREZ JUAN")).toBeInTheDocument();
    expect(screen.queryByText("GÓMEZ ANA")).not.toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: "zzz" } });
    expect(screen.getByText("Sin resultados para esa búsqueda")).toBeInTheDocument();
  });

  it("ordena por una columna al hacer clic en su encabezado", () => {
    render(<TablaCitasPeriodo detalle={DETALLE} onIrAPeriodo={jest.fn()} />);

    // Por defecto, más citas creadas primero
    expect(within(filasCuerpo()[0]).getByText("PEREZ JUAN")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Profesional/ }));
    expect(within(filasCuerpo()[0]).getByText("GÓMEZ ANA")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Profesional/ }));
    expect(within(filasCuerpo()[0]).getByText("PEREZ JUAN")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando el mes no tiene informe mensual cargado", () => {
    const onIrAPeriodo = jest.fn();
    render(<TablaCitasPeriodo detalle={detalle([], [202610, 202609], 202611)} onIrAPeriodo={onIrAPeriodo} />);

    expect(screen.getByText("No hay informe cargado para este mes")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ver el último informe cargado/ }));
    expect(onIrAPeriodo).toHaveBeenCalledWith(202610);
  });

  it("no ofrece ir a otro mes si no hay ningún informe mensual cargado", () => {
    render(<TablaCitasPeriodo detalle={detalle([], [], 202611)} onIrAPeriodo={jest.fn()} />);

    expect(screen.getByText("No hay informe cargado para este mes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /último informe/ })).not.toBeInTheDocument();
  });
});
