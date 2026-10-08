/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ImportarCitasExcel } from "@/components/cumplimiento/ImportarCitasExcel";

const RESULTADO = {
  registros: 486,
  periodos: [202601, 202602, 202603],
  profesionales: 81,
  sin_catalogo: [],
  sin_programa: 0,
  advertencias: [],
};

const mockFetch = jest.fn();

function responder(body: unknown, ok = true) {
  mockFetch.mockResolvedValue({ ok, json: async () => body });
}

function archivo(nombre = "citas.xlsx") {
  return new File([new Uint8Array(10)], nombre);
}

function renderImportar() {
  const onImportado = jest.fn();
  render(<ImportarCitasExcel onImportado={onImportado} />);
  return { onImportado };
}

function seleccionarArchivo(file = archivo()) {
  fireEvent.change(screen.getByLabelText("Importar Excel"), { target: { files: [file] } });
}

describe("ImportarCitasExcel", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("muestra el selector de archivo limitado a .xlsx", () => {
    renderImportar();

    const input = screen.getByLabelText("Importar Excel");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", ".xlsx");
  });

  it("envía el archivo en el campo «archivo» al endpoint de importación", async () => {
    responder(RESULTADO);
    renderImportar();
    const file = archivo();

    seleccionarArchivo(file);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/citas-atendidas/importar");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("archivo")).toBe(file);
  });

  it("indica el progreso y bloquea el selector mientras importa", async () => {
    let resolver: (v: unknown) => void = () => {};
    mockFetch.mockReturnValue(new Promise((r) => (resolver = r)));
    renderImportar();

    seleccionarArchivo();

    expect(await screen.findByText("Importando…")).toBeInTheDocument();
    expect(screen.getByLabelText("Importando…")).toBeDisabled();

    resolver({ ok: true, json: async () => RESULTADO });
    expect(await screen.findByText("Importar Excel")).toBeInTheDocument();
  });

  it("muestra el resumen con registros, periodos formateados y profesionales", async () => {
    responder(RESULTADO);
    const { onImportado } = renderImportar();

    seleccionarArchivo();

    const resumen = await screen.findByRole("status");
    expect(resumen).toHaveTextContent("486 registros cargados");
    expect(resumen).toHaveTextContent("81 profesionales");
    expect(resumen).toHaveTextContent("Ene 2026, Feb 2026, Mar 2026");
    expect(onImportado).toHaveBeenCalledWith([202601, 202602, 202603]);
    expect(screen.queryByText(/no están en el catálogo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin programa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/advertencia/i)).not.toBeInTheDocument();
  });

  it("usa el singular cuando se carga un solo registro de un solo profesional", async () => {
    responder({ ...RESULTADO, registros: 1, profesionales: 1, periodos: [202601] });
    renderImportar();

    seleccionarArchivo();

    const resumen = await screen.findByRole("status");
    expect(resumen).toHaveTextContent("1 registro cargado de 1 profesional");
  });

  it("lista los profesionales que no están en el catálogo con nombre y cédula", async () => {
    responder({
      ...RESULTADO,
      sin_catalogo: [
        { documento: "10234567", nombre: "PEREZ JUAN" },
        { documento: "30345678", nombre: null },
      ],
    });
    renderImportar();

    seleccionarArchivo();

    const aviso = (await screen.findByText(/no están en el catálogo/i)).closest("div") as HTMLElement;
    expect(aviso).toHaveTextContent("2 profesionales");
    expect(aviso).toHaveTextContent(/crearlos primero en Profesionales/i);
    const items = within(aviso).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("PEREZ JUAN — cédula 10234567");
    expect(items[1]).toHaveTextContent("Cédula 30345678");
    expect(within(aviso).getByRole("link", { name: "Profesionales" })).toHaveAttribute(
      "href",
      "/admin/medicos"
    );
  });

  it("avisa cuántos profesionales no tienen programa y enlaza a Profesionales", async () => {
    responder({ ...RESULTADO, sin_programa: 4 });
    renderImportar();

    seleccionarArchivo();

    const nota = (await screen.findByText(/4 profesionales cargados no tienen programa/i))
      .closest("p") as HTMLElement;
    expect(within(nota).getByRole("link")).toHaveAttribute("href", "/admin/medicos");
  });

  it("muestra las advertencias del archivo", async () => {
    responder({
      ...RESULTADO,
      advertencias: ["Fila 5 (cédula 11), periodo 202601: el valor «NA» no se cargó"],
    });
    renderImportar();

    seleccionarArchivo();

    expect(await screen.findByText("1 advertencia")).toBeInTheDocument();
    expect(screen.getByText(/Fila 5 \(cédula 11\)/)).toBeInTheDocument();
  });

  it("muestra el mensaje del API si la importación falla y no notifica al contenedor", async () => {
    responder({ error: "No se encontró la columna de cédula" }, false);
    const { onImportado } = renderImportar();

    seleccionarArchivo();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se encontró la columna de cédula"
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(onImportado).not.toHaveBeenCalled();
  });

  it("muestra un mensaje genérico si la solicitud no se puede completar", async () => {
    mockFetch.mockRejectedValue(new Error("network"));
    const { onImportado } = renderImportar();

    seleccionarArchivo();

    expect(await screen.findByRole("alert")).toHaveTextContent("Error al importar el archivo");
    expect(onImportado).not.toHaveBeenCalled();
  });

  it("no hace nada si no se selecciona ningún archivo", () => {
    renderImportar();

    fireEvent.change(screen.getByLabelText("Importar Excel"), { target: { files: [] } });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
