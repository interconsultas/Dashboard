import {
  opcionesArbol,
  opcionesCalor,
  opcionesEmbudo,
  opcionesSparkline,
  opcionesTendencia,
} from "@/lib/productividad/graficas";
import { indicadores, metricasVacias } from "@/lib/productividad/metricas";
import { COLORES_AREA } from "@/lib/productividad/presentacion";
import type { NodoArea, PuntoSerie } from "@/lib/productividad/tipos";

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
