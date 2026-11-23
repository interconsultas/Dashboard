/**
 * @jest-environment jsdom
 *
 * Con nivel 'ver' en una sección editable, la página queda en solo consulta:
 * se ocultan los controles que escriben (la API los rechazaría con 403).
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...a: unknown[]) => mockUseSWR(...a), mutate: jest.fn() }));
jest.mock("@/components/carga/DropzoneArchivo", () => ({ DropzoneArchivo: () => <div data-testid="dropzone" /> }));
jest.mock("@/components/carga/ListaArchivos", () => ({
  ListaArchivos: ({ puedeEliminar }: { puedeEliminar?: boolean }) => (
    <div data-testid="lista" data-puede-eliminar={String(puedeEliminar)} />
  ),
}));
jest.mock("@/components/medicos/ImportarMedicosExcel", () => ({
  ImportarMedicosExcel: () => <div data-testid="importar-medicos" />,
}));
jest.mock("@/components/cumplimiento/ImportarCitasExcel", () => ({
  ImportarCitasExcel: () => <div data-testid="importar-citas" />,
}));

import CargaPage from "@/app/admin/carga/page";
import MedicosPage from "@/app/admin/medicos/page";
import CitasPage from "@/app/admin/citas/page";
import { RolProvider } from "@/components/layout/RolContext";
import { PERMISOS_POR_DEFECTO, type Nivel, type Seccion } from "@/lib/acceso";

function renderCon(seccion: Seccion, nivel: Nivel, pagina: React.ReactElement) {
  const permisos = { ...PERMISOS_POR_DEFECTO.coordinador, [seccion]: nivel };
  return render(<RolProvider rol="coordinador" permisos={permisos}>{pagina}</RolProvider>);
}

const MEDICO = {
  usuario_txt: "jperez", identificacion: 123, nombre: "JUAN PEREZ",
  estado: "ACTIVO", programa_especialidad: null, area: null,
};

describe("páginas de administración en solo consulta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSWR.mockImplementation((key: unknown) => ({
      data: key === "/api/admin/medicos" ? [MEDICO] : undefined,
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    }));
  });

  describe("Carga de archivos", () => {
    it("con editar muestra la zona de carga y permite eliminar", () => {
      renderCon("carga", "editar", <CargaPage />);
      expect(screen.getByTestId("dropzone")).toBeInTheDocument();
      expect(screen.getByTestId("lista")).toHaveAttribute("data-puede-eliminar", "true");
    });

    it("con ver oculta la zona de carga y no permite eliminar", () => {
      renderCon("carga", "ver", <CargaPage />);
      expect(screen.queryByTestId("dropzone")).not.toBeInTheDocument();
      expect(screen.getByTestId("lista")).toHaveAttribute("data-puede-eliminar", "false");
      expect(screen.getByText(/solo consulta/i)).toBeInTheDocument();
    });
  });

  describe("Profesionales", () => {
    it("con editar muestra agregar, importar, editar y eliminar", () => {
      renderCon("profesionales", "editar", <MedicosPage />);
      expect(screen.getByTestId("importar-medicos")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Editar/ })).toBeInTheDocument();
    });

    it("con ver oculta agregar, importar, editar y eliminar", () => {
      renderCon("profesionales", "ver", <MedicosPage />);
      expect(screen.queryByTestId("importar-medicos")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Eliminar/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Nuevo|Agregar/ })).not.toBeInTheDocument();
      expect(screen.getByText("JUAN PEREZ")).toBeInTheDocument();
      expect(screen.getByText(/solo consulta/i)).toBeInTheDocument();
    });
  });

  describe("Citas", () => {
    it("con editar muestra la importación", () => {
      renderCon("citas", "editar", <CitasPage />);
      expect(screen.getByTestId("importar-citas")).toBeInTheDocument();
    });

    it("con ver oculta la importación", () => {
      renderCon("citas", "ver", <CitasPage />);
      expect(screen.queryByTestId("importar-citas")).not.toBeInTheDocument();
      expect(screen.getByText(/solo consulta/i)).toBeInTheDocument();
    });
  });
});
