import { existsSync } from "fs";
import path from "path";

const mockRegister = jest.fn();
const mockGuiones = jest.fn();
jest.mock("@react-pdf/renderer", () => ({
  Font: {
    register: (...a: unknown[]) => mockRegister(...a),
    registerHyphenationCallback: (...a: unknown[]) => mockGuiones(...a),
  },
}));

import {
  ARCHIVOS_FUENTES,
  FAMILIA_TEXTO,
  FAMILIA_TITULO,
  RUTA_FUENTES,
  registrarFuentesPdf,
} from "@/components/informes/pdf/fuentes";

describe("fuentes del PDF", () => {
  beforeEach(() => {
    mockRegister.mockClear();
    mockGuiones.mockClear();
  });

  it("los archivos estáticos existen en public/ (TTF, sin descargas en tiempo de ejecución)", () => {
    for (const f of ARCHIVOS_FUENTES) {
      expect(f.archivo).toMatch(/\.ttf$/);
      expect(existsSync(path.join(process.cwd(), "public", RUTA_FUENTES, f.archivo))).toBe(true);
    }
  });

  it("registra Sora 600/700 y DM Sans 400/500/700 con la base dada", () => {
    registrarFuentesPdf("https://x.test/fonts/pdf");
    expect(mockRegister).toHaveBeenCalledWith({
      family: FAMILIA_TITULO,
      fonts: [
        { src: "https://x.test/fonts/pdf/Sora-SemiBold.ttf", fontWeight: 600 },
        { src: "https://x.test/fonts/pdf/Sora-Bold.ttf", fontWeight: 700 },
      ],
    });
    expect(mockRegister).toHaveBeenCalledWith({
      family: FAMILIA_TEXTO,
      fonts: [
        { src: "https://x.test/fonts/pdf/DMSans-Regular.ttf", fontWeight: 400 },
        { src: "https://x.test/fonts/pdf/DMSans-Medium.ttf", fontWeight: 500 },
        { src: "https://x.test/fonts/pdf/DMSans-Bold.ttf", fontWeight: 700 },
      ],
    });
  });

  it("no parte palabras con guiones", () => {
    registrarFuentesPdf("/otra");
    const corte = mockGuiones.mock.calls[0][0] as (p: string) => string[];
    expect(corte("inasistencia")).toEqual(["inasistencia"]);
  });

  it("registra una sola vez por base", () => {
    registrarFuentesPdf("/una");
    registrarFuentesPdf("/una");
    expect(mockRegister).toHaveBeenCalledTimes(2);
    registrarFuentesPdf("/dos");
    expect(mockRegister).toHaveBeenCalledTimes(4);
  });
});
