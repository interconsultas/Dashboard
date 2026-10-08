/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CumplimientoContenido } from "@/components/cumplimiento/CumplimientoContenido";
import { construirCumplimiento, type EntradaCumplimiento } from "@/lib/cumplimiento/calcular";
import type { RespuestaCumplimiento } from "@/lib/cumplimiento/tipos";

const PEREZ = { documento: "10234567", nombre: "PEREZ JUAN" };
const GOMEZ = { documento: "30345678", nombre: "GOMEZ ANA" };

function entrada(
  base: { documento: string; nombre: string },
  periodo: number,
  citas: number,
  programa: string | null,
  ordenes: number
): EntradaCumplimiento {
  return { ...base, periodo, citas, programa, categoria: "medicamentos", ordenes };
}

function respuesta(
  entradas: EntradaCumplimiento[],
  extra: Partial<RespuestaCumplimiento> = {}
): RespuestaCumplimiento {
  const periodos = Array.from(new Set(entradas.map((e) => e.periodo))).sort();
  return {
    atribucion: "ordenador",
    periodos_disponibles: periodos,
    periodo_desde: periodos[0] ?? null,
    periodo_hasta: periodos[periodos.length - 1] ?? null,
    periodos,
    ...construirCumplimiento({
      entradas,
      metas: [{ anio: 2026, programa: "RCV", categoria: "medicamentos", valor: 2 }],
    }),
    ...extra,
  };
}

// PEREZ: ene 150% y feb 50% → 100%; GOMEZ: ene 200%
const DATOS = respuesta([
  entrada(PEREZ, 202601, 100, "RCV", 300),
  entrada(PEREZ, 202602, 100, "RCV", 100),
  entrada(GOMEZ, 202601, 100, "RCV", 400),
]);

describe("CumplimientoContenido", () => {
  describe("sin citas cargadas", () => {
    it("explica que primero se deben cargar las citas atendidas y enlaza a esa pantalla", () => {
      render(<CumplimientoContenido datos={respuesta([])} documento={null} onSeleccionar={jest.fn()} />);

      expect(screen.getByText("Aún no hay citas atendidas cargadas")).toBeInTheDocument();
      expect(screen.getByText(/cargue primero las citas atendidas/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Citas atendidas/ })).toHaveAttribute("href", "/admin/citas-atendidas");
      expect(screen.queryByText("Cumplimiento global")).not.toBeInTheDocument();
    });
  });

  describe("vista general", () => {
    it("muestra los tiles, la gráfica mensual y el ranking", () => {
      render(<CumplimientoContenido datos={DATOS} documento={null} onSeleccionar={jest.fn()} />);

      // Promedio simple de las 3 filas: (150 + 50 + 200) / 3
      expect(within(screen.getByTestId("tile-global")).getByText("133%")).toBeInTheDocument();
      expect(screen.getByText("Cumplimiento global por mes")).toBeInTheDocument();
      expect(screen.getByText("Ranking de profesionales")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Ver el detalle de PEREZ JUAN/ })).toBeInTheDocument();
      expect(screen.queryByText("Volver al ranking")).not.toBeInTheDocument();
    });

    it("al hacer clic en una fila del ranking selecciona a ese profesional", () => {
      const onSeleccionar = jest.fn();
      render(<CumplimientoContenido datos={DATOS} documento={null} onSeleccionar={onSeleccionar} />);

      fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de GOMEZ ANA/ }));

      expect(onSeleccionar).toHaveBeenCalledWith("30345678");
    });

    it("indica cómo se atribuyen las órdenes: médico ordenador", () => {
      render(<CumplimientoContenido datos={DATOS} documento={null} onSeleccionar={jest.fn()} />);

      expect(screen.getByText("Órdenes atribuidas al médico ordenador")).toBeInTheDocument();
    });

    it("indica cómo se atribuyen las órdenes: usuario que digitó", () => {
      render(
        <CumplimientoContenido
          datos={{ ...DATOS, atribucion: "digitador" }}
          documento={null}
          onSeleccionar={jest.fn()}
        />
      );

      expect(screen.getByText("Órdenes atribuidas al usuario que digitó")).toBeInTheDocument();
    });

    it("avisa cuando hay profesionales con citas y sin programa, con enlace a Citas atendidas", () => {
      const datos = respuesta([
        entrada(PEREZ, 202601, 100, "RCV", 300),
        entrada(GOMEZ, 202601, 100, null, 400),
      ]);
      render(<CumplimientoContenido datos={datos} documento={null} onSeleccionar={jest.fn()} />);

      const aviso = screen.getByRole("note");
      expect(aviso).toHaveTextContent("1 profesional del listado tiene citas atendidas pero no tiene programa asignado");
      expect(aviso).toHaveTextContent(/sin programa no hay meta/i);
      expect(within(aviso).getByRole("link", { name: "Asignar el programa en Profesionales" })).toHaveAttribute(
        "href",
        "/admin/medicos"
      );
    });

    it("no muestra el aviso cuando todos tienen programa", () => {
      render(<CumplimientoContenido datos={DATOS} documento={null} onSeleccionar={jest.fn()} />);

      expect(screen.queryByRole("note")).not.toBeInTheDocument();
    });

    it("con citas cargadas pero sin filas para los filtros lo indica sin mostrar el estado de carga inicial", () => {
      const datos = respuesta([], { periodos_disponibles: [202601] });
      render(<CumplimientoContenido datos={datos} documento={null} onSeleccionar={jest.fn()} />);

      expect(screen.queryByText("Aún no hay citas atendidas cargadas")).not.toBeInTheDocument();
      expect(screen.getByText("Sin profesionales para los filtros seleccionados")).toBeInTheDocument();
    });
  });

  describe("vista de un profesional", () => {
    it("muestra el encabezado con nombre, cédula y programa", () => {
      render(<CumplimientoContenido datos={DATOS} documento="10234567" onSeleccionar={jest.fn()} />);

      const encabezado = screen.getByTestId("encabezado-profesional");
      expect(within(encabezado).getByRole("heading", { name: "PEREZ JUAN" })).toBeInTheDocument();
      expect(within(encabezado).getByText(/10234567/)).toBeInTheDocument();
      expect(within(encabezado).getByText("RCV")).toBeInTheDocument();
    });

    it("muestra los tiles del profesional, no los del total", () => {
      render(<CumplimientoContenido datos={DATOS} documento="10234567" onSeleccionar={jest.fn()} />);

      // Promedio simple de sus 2 meses: (150 + 50) / 2
      expect(within(screen.getByTestId("tile-global")).getByText("100%")).toBeInTheDocument();
    });

    it("muestra una tendencia por cada una de las 7 categorías y el historial mes a mes", () => {
      render(<CumplimientoContenido datos={DATOS} documento="10234567" onSeleccionar={jest.fn()} />);

      expect(screen.getAllByTestId("tendencia-indicador")).toHaveLength(7);
      expect(screen.getByText("Historial mes a mes")).toBeInTheDocument();
      expect(screen.getAllByRole("rowheader", { name: "Ene 2026" }).length).toBeGreaterThan(0);
      expect(screen.queryByText("Ranking de profesionales")).not.toBeInTheDocument();
    });

    it("avisa cuando el profesional tiene citas en periodos sin programa", () => {
      const datos = respuesta([
        entrada(PEREZ, 202601, 100, "RCV", 300),
        entrada(PEREZ, 202602, 100, null, 100),
      ]);
      render(<CumplimientoContenido datos={datos} documento="10234567" onSeleccionar={jest.fn()} />);

      const aviso = screen.getByRole("note");
      expect(aviso).toHaveTextContent(/sin programa no hay meta/i);
      expect(within(aviso).getByRole("link", { name: "Asignar el programa en Profesionales" })).toHaveAttribute(
        "href",
        "/admin/medicos"
      );
    });

    it("'Volver al ranking' limpia la selección", () => {
      const onSeleccionar = jest.fn();
      render(<CumplimientoContenido datos={DATOS} documento="10234567" onSeleccionar={onSeleccionar} />);

      fireEvent.click(screen.getByRole("button", { name: "Volver al ranking" }));

      expect(onSeleccionar).toHaveBeenCalledWith(null);
    });

    it("si el profesional no está en los datos filtrados lo indica y permite volver", () => {
      const onSeleccionar = jest.fn();
      render(<CumplimientoContenido datos={DATOS} documento="999" onSeleccionar={onSeleccionar} />);

      expect(screen.getByText(/no tiene citas atendidas en el rango y los programas seleccionados/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Volver al ranking" }));
      expect(onSeleccionar).toHaveBeenCalledWith(null);
    });
  });
});
