/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = jest.fn();
const mockSignIn = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("next-auth/react", () => ({ signIn: (...args: unknown[]) => mockSignIn(...args) }));
jest.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

import LoginPage from "@/app/login/page";

describe("/login", () => {
  beforeEach(() => mockPush.mockClear());

  it("tras iniciar sesión va a la raíz, que el middleware envía al inicio del rol", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const { container } = render(<LoginPage />);

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });

  it("muestra el logo, campos con etiqueta y el error como alerta", async () => {
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });
    render(<LoginPage />);

    expect(screen.getByAltText("IPS Manizales — Interconsultas")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos");
    expect(mockPush).not.toHaveBeenCalledWith("/");
  });
});
