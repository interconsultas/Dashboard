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
  it("tras iniciar sesión va a la raíz, que el middleware envía al inicio del rol", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const { container } = render(<LoginPage />);

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });
});
