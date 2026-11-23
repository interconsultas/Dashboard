import { datosGraficasFicha, datosGraficasMensual, datosGraficasVista, graficasPdf } from "@/lib/informes/graficas";
import { FICHA, PRODUCTIVIDAD } from "@/test-utils/informes";

const EMBUDO = { ofertadas: 1000, asignadas: 800, atendidas: 680, disponibles: 200, inasistidas: 120 };

describe("datos de las gráficas del informe", () => {
  it("vista: tendencia del tablero, periodo seleccionado y embudo", () => {
    expect(datosGraficasVista({ ...PRODUCTIVIDAD, embudo: EMBUDO })).toEqual({
      tipo: "vista",
      tendencia: PRODUCTIVIDAD.tendencia,
      seleccionado: "202610",
      embudo: EMBUDO,
    });
  });

  it("mensual: la serie de 12 periodos de los indicadores", () => {
    expect(datosGraficasMensual(PRODUCTIVIDAD)).toEqual({ tipo: "mensual", tendencia: PRODUCTIVIDAD.kpis.serie, seleccionado: "202610" });
  });

  it("ficha: servicios y tendencia del profesional", () => {
    expect(datosGraficasFicha(FICHA)).toEqual({
      tipo: "ficha",
      tendencia: FICHA.tendencia,
      seleccionado: "202610",
      servicios: FICHA.servicios,
    });
  });
});

describe("graficasPdf", () => {
  it("vista: tendencia y embudo, enlazadas con las gráficas en pantalla", () => {
    const g = graficasPdf(datosGraficasVista({ ...PRODUCTIVIDAD, embudo: EMBUDO }));
    expect(g.map((x) => [x.id, x.enPantalla])).toEqual([
      ["tendencia", "Tendencia del % de inasistencia"],
      ["embudo", "Embudo de la agenda"],
    ]);
    // Fuera de pantalla la tendencia va sin zoom y sin animación
    expect(g[0].opcion).not.toHaveProperty("dataZoom");
    expect(g[0].opcion).toMatchObject({ animation: false });
    expect(g[0].ancho).toBeGreaterThan(g[0].alto);
  });

  it("vista: sin embudo ni tendencia no hay gráficas", () => {
    expect(graficasPdf({ tipo: "vista", tendencia: [], seleccionado: null, embudo: null })).toEqual([]);
    expect(graficasPdf({ tipo: "vista", tendencia: [], seleccionado: null, embudo: { ...EMBUDO, ofertadas: 0 } })).toEqual([]);
  });

  it("mensual: solo la tendencia, que no está en pantalla", () => {
    const g = graficasPdf(datosGraficasMensual(PRODUCTIVIDAD));
    expect(g.map((x) => [x.id, x.enPantalla])).toEqual([["tendencia", null]]);
    // Ocupa todo el ancho de la portada: más apaisada que la del tablero
    const vista = graficasPdf(datosGraficasVista(PRODUCTIVIDAD))[0];
    expect(g[0].ancho / g[0].alto).toBeGreaterThan(vista.ancho / vista.alto);
  });

  it("ficha: servicios (alto según el número de servicios) y tendencia", () => {
    const g = graficasPdf(datosGraficasFicha(FICHA));
    expect(g.map((x) => [x.id, x.enPantalla])).toEqual([
      ["servicios", "Servicios del profesional"],
      ["tendencia", "Tendencia de inasistencia del profesional"],
    ]);
    const muchos = graficasPdf({ ...datosGraficasFicha(FICHA), servicios: Array(10).fill(FICHA.servicios[0]) } as never);
    expect(muchos[0].alto).toBeGreaterThan(g[0].alto);
  });
});
