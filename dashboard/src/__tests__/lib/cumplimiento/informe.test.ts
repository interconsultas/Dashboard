import {
  construirInforme,
  marcasEje,
  nombreArchivoInforme,
  slugArchivo,
  yEtiquetaBarra,
} from "@/lib/cumplimiento/informe";
import { construirCumplimiento } from "@/lib/cumplimiento/calcular";
import { CATEGORIAS } from "@/lib/cumplimiento/categorias";
import type { RespuestaCumplimiento } from "@/lib/cumplimiento/tipos";

const DATOS: RespuestaCumplimiento = {
  atribucion: "ordenador",
  periodos_disponibles: [202511, 202512, 202601, 202602],
  periodo_desde: 202512,
  periodo_hasta: 202602,
  periodos: [202512, 202601, 202602],
  ...construirCumplimiento({
    entradas: [
      // 300 órdenes / 100 citas = 3 frente a meta 2 → 150%
      { documento: "10234567", nombre: "PÉREZ JUAN", periodo: 202601, citas: 100, programa: "RCV", categoria: "medicamentos", ordenes: 300 },
      // 1 frente a meta 2 → 50%
      { documento: "10234567", nombre: "PÉREZ JUAN", periodo: 202602, citas: 100, programa: "RCV", categoria: "medicamentos", ordenes: 100 },
      // 100 / 100 = 1 frente a meta 2 → 50%
      { documento: "30345678", nombre: "GOMEZ ANA", periodo: 202602, citas: 1200, programa: "RCV", categoria: "medicamentos", ordenes: 1200 },
      // Citas sin programa: sin meta
      { documento: "50111222", nombre: "RUIZ LUIS", periodo: 202602, citas: 40, programa: null, categoria: null, ordenes: null },
    ],
    metas: [{ anio: 2026, programa: "RCV", categoria: "medicamentos", valor: 2 }],
  }),
};

const GENERADO = new Date(2026, 9, 8, 10, 0);

function general(programas: string[] | null = null) {
  return construirInforme({ datos: DATOS, programas, documento: null, generado: GENERADO });
}

function detalle(documento = "10234567") {
  return construirInforme({ datos: DATOS, programas: null, documento, generado: GENERADO });
}

describe("slugArchivo", () => {
  it("quita tildes, pasa a minúsculas y une las palabras con guiones", () => {
    expect(slugArchivo("PÉREZ  Núñez, Juan")).toBe("perez-nunez-juan");
  });

  it("no deja guiones al inicio ni al final", () => {
    expect(slugArchivo("  -Ana- ")).toBe("ana");
  });
});

describe("nombreArchivoInforme", () => {
  it("incluye el rango consultado", () => {
    expect(nombreArchivoInforme(202512, 202602, null)).toBe("cumplimiento_202512_202602.pdf");
  });

  it("agrega el profesional cuando el informe es de uno solo", () => {
    expect(nombreArchivoInforme(202512, 202602, "PÉREZ JUAN")).toBe("cumplimiento_202512_202602_perez-juan.pdf");
  });
});

describe("marcasEje", () => {
  it("reparte el eje en marcas redondas que incluyen el techo", () => {
    expect(marcasEje(120)).toEqual([0, 20, 40, 60, 80, 100, 120]);
    expect(marcasEje(200)).toEqual([0, 50, 100, 150, 200]);
  });

  it("con techos altos usa pasos más grandes", () => {
    expect(marcasEje(1260)).toEqual([0, 200, 400, 600, 800, 1000, 1200]);
  });
});

describe("construirInforme — encabezado", () => {
  it("titula el informe e indica el periodo, la atribución y la fecha de generación", () => {
    const informe = general();

    expect(informe.titulo).toBe("Informe de cumplimiento");
    expect(informe.periodo).toBe("Dic 2025 – Feb 2026");
    expect(informe.atribucion).toBe("Órdenes atribuidas al médico ordenador");
    expect(informe.generado).toBe("8 de octubre de 2026");
  });

  it("sin filtros aplicados no lista filtros", () => {
    expect(general().filtros).toEqual([]);
  });

  it("lista el programa cuando el filtro deja programas por fuera", () => {
    expect(general(["RCV", "CPR"]).filtros).toEqual([{ etiqueta: "Programa", valor: "RCV, CPR" }]);
  });

  it("identifica al profesional del detalle", () => {
    expect(detalle().filtros).toEqual([
      { etiqueta: "Profesional", valor: "PÉREZ JUAN · Cédula 10234567 · Programa RCV" },
    ]);
  });

  it("nombra el archivo con el rango y el profesional", () => {
    expect(general().nombreArchivo).toBe("cumplimiento_202512_202602.pdf");
    expect(detalle().nombreArchivo).toBe("cumplimiento_202512_202602_perez-juan.pdf");
  });
});

describe("construirInforme — resumen", () => {
  it("formatea el global y las 7 categorías como en pantalla, con su estado", () => {
    const { resumen } = detalle();

    // Promedio de 150% y 50%
    expect(resumen.global).toEqual({
      etiqueta: "Cumplimiento global",
      texto: "100%",
      estado: "dentro",
      estadoTexto: "Dentro de la meta",
    });
    expect(resumen.categorias.map((c) => c.etiqueta)).toEqual(CATEGORIAS.map((c) => c.etiqueta));
    expect(resumen.categorias[0]).toMatchObject({ texto: "100%", estado: "dentro" });
    expect(resumen.categorias[1]).toMatchObject({ texto: "—", estado: "sin_datos", estadoTexto: "Sin datos" });
    expect(resumen.notaMeta).toBe("Meta <100% (menor es mejor)");
  });

  it("en la vista general resume a todos los profesionales", () => {
    const { resumen } = general();
    expect(resumen.global.texto).toBe(`${Math.round(DATOS.resumen.global! * 100)}%`);
  });

  it("marca 'Sobre la meta' por encima del 100%", () => {
    const informe = construirInforme({
      datos: { ...DATOS, resumen: { global: 1.37, pct: {} } },
      programas: null,
      documento: null,
      generado: GENERADO,
    });
    expect(informe.resumen.global).toMatchObject({ texto: "137%", estado: "sobre", estadoTexto: "Sobre la meta" });
  });
});

describe("construirInforme — gráfica global", () => {
  it("lleva una barra por mes en orden, con la etiqueta corta y el porcentaje formateado", () => {
    const { graficaGlobal } = detalle();

    expect(graficaGlobal.titulo).toBe("Cumplimiento global por mes");
    expect(graficaGlobal.subtitulo).toBe("Promedio de las categorías con meta en cada mes");
    expect(graficaGlobal.puntos.map((p) => [p.etiqueta, p.pct, p.texto])).toEqual([
      ["Ene 26", 150, "150%"],
      ["Feb 26", 50, "50%"],
    ]);
    expect(graficaGlobal.techo).toBe(160);
    expect(graficaGlobal.marcas).toEqual([0, 20, 40, 60, 80, 100, 120, 140, 160]);
    expect(graficaGlobal.conEtiquetas).toBe(true);
    expect(graficaGlobal.hayDatos).toBe(true);
  });

  it("en la vista general usa la serie mensual de todos los profesionales", () => {
    const { graficaGlobal } = general();
    expect(graficaGlobal.subtitulo).toBe("Promedio de los profesionales con datos en cada mes");
    expect(graficaGlobal.puntos.map((p) => p.periodo)).toEqual(DATOS.serieMensual.map((s) => s.periodo));
  });

  it("con más de 12 meses omite las etiquetas sobre las barras", () => {
    const serieMensual = Array.from({ length: 13 }, (_, i) => ({
      periodo: (2025 + Math.floor(i / 12)) * 100 + (i % 12) + 1,
      profesionalesConDatos: 1,
      pct: {},
      global: 0.9,
    }));
    const informe = construirInforme({ datos: { ...DATOS, serieMensual }, programas: null, documento: null, generado: GENERADO });
    expect(informe.graficaGlobal.conEtiquetas).toBe(false);
  });
});

describe("construirInforme — vista general", () => {
  it("ordena el ranking por cumplimiento global descendente con los sin dato al final", () => {
    const informe = general();
    if (informe.detalle.tipo !== "general") throw new Error("se esperaba la vista general");

    expect(informe.detalle.ranking.map((f) => f.nombre)).toEqual(["PÉREZ JUAN", "GOMEZ ANA", "RUIZ LUIS"]);
  });

  it("formatea cada fila del ranking", () => {
    const informe = general();
    if (informe.detalle.tipo !== "general") throw new Error("se esperaba la vista general");
    const [perez, gomez, ruiz] = informe.detalle.ranking;

    expect(perez).toMatchObject({ documento: "10234567", programa: "RCV", citas: "200" });
    expect(perez.global).toEqual({ texto: "100%", estado: "dentro" });
    expect(perez.categorias).toHaveLength(7);
    expect(gomez.citas).toBe("1.200");
    expect(ruiz.programa).toBeNull();
    expect(ruiz.global).toEqual({ texto: "—", estado: "sin_datos" });
  });

  it("avisa cuando hay profesionales con citas sin programa", () => {
    expect(general().aviso).toBe(
      "1 profesional del listado tiene citas atendidas pero no tiene programa asignado. Sin programa no hay meta y no se calcula su porcentaje."
    );
  });
});

describe("construirInforme — profesional", () => {
  it("identifica al profesional y arma su historial mes a mes", () => {
    const informe = detalle();
    if (informe.detalle.tipo !== "profesional") throw new Error("se esperaba el detalle");

    expect(informe.detalle.profesional).toEqual({ nombre: "PÉREZ JUAN", documento: "10234567", programa: "RCV" });
    const [enero, febrero] = informe.detalle.historial;
    expect(enero).toMatchObject({ periodo: "Ene 2026", citas: "100", programa: "RCV" });
    expect(enero.global).toEqual({ texto: "150%", estado: "sobre" });
    expect(enero.categorias[0]).toEqual({ tasa: "3,00", meta: "2,00", pct: { texto: "150%", estado: "sobre" } });
    expect(enero.categorias[1]).toEqual({ tasa: "0,00", meta: "—", pct: { texto: "—", estado: "sin_datos" } });
    expect(febrero.periodo).toBe("Feb 2026");
  });

  it("arma una tendencia por indicador con el último valor disponible", () => {
    const informe = detalle();
    if (informe.detalle.tipo !== "profesional") throw new Error("se esperaba el detalle");
    const [medicamentos, laboratorios] = informe.detalle.tendencias;

    expect(informe.detalle.tendencias).toHaveLength(7);
    expect(medicamentos.etiqueta).toBe("Medicamentos");
    expect(medicamentos.puntos.map((p) => p.pct)).toEqual([150, 50]);
    expect(medicamentos.ultimo).toEqual({ texto: "50%", estado: "dentro", periodo: "Feb 2026" });
    expect(medicamentos.techo).toBe(160);
    expect(laboratorios.ultimo).toBeNull();
  });

  it("sin periodos sin programa no hay aviso", () => {
    expect(detalle().aviso).toBeNull();
  });

  it("avisa cuando el profesional tiene periodos sin programa", () => {
    expect(detalle("50111222").aviso).toBe(
      "Este profesional tiene citas atendidas en periodos sin programa asignado. Sin programa no hay meta y no se calcula el porcentaje de esos periodos."
    );
  });

  it("falla si el profesional no está en los datos", () => {
    expect(() => detalle("999")).toThrow("El profesional seleccionado no tiene datos en el rango consultado");
  });
});

describe("yEtiquetaBarra", () => {
  // Coordenadas SVG: y crece hacia abajo; la línea de la meta está en y = 100.
  it("deja la cifra justo encima de la barra cuando queda lejos de la meta", () => {
    expect(yEtiquetaBarra(150, 100)).toBe(146);
    expect(yEtiquetaBarra(60, 100)).toBe(56);
  });

  it("sube la cifra por encima de la meta cuando la línea la tacharía", () => {
    expect(yEtiquetaBarra(101, 100)).toBe(96);
    expect(yEtiquetaBarra(106, 100)).toBe(96);
    expect(yEtiquetaBarra(99, 100)).toBe(95);
  });
});
