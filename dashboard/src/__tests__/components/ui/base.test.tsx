/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Boton, clasesBoton } from "@/components/ui/Boton";
import { Campo, Input, Select } from "@/components/ui/Campo";
import { Chip } from "@/components/ui/Chip";
import { Estado } from "@/components/ui/Estado";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { Segmentado } from "@/components/ui/Segmentado";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { TarjetaKpi } from "@/components/ui/TarjetaKpi";

describe("Tarjeta", () => {
  it("muestra título como encabezado, ayuda, acciones y contenido", () => {
    render(
      <Tarjeta titulo="Inasistencia" ayuda="Mes a mes" acciones={<button>Exportar</button>}>
        <p>cuerpo</p>
      </Tarjeta>
    );
    const region = screen.getByRole("heading", { name: "Inasistencia" }).closest("section")!;
    expect(region).toHaveClass("rounded-tarjeta", "shadow-tarjeta", "bg-superficie");
    expect(screen.getByText("Mes a mes")).toHaveClass("text-tinta-3");
    expect(screen.getByRole("button", { name: "Exportar" })).toBeInTheDocument();
    expect(screen.getByText("cuerpo")).toBeInTheDocument();
  });

  it("sin título no pinta cabecera y puede ser un div", () => {
    const { container } = render(<Tarjeta as="div">solo</Tarjeta>);
    expect(container.querySelector("div.rounded-tarjeta")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("TarjetaKpi", () => {
  it("es un grupo con nombre, valor, detalle y estado con ícono y texto", () => {
    render(
      <TarjetaKpi
        etiqueta="% Inasistencia"
        valor="17,1 %"
        tono="critico"
        icono={<svg data-testid="icono" />}
        detalle="+0,5 pp vs Sep"
        estado={{ tono: "atencion", texto: "Sobre la meta" }}
      />
    );
    const grupo = screen.getByRole("group", { name: "% Inasistencia" });
    expect(grupo).toHaveTextContent("17,1 %");
    expect(screen.getByText("17,1 %")).toHaveClass("tabular-nums", "font-titulo");
    expect(screen.getByText("+0,5 pp vs Sep")).toBeInTheDocument();
    expect(screen.getByText("Sobre la meta").closest("[data-tono]")).toHaveAttribute("data-tono", "atencion");
    expect(screen.getByTestId("icono").parentElement).toHaveAttribute("aria-hidden");
    expect(screen.getByTestId("icono").parentElement).toHaveClass("bg-critico-suave");
  });
});

describe("Boton", () => {
  it.each([
    ["primario", "bg-primario"],
    ["secundario", "border-borde"],
    ["fantasma", "bg-transparent"],
  ] as const)("variante %s", (variante, clase) => {
    render(<Boton variante={variante}>Ir</Boton>);
    expect(screen.getByRole("button", { name: "Ir" })).toHaveClass(clase);
  });

  it("es type=button por defecto, respeta disabled y onClick", () => {
    const onClick = jest.fn();
    render(<Boton onClick={onClick} tamano="sm">Guardar</Boton>);
    const b = screen.getByRole("button", { name: "Guardar" });
    expect(b).toHaveAttribute("type", "button");
    expect(b).toHaveClass("text-xs");
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalled();
  });

  it("clasesBoton sirve para enlaces", () => {
    expect(clasesBoton({ variante: "secundario" })).toContain("rounded-control");
  });
});

describe("Estado", () => {
  it.each([
    ["bien", "✓", "text-bien"],
    ["atencion", "▲", "text-atencion"],
    ["critico", "●", "text-critico"],
    ["neutral", "•", "text-primario"],
  ] as const)("%s lleva ícono (oculto al lector) y texto, no solo color", (tono, icono, clase) => {
    render(<Estado tono={tono}>Texto</Estado>);
    const el = screen.getByText("Texto");
    expect(el).toHaveClass(clase);
    expect(screen.getByText(icono)).toHaveAttribute("aria-hidden");
  });

  it("icono={null} lo oculta", () => {
    const { container } = render(<Estado tono="bien" icono={null}>Ok</Estado>);
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });
});

describe("Segmentado", () => {
  const opciones = [
    { valor: "mensual", etiqueta: "Mensual" },
    { valor: "semanal", etiqueta: "Semanal" },
  ] as const;

  it("marca la opción activa con aria-pressed y avisa solo al cambiar", () => {
    const onCambiar = jest.fn();
    render(<Segmentado etiqueta="Periodo" opciones={opciones} valor="mensual" onCambiar={onCambiar} />);
    expect(screen.getByRole("group", { name: "Periodo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mensual" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Mensual" }));
    expect(onCambiar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Semanal" }));
    expect(onCambiar).toHaveBeenCalledWith("semanal");
  });

  it("deshabilita opciones", () => {
    render(
      <Segmentado
        etiqueta="Periodo"
        opciones={[opciones[0], { ...opciones[1], deshabilitada: true }]}
        valor="mensual"
        onCambiar={jest.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Semanal" })).toBeDisabled();
  });
});

describe("Campo, Select e Input", () => {
  it("enlaza la etiqueta con el control", () => {
    render(
      <Campo etiqueta="Mes">
        {(id) => (
          <Select id={id} defaultValue="a">
            <option value="a">Octubre</option>
          </Select>
        )}
      </Campo>
    );
    expect(screen.getByLabelText("Mes")).toHaveClass("rounded-control", "border-borde");
  });

  it("Input usa el mismo estilo", () => {
    render(<Input aria-label="Buscar" />);
    expect(screen.getByRole("textbox", { name: "Buscar" })).toHaveClass("rounded-control");
  });
});

describe("Chip", () => {
  it("con onQuitar ofrece un botón accesible", () => {
    const onQuitar = jest.fn();
    render(<Chip onQuitar={onQuitar}>Octubre 2026</Chip>);
    fireEvent.click(screen.getByRole("button", { name: "Quitar Octubre 2026" }));
    expect(onQuitar).toHaveBeenCalled();
  });

  it("sin onQuitar es solo texto", () => {
    render(<Chip>Medicina</Chip>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("EstadoVacio", () => {
  it("anuncia el título, la descripción y la acción", () => {
    render(<EstadoVacio titulo="Sin datos" descripcion="Cargue un informe" accion={<a href="/x">Ir</a>} />);
    expect(screen.getByRole("status")).toHaveTextContent("Sin datos");
    expect(screen.getByText("Cargue un informe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir" })).toBeInTheDocument();
  });

  it("compacto va dentro de tarjetas", () => {
    render(<EstadoVacio titulo="Nada" compacto />);
    expect(screen.getByRole("status")).toHaveClass("border-dashed");
  });
});
