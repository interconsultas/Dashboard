import {
  opcionesArbol,
  opcionesCalor,
  opcionesDispersion,
  opcionesEmbudo,
  opcionesPareto,
  opcionesServiciosFicha,
  opcionesSparkline,
  opcionesTendencia,
  opcionesTendenciaFicha,
} from "@/lib/productividad/graficas";
import { pareto } from "@/lib/productividad/profesionales";
import { indicadores, metricasVacias } from "@/lib/productividad/metricas";
import { COLORES_AREA } from "@/lib/productividad/presentacion";
import type { NodoArea, NodoServicio, PuntoSerie, ResumenProfesional } from "@/lib/productividad/tipos";

/* eslint-disable @typescript-eslint/no-explicit-any */

function punto(clave: string, asignadas: number, inasistidas: number): PuntoSerie {
  return { clave, etiqueta: clave, ...indicadores({ ...metricasVacias(), asignadas, inasistidas }) };
}

const SERIE = [punto("202608", 100, 10), punto("202609", 0, 0), punto("202610", 200, 30)];

describe("opcionesTendencia", () => {
  const o: any = opcionesTendencia(SERIE, "202610");

  it("grafica el % de inasistencia en puntos porcentuales y deja hueco sin datos", () => {
    expect(o.series[0].data).toEqual([10, null, 15]);
    expect(o.xAxis.data).toEqual(["202608", "202609", "202610"]);
  });

  it("dibuja la meta del 10 % como línea punteada", () => {
    expect(o.series[0].markLine.data).toEqual([{ yAxis: 10 }]);
    expect(o.series[0].markLine.label.formatter).toBe("Meta 10 %");
    expect(o.series[0].markLine.lineStyle.type).toBe("dashed");
  });

  it("tiene zoom deslizante y etiqueta solo el periodo seleccionado", () => {
    expect(o.dataZoom.map((d: any) => d.type)).toEqual(["slider", "inside"]);
    const fmt = o.series[0].label.formatter;
    expect(fmt({ dataIndex: 2, value: 15 })).toBe("15 %");
    expect(fmt({ dataIndex: 0, value: 10 })).toBe("");
  });
});

describe("opcionesSparkline", () => {
  it("marca el último punto (periodo seleccionado)", () => {
    const o: any = opcionesSparkline([1, 2, 3], ["a", "b", "c"], String);
    expect(o.series[0].markPoint.data).toEqual([{ coord: [2, 3] }]);
  });
});

describe("opcionesEmbudo", () => {
  it("tres pasos sin reordenar y anotaciones de pérdidas", () => {
    const o: any = opcionesEmbudo({ ofertadas: 100, asignadas: 90, atendidas: 80, disponibles: 10, inasistidas: 10 });
    expect(o.series[0].sort).toBe("none");
    expect(o.series[0].data.map((d: any) => [d.name, d.value])).toEqual([
      ["Ofertadas", 100],
      ["Asignadas", 90],
      ["Atendidas", 80],
    ]);
    expect(o.graphic[0].style.text).toContain("no asignadas");
    expect(o.graphic[1].style.text).toContain("inasistidas");
  });
});

describe("opcionesCalor", () => {
  const o: any = opcionesCalor(
    {
      areas: ["A", "B"],
      periodos: [{ clave: "1", etiqueta: "Ene" }, { clave: "2", etiqueta: "Feb" }],
      celdas: [
        { area: "A", clave: "1", pct_inasistencia: 0.1, inasistidas: 1, asignadas: 10 },
        { area: "B", clave: "2", pct_inasistencia: 0.3, inasistidas: 3, asignadas: 10 },
      ],
    },
    null
  );

  it("mapa visual sobre la dimensión 2 (%) con rango entero", () => {
    expect(o.visualMap.dimension).toBe(2);
    expect([o.visualMap.min, o.visualMap.max]).toEqual([10, 30]);
  });

  it("celdas [x, y, %, inasistidas, asignadas] con tinta según la oscuridad", () => {
    expect(o.series[0].data.map((d: any) => d.value)).toEqual([
      [0, 0, 10, 1, 10],
      [1, 1, 30, 3, 10],
    ]);
    expect(o.series[0].data[0].label.color).not.toBe("#fff");
    expect(o.series[0].data[1].label.color).toBe("#fff");
  });
});

describe("opcionesArbol", () => {
  const nodo = (area: string): NodoArea => ({
    area,
    ...indicadores({ ...metricasVacias(), inasistidas: 5, disponibles: 5, asignadas: 50, ofertadas: 60 }),
    servicios: [{ codigo: "11", nombre: "CONSULTA", ...indicadores({ ...metricasVacias(), inasistidas: 5, disponibles: 5 }) }],
  });

  it("color por área del catálogo y hojas con su código", () => {
    const o: any = opcionesArbol([nodo("B")], ["A", "B"], null);
    expect(o.series[0].data[0].itemStyle.color).toBe(COLORES_AREA[1]);
    expect(o.series[0].data[0].value).toBe(10);
    expect(o.series[0].data[0].children[0]).toMatchObject({ name: "CONSULTA", value: 10, codigo: "11" });
    expect(o.series[0].leafDepth).toBe(1);
  });

  it("con un área seleccionada dibuja solo sus servicios, sin zoom ni miga de pan", () => {
    const o: any = opcionesArbol([nodo("A"), nodo("B")], ["A", "B"], "B");
    expect(o.series[0].data).toHaveLength(1);
    expect(o.series[0].data[0]).toMatchObject({ name: "CONSULTA", codigo: "11", value: 10 });
    expect(o.series[0].data[0].itemStyle.color).toBe(COLORES_AREA[1]);
    expect(o.series[0].nodeClick).toBe(false);
    expect(o.series[0].breadcrumb.show).toBe(false);
  });

  it("con un servicio filtrado lo resalta y atenúa los demás", () => {
    const area: NodoArea = {
      ...nodo("A"),
      servicios: [nodo("A").servicios[0], { ...nodo("A").servicios[0], codigo: "12", nombre: "CONTROL" }],
    };
    const o: any = opcionesArbol([area], ["A"], "A", "12");
    const [consulta, control] = o.series[0].data;
    expect(control.itemStyle.opacity).toBe(1);
    expect(consulta.itemStyle.opacity).toBeLessThan(1);
  });
});

describe("opcionesCalor sin datos en algunas áreas", () => {
  it("omite las áreas sin celdas para no dejar filas vacías", () => {
    const o: any = opcionesCalor(
      {
        areas: ["A", "B", "C"],
        periodos: [{ clave: "1", etiqueta: "Ene" }],
        celdas: [{ area: "B", clave: "1", pct_inasistencia: 0.2, inasistidas: 2, asignadas: 10 }],
      },
      "B"
    );
    expect(o.yAxis.data).toEqual(["B"]);
    expect(o.series[0].data[0].value.slice(0, 2)).toEqual([0, 0]);
  });
});

function prof(documento: string, asignadas: number, inasistidas: number, disponibles = 0, nombre = `PROFESIONAL ${documento}`): ResumenProfesional {
  return {
    documento,
    nombre,
    area_principal: "Medicina general",
    ...indicadores({ ...metricasVacias(), ofertadas: asignadas + disponibles, asignadas, inasistidas, disponibles }),
  };
}

describe("opcionesDispersion", () => {
  // Promedio: 70 / 440 = 15,9 %; mediana de volumen 100; máximo 300 → eje hasta 1.000
  const puntos = [prof("1", 100, 10, 0), prof("2", 300, 60, 40), prof("3", 40, 0, 10)];
  const o: any = opcionesDispersion(puntos);

  it("eje x logarítmico de 10 a la siguiente potencia de 10; eje y en %", () => {
    expect(o.xAxis).toMatchObject({ type: "log", min: 10, max: 1000 });
    expect(o.yAxis).toMatchObject({ type: "value", min: 0 });
  });

  it("un punto por profesional: [asignadas, % inasistencia] y su documento", () => {
    expect(o.series[0].data.map((d: any) => [d.value, d.documento])).toEqual([
      [[100, 10], "1"],
      [[300, 20], "2"],
      [[40, 0], "3"],
    ]);
  });

  it("el tamaño crece con la raíz de las disponibles", () => {
    const [sinDisp, maxDisp, cuartoDisp] = o.series[0].data.map((d: any) => d.symbolSize);
    expect(sinDisp).toBe(8);
    expect(maxDisp).toBe(34);
    expect(cuartoDisp).toBeCloseTo(8 + 26 * 0.5);
  });

  it("líneas punteadas en el promedio (con etiqueta) y la mediana de volumen (sin etiqueta)", () => {
    const ml = o.series[0].markLine;
    expect(ml.lineStyle.type).toBe("dashed");
    expect(ml.data[0].yAxis).toBeCloseTo(15.9, 1);
    expect(ml.data[0].label.formatter).toBe("Promedio 15,9 %");
    expect(ml.data[1]).toMatchObject({ xAxis: 100, label: { show: false } });
  });

  it("cuadrantes de alto volumen con alta (rojizo) y baja (verdoso) inasistencia", () => {
    const [baja, alta] = o.series[0].markArea.data;
    expect(baja[0]).toMatchObject({ name: "Alto volumen, baja inasistencia", xAxis: 100, yAxis: 0 });
    expect(baja[1]).toMatchObject({ xAxis: 1000 });
    expect(baja[0].itemStyle.color).toMatch(/^rgba\(12,163,12/);
    expect(alta[0]).toMatchObject({ name: "Alto volumen, alta inasistencia", xAxis: 100 });
    expect(alta[1]).toMatchObject({ xAxis: 1000, yAxis: "max" });
    expect(alta[0].itemStyle.color).toMatch(/^rgba\(208,59,59/);
  });

  it("tooltip con nombre, área principal, asignadas, inasistidas, % y disponibles", () => {
    const t = o.tooltip.formatter({ dataIndex: 1 });
    for (const s of ["PROFESIONAL 2", "Medicina general", "300", "60", "20,0 %", "40"]) expect(t).toContain(s);
  });

  it("sin puntos no dibuja líneas ni cuadrantes", () => {
    const v: any = opcionesDispersion([]);
    expect(v.series[0].data).toEqual([]);
    expect(v.series[0].markLine.data).toEqual([]);
    expect(v.series[0].markArea.data).toEqual([]);
  });
});

describe("opcionesPareto", () => {
  // Perdidas: A 50, B 30, C 15, D 5 → corte 80 %: A y B
  const r = pareto([prof("A", 100, 20, 30), prof("B", 50, 10, 20), prof("C", 10, 5, 10), prof("D", 10, 5, 0)]);
  const o: any = opcionesPareto(r.filas);

  it("barras horizontales apiladas, sin doble eje, la mayor arriba", () => {
    expect(o.series.map((s: any) => [s.name, s.type, s.stack])).toEqual([
      ["Inasistidas", "bar", "perdidas"],
      ["Disponibles", "bar", "perdidas"],
    ]);
    expect(Array.isArray(o.xAxis)).toBe(false);
    expect(o.yAxis).toMatchObject({ type: "category", inverse: true });
    expect(o.yAxis.data).toEqual(["PROFESIONAL A", "PROFESIONAL B", "PROFESIONAL C", "PROFESIONAL D"]);
    expect(o.series[0].data.map((d: any) => d.value)).toEqual([20, 10, 5, 5]);
    expect(o.series[1].data.map((d: any) => d.value)).toEqual([30, 20, 10, 0]);
  });

  it("los del 80 % en tonos más oscuros", () => {
    const [dentro, , fuera] = o.series[0].data;
    expect(dentro.itemStyle.color).not.toBe(fuera.itemStyle.color);
    expect(o.series[1].data[0].itemStyle.color).not.toBe(o.series[1].data[2].itemStyle.color);
  });

  it("etiqueta a la derecha: citas perdidas · acumulado", () => {
    expect(o.series[1].label.formatter({ dataIndex: 1 })).toBe("30 · 80 %");
  });

  it("solo los 15 primeros y nombres largos recortados", () => {
    const muchos = pareto(Array.from({ length: 20 }, (_, i) => prof(String(i), 10, 1, 0, `${"X".repeat(30)}${i}`)));
    const v: any = opcionesPareto(muchos.filas);
    expect(v.yAxis.data).toHaveLength(15);
    expect(v.yAxis.data[0]).toHaveLength(24);
    expect(v.yAxis.data[0].endsWith("…")).toBe(true);
  });
});

describe("opcionesServiciosFicha", () => {
  const servicio = (codigo: string, asignadas: number, inasistidas: number): NodoServicio => ({
    codigo,
    nombre: `SERVICIO ${codigo}`,
    ...indicadores({ ...metricasVacias(), asignadas, inasistidas }),
  });
  const o: any = opcionesServiciosFicha([servicio("11", 100, 10), servicio("12", 40, 20)]);

  it("atendidas (asignadas − inasistidas) apiladas con inasistidas", () => {
    expect(o.series.map((s: any) => s.name)).toEqual(["Atendidas", "Inasistidas"]);
    expect(o.series[0].data).toEqual([90, 20]);
    expect(o.series[1].data).toEqual([10, 20]);
    expect(o.yAxis.data).toEqual(["SERVICIO 11", "SERVICIO 12"]);
  });

  it("etiqueta el % de inasistencia de cada servicio", () => {
    expect(o.series[1].label.formatter({ dataIndex: 1 })).toBe("50 %");
  });
});

describe("opcionesTendenciaFicha", () => {
  it("la tendencia del profesional sin zoom y con la meta", () => {
    const o: any = opcionesTendenciaFicha(SERIE, "202610");
    expect(o.dataZoom).toBeUndefined();
    expect(o.series[0].data).toEqual([10, null, 15]);
    expect(o.series[0].markLine.data).toEqual([{ yAxis: 10 }]);
  });
});
