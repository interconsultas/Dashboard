/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

describe("ConfirmModal", () => {
  it("no renderiza nada cuando open es false", () => {
    const { container } = render(
      <ConfirmModal
        open={false}
        title="Eliminar"
        message="¿Confirmás?"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza título y mensaje cuando open es true", () => {
    render(
      <ConfirmModal
        open={true}
        title="Eliminar carga"
        message="Esta acción no se puede deshacer"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByText("Eliminar carga")).toBeInTheDocument();
    expect(screen.getByText("Esta acción no se puede deshacer")).toBeInTheDocument();
  });

  it("llama a onConfirm al hacer click en el botón de confirmar", () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmModal
        open={true}
        title="Eliminar carga"
        message="msg"
        confirmLabel="Eliminar"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("llama a onCancel al hacer click en el botón de cancelar", () => {
    const onCancel = jest.fn();
    render(
      <ConfirmModal
        open={true}
        title="Eliminar"
        message="msg"
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("deshabilita los botones y muestra 'Procesando...' cuando loading es true", () => {
    render(
      <ConfirmModal
        open={true}
        title="Eliminar"
        message="msg"
        confirmLabel="Eliminar"
        loading={true}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByText("Procesando...")).toBeDisabled();
    expect(screen.getByText("Cancelar")).toBeDisabled();
  });
});
