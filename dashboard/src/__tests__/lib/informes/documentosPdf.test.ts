import { informeFicha, informeMensual, informeVista } from "@/lib/informes/construir";
import { contenidoPdf, LIMITE_PROFESIONALES } from "@/lib/informes/documentosPdf";
import { FILTROS_VACIOS } from "@/lib/productividad/filtros";
import { ALERTAS, FICHA, PRODUCTIVIDAD } from "@/test-utils/informes";

const AHORA = new Date("2026-11-18T15:32:00Z");
const ids = (c: ReturnType<typeof contenidoPdf>) => c.tablas.map((t) => t.id);

describe("contenidoPdf: del modelo a las secciones del documento", () => {
  it("encabezado con periodo, comparación, filtros y hora de generación", () => {
    const c = contenidoPdf(informeVista(PRODUCTIVIDAD, { ...FILTROS_VACIOS, periodo: "202610", area: "Salud oral" }, AHORA));
    expect(c.encabezado).toMatchObject({
      titulo: "Productividad de la agenda",
      periodo: "Octubre 2026",
      comparado: "Comparado con Septiembre 2026",
      generado: "18/11/2026, 10:32",
      archivo: "Productividad_Octubre_2026.pdf",
    });
    expect(c.encabezado.filtros).toContainEqual({ etiqueta: "Área", valor: "Salud oral" });
  });

  it("vista: áreas, servicios y los profesionales con más citas (la tendencia va en gráfica)", () => {
    const c = contenidoPdf(informeVista(PRODUCTIVIDAD, FILTROS_VACIOS, AHORA));
    expect(ids(c)).toEqual(["areas", "servicios", "profesionales"]);
    expect(c.tablas[2].titulo).toBe("Profesionales con más citas asignadas");
    expect(c.kpis.map((k) => k.clave)).toContain("pct_inasistencia");
  });

  it("mensual con Inteligencia: prioridades y proyección primero, luego el detalle y el ranking", () => {
    const c = contenidoPdf(informeMensual(PRODUCTIVIDAD, ALERTAS, AHORA));
    expect(ids(c)).toEqual(["prioridades", "proyeccion", "areas", "servicios", "profesionales"]);
    expect(c.tablas[4].titulo).toBe("Ranking de profesionales por citas inasistidas");
    expect(c.encabezado.archivo).toBe("Informe_mensual_Octubre_2026.pdf");
    expect(c.notas).toEqual([]);
  });

  it("mensual sin Inteligencia: sin prioridades y con la nota que lo explica", () => {
    const c = contenidoPdf(informeMensual(PRODUCTIVIDAD, null, AHORA));
    expect(ids(c)).toEqual(["areas", "servicios", "profesionales"]);
    expect(c.notas).toEqual(["Prioridades y proyección omitidas: requieren acceso a Inteligencia."]);
  });

  it("los listados de profesionales se recortan al límite", () => {
    const lista = Array.from({ length: LIMITE_PROFESIONALES + 5 }, (_, i) => ({
      ...PRODUCTIVIDAD.profesionales.lista[0],
      documento: String(1000 + i),
    }));
    const c = contenidoPdf(informeVista({ ...PRODUCTIVIDAD, profesionales: { ...PRODUCTIVIDAD.profesionales, lista } }, FILTROS_VACIOS, AHORA));
    const t = c.tablas.find((x) => x.id === "profesionales")!;
    expect(t.filas).toHaveLength(LIMITE_PROFESIONALES);
    expect(t.total).toBeNull();
  });

  it("ficha: servicios y tendencia; subtítulo con documento y área", () => {
    const c = contenidoPdf(informeFicha(FICHA, AHORA));
    expect(ids(c)).toEqual(["servicios", "tendencia"]);
    expect(c.encabezado.subtitulo).toContain("CC 1053");
    expect(c.encabezado.archivo).toBe("Ficha_1053_Octubre_2026.pdf");
  });

  it("sin cargas el periodo dice Sin cargas y no hay comparación", () => {
    const vacio = { ...PRODUCTIVIDAD, periodo: null, kpis: { ...PRODUCTIVIDAD.kpis, actual: null, anterior: null, periodo_anterior: null } };
    const c = contenidoPdf(informeVista(vacio, FILTROS_VACIOS, AHORA));
    expect(c.encabezado.periodo).toBe("Sin cargas");
    expect(c.encabezado.comparado).toBeNull();
    expect(c.encabezado.archivo).toBe("Productividad.pdf");
  });
});
