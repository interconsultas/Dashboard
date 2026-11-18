import { informeFicha, informeMensual, informeVista, nombreArchivo } from "@/lib/informes/construir";
import type { TablaInforme } from "@/lib/informes/modelo";
import { FILTROS_VACIOS } from "@/lib/productividad/filtros";
import { ALERTAS, FICHA, PRODUCTIVIDAD } from "@/test-utils/informes";

// 18 nov 2026, 15:32 UTC = 10:32 en Bogotá
const GENERADO = new Date(Date.UTC(2026, 10, 18, 15, 32));

const tabla = (tablas: TablaInforme[], id: string) => {
  const t = tablas.find((x) => x.id === id);
  if (!t) throw new Error(`Sin tabla ${id}`);
  return t;
};
const claves = (t: TablaInforme) => t.columnas.map((c) => c.clave);

describe("nombreArchivo", () => {
  it("une las partes con guion bajo y quita tildes y símbolos", () => {
    expect(nombreArchivo("Productividad", "Octubre 2026")).toBe("Productividad_Octubre_2026");
    expect(nombreArchivo("Informe mensual", "5–11 oct 2026")).toBe("Informe_mensual_5-11_oct_2026");
    expect(nombreArchivo("Ficha", "Área médica / ñ")).toBe("Ficha_Area_medica_n");
  });
});

describe("informeVista", () => {
  const m = informeVista(PRODUCTIVIDAD, FILTROS_VACIOS, GENERADO);

  it("arma el encabezado con el periodo, los filtros y la hora de generación en Colombia", () => {
    expect(m.tipo).toBe("vista");
    expect(m.titulo).toBe("Productividad de la agenda");
    expect(m.periodo).toBe("Octubre 2026");
    expect(m.periodo_anterior).toBe("Septiembre 2026");
    expect(m.archivo).toBe("Productividad_Octubre_2026");
    expect(m.hoja_resumen).toBe("Resumen");
    expect(m.generado).toBe("18/11/2026, 10:32");
    expect(m.filtros).toEqual([
      { etiqueta: "Granularidad", valor: "Mensual" },
      { etiqueta: "Periodo", valor: "Octubre 2026" },
      { etiqueta: "Área", valor: "Todas" },
      { etiqueta: "Servicio", valor: "Todos" },
      { etiqueta: "Profesional", valor: "Todos" },
    ]);
  });

  it("nombra los filtros activos con sus etiquetas", () => {
    const filtrada = informeVista(
      PRODUCTIVIDAD,
      { ...FILTROS_VACIOS, area: "Salud oral", servicio: "22", profesional: "1053" },
      GENERADO
    );
    expect(filtrada.filtros.slice(2)).toEqual([
      { etiqueta: "Área", valor: "Salud oral" },
      { etiqueta: "Servicio", valor: "HIGIENE (22)" },
      { etiqueta: "Profesional", valor: "PROFESIONAL A (CC 1053)" },
    ]);
  });

  it("calcula los indicadores del periodo contra el anterior; los % como fórmula", () => {
    const pct = m.kpis.find((k) => k.clave === "pct_inasistencia")!;
    expect(pct).toMatchObject({
      tipo: "porcentaje",
      valor: 0.15,
      anterior: 0.1,
      variacion: "puntos",
      formula: { numerador: "inasistidas", denominador: "asignadas" },
      semaforo: true,
    });
    expect(m.kpis.find((k) => k.clave === "asignadas")).toMatchObject({ valor: 800, anterior: 700, variacion: "relativa" });
    expect(m.kpis.find((k) => k.clave === "pct_disponibilidad")!.formula).toEqual({ numerador: "disponibles", denominador: "ofertadas" });
    expect(m.kpis.find((k) => k.clave === "con_agenda")).toMatchObject({ valor: 2, anterior: null, variacion: null });
  });

  it("trae las hojas por área, servicio, profesional y tendencia", () => {
    expect(m.tablas.map((t) => t.titulo)).toEqual(["Por área", "Por servicio", "Por profesional", "Tendencia"]);

    const area = tabla(m.tablas, "areas");
    expect(claves(area)).toEqual([
      "area", "ofertadas", "asignadas", "atendidas", "inasistidas", "pct_inasistencia",
      "disponibles", "pct_disponibilidad", "perdidas",
    ]);
    expect(area.totales).toBe(true);
    expect(area.filas[0]).toMatchObject({ area: "Medicina general", asignadas: 500, inasistidas: 100, pct_inasistencia: 0.2 });
    expect(area.columnas.find((c) => c.clave === "pct_inasistencia")).toMatchObject({
      tipo: "porcentaje",
      semaforo: true,
      formula: { numerador: "inasistidas", denominador: "asignadas" },
    });

    expect(tabla(m.tablas, "servicios").filas).toEqual([
      expect.objectContaining({ area: "Medicina general", codigo: "11", servicio: "CONSULTA", asignadas: 500 }),
      expect.objectContaining({ area: "Salud oral", codigo: "22", servicio: "HIGIENE", asignadas: 300 }),
    ]);

    // De más a menos asignadas
    const prof = tabla(m.tablas, "profesionales");
    expect(prof.filas.map((f) => f.documento)).toEqual(["2077", "1053"]);
    expect(prof.filas[0]).toMatchObject({ nombre: "PROFESIONAL B", area_principal: "Medicina general" });

    const tend = tabla(m.tablas, "tendencia");
    expect(tend.totales).toBe(false);
    expect(tend.filas.map((f) => f.periodo)).toEqual(["Sep 2026", "Oct 2026"]);
  });

  it("deja la serie de tendencia para las gráficas", () => {
    expect(m.series[0]).toMatchObject({
      id: "tendencia",
      etiquetas: ["Sep 2026", "Oct 2026"],
      series: [
        { nombre: "Asignadas", tipo: "entero", valores: [700, 800] },
        { nombre: "% inasistencia", tipo: "porcentaje", valores: [0.1, 0.15] },
      ],
    });
  });

  it("sin cargas no falla: sin periodo ni indicadores", () => {
    const vacia = informeVista(
      { ...PRODUCTIVIDAD, periodo: null, kpis: { actual: null, anterior: null, periodo_anterior: null, serie: [] } },
      FILTROS_VACIOS,
      GENERADO
    );
    expect(vacia.periodo).toBeNull();
    expect(vacia.archivo).toBe("Productividad");
    expect(vacia.kpis.find((k) => k.clave === "asignadas")!.valor).toBeNull();
  });
});

describe("informeMensual", () => {
  it("usa la serie de 12 periodos y ordena el ranking por citas inasistidas", () => {
    const m = informeMensual(PRODUCTIVIDAD, ALERTAS, GENERADO);
    expect(m.tipo).toBe("mensual");
    expect(m.titulo).toBe("Informe mensual de citas");
    expect(m.archivo).toBe("Informe_mensual_Octubre_2026");
    expect(m.filtros).toEqual([
      { etiqueta: "Periodo", valor: "Octubre 2026" },
      { etiqueta: "Comparado con", valor: "Septiembre 2026" },
    ]);
    expect(m.tablas.map((t) => t.titulo)).toEqual([
      "Por área", "Por servicio", "Por profesional", "Tendencia", "Prioridades", "Proyección",
    ]);

    const ranking = tabla(m.tablas, "profesionales");
    expect(ranking.columnas[0]).toMatchObject({ clave: "posicion", tipo: "entero" });
    expect(ranking.filas.map((f) => [f.posicion, f.documento])).toEqual([[1, "2077"], [2, "1053"]]);
    expect(ranking.totales).toBe(true);
  });

  it("lleva las prioridades y la proyección de Inteligencia", () => {
    const m = informeMensual(PRODUCTIVIDAD, ALERTAS, GENERADO);
    const prio = tabla(m.tablas, "prioridades");
    expect(prio.totales).toBe(false);
    expect(prio.filas[0]).toMatchObject({
      posicion: 1,
      prioridad: "Medicina general: 50 citas inasistidas por encima de la meta",
      area: "Medicina general",
      citas: 50,
      profesionales: 1.25,
      novedad: "Nuevo",
      revisar: "Confirmación de citas",
      detalle: "CONSULTA: 20 %",
    });
    expect(prio.columnas.find((c) => c.clave === "profesionales")!.tipo).toBe("decimal");

    const proy = tabla(m.tablas, "proyeccion");
    expect(proy.nota).toMatch(/Noviembre 2026/);
    expect(proy.filas[0]).toMatchObject({
      ambito: "Área",
      nombre: "Medicina general",
      pct_ultimo: 0.2,
      pct_proyectado: 0.22,
      pct_min: 0.18,
      pct_max: 0.26,
      direccion: "Sube",
      asignadas_ultimo: 500,
      asignadas_proyectadas: 520,
    });
  });

  it("avisa cuando las prioridades son de otro periodo que el del informe", () => {
    const m = informeMensual({ ...PRODUCTIVIDAD, periodo: "202609" }, ALERTAS, GENERADO);
    expect(tabla(m.tablas, "prioridades").nota).toMatch(/Octubre 2026/);
  });

  it("sin acceso a Inteligencia omite prioridades y proyección", () => {
    const m = informeMensual(PRODUCTIVIDAD, null, GENERADO);
    expect(m.tablas.map((t) => t.id)).toEqual(["areas", "servicios", "profesionales", "tendencia"]);
  });
});

describe("informeFicha", () => {
  const m = informeFicha(FICHA, GENERADO);

  it("encabeza con el profesional y su periodo", () => {
    expect(m.tipo).toBe("ficha");
    expect(m.titulo).toBe("Ficha del profesional");
    expect(m.subtitulo).toBe("PROFESIONAL A · CC 1053 · Salud oral");
    expect(m.hoja_resumen).toBe("Ficha");
    expect(m.archivo).toBe("Ficha_1053_Octubre_2026");
  });

  it("incluye la comparación con la institución y el percentil", () => {
    expect(m.kpis.find((k) => k.clave === "pct_inasistencia")).toMatchObject({ valor: 20 / 300 });
    expect(m.kpis.find((k) => k.clave === "institucion")).toMatchObject({ tipo: "porcentaje", valor: 0.15 });
    expect(m.kpis.find((k) => k.clave === "percentil")).toMatchObject({ tipo: "entero", valor: 80 });
    expect(m.kpis.find((k) => k.clave === "pares")).toMatchObject({ valor: 25 });
  });

  it("trae las hojas de servicios y tendencia", () => {
    expect(m.tablas.map((t) => t.titulo)).toEqual(["Servicios", "Tendencia"]);
    expect(tabla(m.tablas, "servicios").filas[0]).toMatchObject({ codigo: "22", servicio: "HIGIENE", asignadas: 300 });
  });
});
