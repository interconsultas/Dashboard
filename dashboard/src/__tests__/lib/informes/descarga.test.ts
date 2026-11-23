/**
 * @jest-environment jsdom
 */
import { descargarArchivo, nombreDeDisposicion, urlInforme } from "@/lib/informes/descarga";
import { FILTROS_VACIOS } from "@/lib/productividad/filtros";

describe("urlInforme", () => {
  it("lleva el tipo y los filtros activos", () => {
    expect(urlInforme("excel", "vista", { ...FILTROS_VACIOS, periodo: "202610", area: "Salud oral" })).toBe(
      "/api/informes/excel?tipo=vista&periodo=202610&area=Salud+oral"
    );
  });

  it("la ficha agrega el documento", () => {
    expect(urlInforme("excel", "ficha", FILTROS_VACIOS, "1053")).toBe("/api/informes/excel?tipo=ficha&documento=1053");
  });

  it("el PDF pide el modelo en JSON a /api/informes/datos con los mismos parámetros", () => {
    expect(urlInforme("pdf", "mensual", { ...FILTROS_VACIOS, periodo: "202610", area: "Salud oral" })).toBe(
      "/api/informes/datos?tipo=mensual&periodo=202610"
    );
  });
});

describe("nombreDeDisposicion", () => {
  it("lee el nombre del encabezado o usa el de reserva", () => {
    expect(nombreDeDisposicion('attachment; filename="Productividad_Octubre_2026.xlsx"', "x")).toBe(
      "Productividad_Octubre_2026.xlsx"
    );
    expect(nombreDeDisposicion(null, "informe.xlsx")).toBe("informe.xlsx");
  });
});

describe("descargarArchivo", () => {
  const crear = jest.fn(() => "blob:1");
  const revocar = jest.fn();
  beforeAll(() => {
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar });
  });

  it("descarga el blob con el nombre del servidor y libera la URL después", async () => {
    jest.useFakeTimers();
    const clic = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const respuesta = {
      ok: true,
      headers: new Headers({ "Content-Disposition": 'attachment; filename="Ficha_1053.xlsx"' }),
      blob: async () => new Blob(["x"]),
    };
    const fetchMock = jest.fn().mockResolvedValue(respuesta);
    await expect(descargarArchivo("/api/informes/excel?tipo=vista", fetchMock)).resolves.toBe("Ficha_1053.xlsx");
    expect(fetchMock).toHaveBeenCalledWith("/api/informes/excel?tipo=vista");
    expect(clic).toHaveBeenCalled();
    expect(revocar).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(revocar).toHaveBeenCalledWith("blob:1");
    jest.useRealTimers();
  });

  it("propaga el mensaje de error del servidor", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "Sin permisos suficientes" }) });
    await expect(descargarArchivo("/x", fetchMock)).rejects.toThrow("Sin permisos suficientes");
  });

  it("usa un mensaje genérico si la respuesta no es JSON", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error("html"); } });
    await expect(descargarArchivo("/x", fetchMock)).rejects.toThrow("No se pudo generar el informe");
  });
});
