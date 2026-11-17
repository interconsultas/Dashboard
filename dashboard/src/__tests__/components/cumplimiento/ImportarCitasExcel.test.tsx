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
  sin_cedula: [],
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
  fireEvent.change(screen.getByLabelText("Importar informe"), { target: { files: [file] } });
}

describe("ImportarCitasExcel", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("muestra el selector de archivo limitado a .xlsx y .xls", () => {
    renderImportar();

    const input = screen.getByLabelText("Importar informe");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", ".xlsx,.xls");
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
    expect(await screen.findByText("Importar informe")).toBeInTheDocument();
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
    expect(screen.queryByText(/sin cédula/i)).not.toBeInTheDocument();
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

  it("avisa cuántos profesionales no tienen programa y enlaza al mapeo por especialidad", async () => {
    responder({ ...RESULTADO, sin_programa: 4 });
    renderImportar();

    seleccionarArchivo();

    const nota = (await screen.findByText(/4 profesionales cargados no tienen programa/i))
      .closest("p") as HTMLElement;
    expect(within(nota).getByRole("link", { name: "Asignar la meta por especialidad" })).toHaveAttribute(
      "href",
      "/admin/metas/programas"
    );
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

  it("lista las filas sin cédula que no se cargaron con número de fila y nombre", async () => {
    responder({
      ...RESULTADO,
      sin_cedula: [
        { fila: 50, nombre: "PEREZ JUAN" },
        { fila: 92, nombre: "GOMEZ ANA" },
      ],
    });
    renderImportar();

    seleccionarArchivo();

    const aviso = (await screen.findByText(/2 filas del archivo no tienen cédula/i))
      .closest("div") as HTMLElement;
    expect(aviso).toHaveTextContent(/columna ID/);
    expect(aviso).toHaveTextContent(/no se cargaron/);
    const items = within(aviso).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Fila 50 — PEREZ JUAN");
    expect(items[1]).toHaveTextContent("Fila 92 — GOMEZ ANA");
  });

  it("usa el singular cuando hay una sola fila sin cédula", async () => {
    responder({ ...RESULTADO, sin_cedula: [{ fila: 7, nombre: "PEREZ JUAN" }] });
    renderImportar();

    seleccionarArchivo();

    expect(
      await screen.findByText(/1 fila del archivo no tiene cédula/i)
    ).toBeInTheDocument();
  });

  it("tolera un resultado sin la lista de filas sin cédula", async () => {
    const { sin_cedula: _omitido, ...anterior } = RESULTADO;
    responder(anterior);
    renderImportar();

    seleccionarArchivo();

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.queryByText(/sin cédula|no tienen? cédula/i)).not.toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText("Importar informe"), { target: { files: [] } });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  describe("informe detallado por profesional", () => {
    const DETALLADO = {
      formato: "detallado",
      periodo: 202610,
      fecha_inicial: "2026-10-01",
      fecha_final: "2026-10-31",
      granularidad: "mensual",
      filas: 1007,
      registros: 990,
      filas_agrupadas: 17,
      profesionales: 174,
      servicios: 83,
      servicios_nuevos: [],
      citas_atendidas: 78,
      periodos: [202610],
      sin_catalogo: [],
      sin_programa: 0,
      advertencias: [],
    };

    it("muestra el rango, la granularidad y los totales del informe", async () => {
      responder(DETALLADO);
      const { onImportado } = renderImportar();

      seleccionarArchivo(archivo("INFORME DETALLADO POR PROFESIONAL.xls"));

      const resumen = await screen.findByRole("status");
      expect(resumen).toHaveTextContent("01/10/2026 – 31/10/2026 (mensual)");
      expect(resumen).toHaveTextContent("1007 filas");
      expect(resumen).toHaveTextContent("174 profesionales");
      expect(resumen).toHaveTextContent("83 servicios");
      expect(resumen).toHaveTextContent("17 filas repetidas se sumaron");
      expect(resumen).toHaveTextContent("Citas atendidas de Oct 2026 actualizadas para 78 profesionales");
      expect(onImportado).toHaveBeenCalledWith([202610]);
      expect(screen.queryByText(/servicios? nuevos?/i)).not.toBeInTheDocument();
    });

    it("aclara que una carga semanal no modifica las citas atendidas", async () => {
      responder({
        ...DETALLADO,
        fecha_final: "2026-10-07",
        granularidad: "semanal",
        filas_agrupadas: 0,
        citas_atendidas: 0,
        periodos: [],
      });
      const { onImportado } = renderImportar();

      seleccionarArchivo(archivo("detallado.xls"));

      const resumen = await screen.findByRole("status");
      expect(resumen).toHaveTextContent("01/10/2026 – 07/10/2026 (semanal)");
      expect(resumen).toHaveTextContent(/no modifican las citas atendidas/i);
      expect(resumen).not.toHaveTextContent(/repetidas/i);
      expect(onImportado).toHaveBeenCalledWith([]);
    });

    it("informa los servicios nuevos con un conteo y la lista colapsada, sin estilo de advertencia", async () => {
      responder({
        ...DETALLADO,
        servicios_nuevos: [
          { codigo: "50110", nombre: "CONSULTA MEDICINA GENERAL" },
          { codigo: "50120", nombre: "CONSULTA PEDIATRIA" },
        ],
      });
      renderImportar();

      seleccionarArchivo(archivo("detallado.xls"));

      const aviso = (await screen.findByText("2 servicios nuevos en el catálogo"))
        .closest("[data-aviso]") as HTMLElement;
      expect(aviso).toHaveAttribute("data-aviso", "info");
      expect(aviso).not.toHaveClass("bg-amber-50");
      const items = within(aviso).getAllByRole("listitem");
      expect(items[0]).toHaveTextContent("50110 — CONSULTA MEDICINA GENERAL");
      expect(items[0]).not.toBeVisible();
      expect(aviso.querySelector("details")).not.toHaveAttribute("open");
    });

    it("usa el singular cuando hay un solo servicio nuevo", async () => {
      responder({
        ...DETALLADO,
        servicios_nuevos: [{ codigo: "50110", nombre: "CONSULTA MEDICINA GENERAL" }],
      });
      renderImportar();

      seleccionarArchivo(archivo("detallado.xls"));

      expect(await screen.findByText("1 servicio nuevo en el catálogo")).toBeInTheDocument();
    });

    it("explica que los profesionales fuera de Profesionales no se miden en cumplimiento, con la lista colapsada", async () => {
      responder({
        ...DETALLADO,
        sin_catalogo: [
          { documento: "2000002", nombre: "JUAN NUÑEZ" },
          { documento: "2000003", nombre: null },
        ],
      });
      renderImportar();

      seleccionarArchivo(archivo("detallado.xls"));

      const aviso = (
        await screen.findByText(
          "2 profesionales del informe no se miden en cumplimiento porque no están registrados en Profesionales"
        )
      ).closest("[data-aviso]") as HTMLElement;
      expect(aviso).toHaveAttribute("data-aviso", "info");
      expect(aviso).not.toHaveClass("bg-amber-50");
      expect(aviso).toHaveTextContent(/detalle .*tablero de citas/i);
      const items = within(aviso).getAllByRole("listitem");
      expect(items[0]).toHaveTextContent("JUAN NUÑEZ — cédula 2000002");
      expect(items[1]).toHaveTextContent("Cédula 2000003");
      expect(items[0]).not.toBeVisible();
      expect(within(aviso).getByRole("link", { name: "Profesionales" })).toHaveAttribute(
        "href",
        "/admin/medicos"
      );
    });

    it("usa el singular cuando un solo profesional no está registrado", async () => {
      responder({ ...DETALLADO, sin_catalogo: [{ documento: "2000002", nombre: "JUAN NUÑEZ" }] });
      renderImportar();

      seleccionarArchivo(archivo("detallado.xls"));

      expect(
        await screen.findByText(
          "1 profesional del informe no se mide en cumplimiento porque no está registrado en Profesionales"
        )
      ).toBeInTheDocument();
    });
  });
});
