/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUsePathname = jest.fn();

jest.mock("next/navigation", () => ({ usePathname: () => mockUsePathname() }));
jest.mock("next-auth/react", () => ({ signOut: jest.fn() }));
jest.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

import { Sidebar } from "@/components/layout/Sidebar";

function enlace(nombre: string) {
  return screen.getByRole("link", { name: nombre });
}

describe("Sidebar — entrada Cumplimiento", () => {
  it("enlaza a /dashboard/cumplimiento", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    render(<Sidebar />);

    expect(enlace("Cumplimiento")).toHaveAttribute("href", "/dashboard/cumplimiento");
  });

  it("en /dashboard/cumplimiento resalta Cumplimiento y no resalta Dashboard", () => {
    mockUsePathname.mockReturnValue("/dashboard/cumplimiento");
    render(<Sidebar />);

    expect(enlace("Cumplimiento")).toHaveClass("bg-brand-green");
    expect(enlace("Dashboard")).not.toHaveClass("bg-brand-green");
    expect(enlace("Dashboard")).not.toHaveClass("bg-white/10");
  });

  it("en /dashboard resalta Dashboard y no resalta Cumplimiento", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    render(<Sidebar />);

    expect(enlace("Dashboard")).toHaveClass("bg-brand-green");
    expect(enlace("Cumplimiento")).not.toHaveClass("bg-brand-green");
  });

  it("en una subvista del dashboard mantiene el comportamiento anterior y no resalta Cumplimiento", () => {
    mockUsePathname.mockReturnValue("/dashboard/tipo/rx");
    render(<Sidebar />);

    expect(enlace("Dashboard")).toHaveClass("bg-white/10");
    expect(enlace("RX")).toHaveClass("bg-brand-green/90");
    expect(enlace("Cumplimiento")).not.toHaveClass("bg-brand-green");
  });
});
