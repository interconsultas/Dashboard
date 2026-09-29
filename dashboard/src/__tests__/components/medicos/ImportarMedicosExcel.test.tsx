/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ImportarMedicosExcel } from "@/components/medicos/ImportarMedicosExcel";

function archivo(nombre = "BD profesionales TXT.xlsx") {
  return new File(["contenido"], nombre, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("ImportarMedicosExcel", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("muestra el resultado y llama onImportado cuando la importación es exitosa", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ filas_procesadas: 10, registros_en_bd: 10, errores: 0 }),
    });
    const onImportado = jest.fn();
    render(<ImportarMedicosExcel onImportado={onImportado} />);

    const input = screen.getByLabelText(/importar excel/i, { selector: "input" }) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [archivo()] } });

    await waitFor(() => {
      expect(screen.getByText(/10 filas procesadas/i)).toBeInTheDocument();
    });
    expect(onImportado).toHaveBeenCalledTimes(1);

    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/admin/medicos/importar");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeInstanceOf(FormData);
  });

  it("muestra el error del servidor y no llama onImportado si falla", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Columnas faltantes: [...]" }),
    });
    const onImportado = jest.fn();
    render(<ImportarMedicosExcel onImportado={onImportado} />);

    const input = screen.getByLabelText(/importar excel/i, { selector: "input" }) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [archivo()] } });

    await waitFor(() => {
      expect(screen.getByText("Columnas faltantes: [...]")).toBeInTheDocument();
    });
    expect(onImportado).not.toHaveBeenCalled();
  });

  it("no hace nada si no se selecciona ningún archivo", () => {
    render(<ImportarMedicosExcel onImportado={jest.fn()} />);
    const input = screen.getByLabelText(/importar excel/i, { selector: "input" }) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [] } });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
