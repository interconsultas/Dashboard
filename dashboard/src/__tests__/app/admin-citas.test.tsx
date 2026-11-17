/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockRedirect = jest.fn();
jest.mock("next/navigation", () => ({ redirect: (url: string) => mockRedirect(url) }));

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...args: unknown[]) => mockUseSWR(...args) }));

// El importador real se prueba aparte; aquí basta con disparar una importación exitosa
jest.mock("@/components/cumplimiento/ImportarCitasExcel", () => ({
  ImportarCitasExcel: ({ onImportado }: { onImportado: (periodos: number[]) => void }) => (
    <button type="button" aria-label="Importar informe" onClick={() => onImportado([202610])}>
      Importar informe
    </button>
  ),
}));

import CitasPage from "@/app/admin/citas/page";
import type { DetalleCitas } from "@/lib/citas/detalle";
import CitasAtendidasRedirect from "@/app/admin/citas-atendidas/page";

describe("/admin/citas-atendidas", () => {
  it("redirige a /admin/citas", () => {
    CitasAtendidasRedirect();

    expect(mockRedirect).toHaveBeenCalledWith("/admin/citas");
  });
});

describe("/admin/citas", () => {
  const mutateAtendidas = jest.fn();
  const mutateDetalle = jest.fn();
  let detalle: DetalleCitas;

  beforeEach(() => {
    jest.clearAllMocks();
    detalle = {
      periodo: 202610,
      periodos: [],
      profesionales: [],
      totales: {
        profesionales: 0, creadas: 0, bloqueadas: 0, ofertadas: 0, disponibles: 0, asignadas: 0,
        confirmadas: 0, confirmadas_sin_atencion: 0, inasistidas: 0, canceladas: 0,
        pendientes_por_asistir: 0,
      },
    };
    mockUseSWR.mockImplementation((key: string) =>
      key.startsWith("/api/admin/citas/detalle")
        ? { data: detalle, error: undefined, isLoading: false, mutate: mutateDetalle }
        : { data: [], error: undefined, isLoading: false, mutate: mutateAtendidas }
    );
  });

  it("se titula Citas y describe la carga del informe y las citas para cumplimiento", () => {
    render(<CitasPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Citas" })).toBeInTheDocument();
    expect(
      screen.getByText("Carga del informe de Agenda Web y citas atendidas para cumplimiento")
    ).toBeInTheDocument();
  });

  it("enlaza a la edición de las áreas de servicio", () => {
    render(<CitasPage />);

    expect(screen.getByRole("link", { name: "Áreas de servicio" })).toHaveAttribute(
      "href",
      "/admin/citas/areas"
    );
  });

  it("separa la carga del informe de la grilla de citas atendidas para cumplimiento", () => {
    render(<CitasPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Cargar informe de citas" })).toBeInTheDocument();
    expect(screen.getByLabelText("Importar informe")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Citas atendidas para cumplimiento" })
    ).toBeInTheDocument();
    expect(screen.getByText(/citas confirmadas con las que se mide el cumplimiento/i)).toBeInTheDocument();
    expect(screen.getByText("Profesionales con citas ingresadas")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Excel/ })).not.toBeInTheDocument();
  });

  it("muestra las citas del periodo antes de las citas atendidas para cumplimiento", () => {
    render(<CitasPage />);

    const delPeriodo = screen.getByRole("heading", { level: 2, name: "Citas del periodo" });
    const atendidas = screen.getByRole("heading", { level: 2, name: "Citas atendidas para cumplimiento" });
    expect(delPeriodo.compareDocumentPosition(atendidas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.getByText("Todas las citas del informe de Agenda Web por profesional")
    ).toBeInTheDocument();
    expect(screen.getByText("No hay informe cargado para este mes")).toBeInTheDocument();
  });

  it("consulta el detalle de citas y las citas atendidas del mismo periodo", () => {
    render(<CitasPage />);

    const claves = mockUseSWR.mock.calls.map(([key]) => key as string);
    const detalleKey = claves.find((k) => k.startsWith("/api/admin/citas/detalle"))!;
    const atendidasKey = claves.find((k) => k.startsWith("/api/admin/citas-atendidas"))!;
    expect(detalleKey.split("periodo=")[1]).toBe(atendidasKey.split("periodo=")[1]);

    fireEvent.change(screen.getByLabelText("Año"), { target: { value: "2025" } });
    const nuevas = mockUseSWR.mock.calls.map(([key]) => key as string).filter((k) => /periodo=2025\d\d$/.test(k));
    expect(nuevas.some((k) => k.startsWith("/api/admin/citas/detalle"))).toBe(true);
    expect(nuevas.some((k) => k.startsWith("/api/admin/citas-atendidas"))).toBe(true);
  });

  it("recarga las citas del periodo y las atendidas tras una importación exitosa", () => {
    render(<CitasPage />);

    fireEvent.click(screen.getByRole("button", { name: "Importar informe" }));

    expect(mutateDetalle).toHaveBeenCalled();
    expect(mutateAtendidas).toHaveBeenCalled();
  });
});
