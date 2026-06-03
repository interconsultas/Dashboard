/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Spinner } from "@/components/ui/Spinner";

describe("Spinner", () => {
  it("renderiza un SVG", () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("tiene clase animate-spin por defecto", () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector("svg");
    expect(svg!.className.baseVal).toContain("animate-spin");
  });

  it("usa className por defecto h-5 w-5", () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector("svg");
    expect(svg!.className.baseVal).toContain("h-5 w-5");
  });

  it("acepta className personalizado", () => {
    const { container } = render(<Spinner className="h-8 w-8" />);
    const svg = container.querySelector("svg");
    expect(svg!.className.baseVal).toContain("h-8 w-8");
  });

  it("contiene elementos circle y path", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector("circle")).not.toBeNull();
    expect(container.querySelector("path")).not.toBeNull();
  });
});
