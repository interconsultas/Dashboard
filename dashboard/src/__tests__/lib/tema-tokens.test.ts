import { readFileSync } from "fs";
import path from "path";
import { COLORES, PARES_TEXTO, contraste, hexToken, type Token } from "@/lib/tema/tokens";
import config from "../../../tailwind.config";

const AA_TEXTO = 4.5;

describe("tokens de diseño — contraste WCAG AA", () => {
  it("la fórmula coincide con los valores de referencia", () => {
    expect(contraste("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contraste("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contraste("#767676", "#FFFFFF")).toBeCloseTo(4.54, 2);
  });

  it.each(PARES_TEXTO.map(([t, f]) => [t, f, contraste(hexToken(t), hexToken(f))] as const))(
    "%s sobre %s cumple AA (%f:1)",
    (_t, _f, ratio) => {
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXTO);
    }
  );

  it("el acento no se usa como texto: sobre blanco no llega a AA (documentado)", () => {
    expect(contraste(COLORES.acento, "#FFFFFF")).toBeLessThan(AA_TEXTO);
  });
});

describe("tokens de diseño — sincronía con globals.css", () => {
  const css = readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");

  it.each(Object.entries(COLORES))("--%s vale %s", (nombre, valor) => {
    const m = css.match(new RegExp(`--${nombre}:\\s*(#[0-9A-Fa-f]{6})`));
    expect(m?.[1].toUpperCase()).toBe(valor.toUpperCase());
  });

  it("no descarga fuentes de Google", () => {
    expect(css).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
    expect(css).toMatch(/font-family: "DM Sans"/);
    expect(css).toMatch(/font-family: "Sora"/);
  });
});

describe("tokens de diseño — Tailwind", () => {
  const ext = config.theme?.extend as Record<string, Record<string, unknown>>;

  it("expone cada token como color (bg-superficie, text-tinta-2…)", () => {
    for (const t of Object.keys(COLORES) as Token[]) expect(ext.colors[t]).toBe(COLORES[t]);
  });

  it("las claves brand.* heredadas apuntan a la paleta nueva", () => {
    const brand = ext.colors.brand as Record<string, string>;
    expect(brand.navy).toBe(COLORES["primario-oscuro"]);
    expect(brand.green).toBe(COLORES.acento);
    expect(brand["blue-soft"]).toBe(COLORES["primario-suave"]);
  });

  it("define radios, sombra y familias tipográficas", () => {
    expect(ext.borderRadius).toEqual(expect.objectContaining({ tarjeta: "20px", control: "12px" }));
    expect(ext.boxShadow).toHaveProperty("tarjeta");
    expect(String(ext.fontFamily.sans)).toContain("DM Sans");
    expect(String(ext.fontFamily.titulo)).toContain("Sora");
  });
});
