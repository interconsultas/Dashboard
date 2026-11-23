/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// @react-pdf es ESM y dibuja en un PDF: aquí sus primitivas se vuelven DOM para leer la estructura
jest.mock("@react-pdf/renderer", () => {
  const R = jest.requireActual("react") as typeof React;
  const marcar = (tag: string, nombre: string) =>
    function Primitiva({ children, fixed, wrap, render: pintar, style: _s, src, break: salto, ...resto }: Record<string, unknown>) {
      const props: Record<string, unknown> = {
        "data-pdf": nombre,
        "data-fixed": fixed ? "si" : undefined,
        "data-wrap": wrap === false ? "no" : undefined,
        "data-salto": salto ? "si" : undefined,
        src,
      };
      for (const k of ["title", "author"]) if (resto[k]) props[`data-${k}`] = resto[k];
      const contenido = typeof pintar === "function" ? pintar({ pageNumber: 1, totalPages: 3 }) : children;
      return R.createElement(tag, props, contenido as React.ReactNode);
    };
  return {
    Document: marcar("div", "documento"),
    Page: marcar("section", "pagina"),
    View: marcar("div", "vista"),
    Text: marcar("span", "texto"),
    Image: marcar("img", "imagen"),
    StyleSheet: { create: (x: object) => x },
    Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
  };
});

import { DocumentoInforme } from "@/components/informes/pdf/Documentos";
import { informeFicha, informeMensual, informeVista } from "@/lib/informes/construir";
import { contenidoPdf } from "@/lib/informes/documentosPdf";
import { FILTROS_VACIOS } from "@/lib/productividad/filtros";
import { ALERTAS, FICHA, PRODUCTIVIDAD } from "@/test-utils/informes";

const AHORA = new Date("2026-11-18T15:32:00Z");
const LOGO = "http://localhost/logo.png";

function pintar(modelo: Parameters<typeof contenidoPdf>[0], imagenes = {}) {
  return render(<DocumentoInforme contenido={contenidoPdf(modelo)} imagenes={imagenes} logo={LOGO} />);
}

describe("DocumentoVista", () => {
  const vista = informeVista(PRODUCTIVIDAD, { ...FILTROS_VACIOS, periodo: "202610" }, AHORA);

  it("banda con logo y periodo, pie con la marca y la página X de Y en cada página", () => {
    const { container } = pintar(vista, { tendencia: "data:image/png;base64,T", embudo: "data:image/png;base64,E" });
    expect(container.querySelector('[data-pdf="documento"]')).toHaveAttribute("data-title", "Productividad de la agenda — Octubre 2026");
    expect(container.querySelector(`img[src="${LOGO}"]`)).toBeInTheDocument();
    const fijos = Array.from(container.querySelectorAll('[data-fixed="si"]')).map((n) => n.textContent);
    expect(fijos).toEqual(expect.arrayContaining([expect.stringContaining("Octubre 2026")]));
    expect(screen.getByText("IPS Interconsultas · Productividad")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(screen.getByText("Generado el 18/11/2026, 10:32")).toBeInTheDocument();
  });

  it("indicadores con variación y semáforo en texto, y las gráficas como imagen", () => {
    const { container } = pintar(vista, { tendencia: "data:image/png;base64,T", embudo: "data:image/png;base64,E" });
    expect(screen.getAllByText("Citas asignadas").length).toBeGreaterThan(0);
    expect(screen.getByText(/↑ 14,3 %/)).toBeInTheDocument();
    expect(screen.getAllByText("Muy alto").length).toBeGreaterThan(0);
    expect(container.querySelector('img[src="data:image/png;base64,T"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="data:image/png;base64,E"]')).toBeInTheDocument();
  });

  it("tablas en página nueva con encabezado repetido, filas que no se parten y totales", () => {
    const { container } = pintar(vista);
    expect(screen.getByText("Por área").closest('[data-salto="si"]')).toBeInTheDocument();
    const encabezados = Array.from(container.querySelectorAll('[data-fixed="si"]')).filter((n) => n.textContent?.includes("% inasistencia"));
    expect(encabezados).toHaveLength(3);
    const filaMg = screen.getAllByText("Medicina general")[0].closest('[data-wrap="no"]') as HTMLElement;
    expect(within(filaMg).getByText(/20,0 %/)).toBeInTheDocument();
    expect(within(filaMg).getByText("Crítico")).toBeInTheDocument();
    expect(screen.getAllByText("Total").length).toBe(3);
    expect(screen.getByText("Profesionales con más citas asignadas")).toBeInTheDocument();
  });

  it("sin imagen de una gráfica lo dice en lugar de fallar", () => {
    pintar(vista);
    expect(screen.getAllByText("Gráfica no disponible.")).toHaveLength(2);
  });
});

describe("DocumentoMensual", () => {
  it("portada con el periodo y página de prioridades y proyección si se ve Inteligencia", () => {
    const { container } = pintar(informeMensual(PRODUCTIVIDAD, ALERTAS, AHORA));
    expect(container.querySelectorAll('[data-pdf="pagina"]')).toHaveLength(2);
    expect(screen.getByText("Informe para gerencia y líderes")).toBeInTheDocument();
    expect(screen.getByText("Prioridades")).toBeInTheDocument();
    expect(screen.getByText("Proyección")).toBeInTheDocument();
    expect(screen.getByText("Ranking de profesionales por citas inasistidas")).toBeInTheDocument();
  });

  it("sin Inteligencia avisa que se omitieron", () => {
    pintar(informeMensual(PRODUCTIVIDAD, null, AHORA));
    expect(screen.queryByText("Prioridades")).not.toBeInTheDocument();
    expect(screen.getByText("Prioridades y proyección omitidas: requieren acceso a Inteligencia.")).toBeInTheDocument();
  });
});

describe("DocumentoFicha", () => {
  it("indicadores del profesional, percentil, gráficas y tablas de servicios y tendencia", () => {
    pintar(informeFicha(FICHA, AHORA), { servicios: "data:s", tendencia: "data:t" });
    // En la banda y como título de la primera página
    expect(screen.getAllByText("Ficha del profesional")).toHaveLength(2);
    expect(screen.getByText("Percentil (mejor que el % de pares)")).toBeInTheDocument();
    expect(screen.getByText("Servicios que atiende")).toBeInTheDocument();
    expect(screen.getByText("Servicios")).toBeInTheDocument();
    expect(screen.getByText("Tendencia")).toBeInTheDocument();
  });
});
