import { opcionesComparacion, METRICAS_GRAFICA } from "@/lib/inteligencia/graficaSimulador";
import { compararEscenario, palancasBase, resultadoBase, simular } from "@/lib/inteligencia/simulador";

const BASE = { ofertadas: 1000, disponibles: 100, asignadas: 900, inasistidas: 180, profesionales: 10 };

describe("opcionesComparacion", () => {
  const comparacion = compararEscenario(
    resultadoBase(BASE),
    simular(BASE, { ...palancasBase(BASE), deltaProfesionales: 5, pctInasistencia: 0.1 })
  );
  const op = opcionesComparacion(comparacion) as any;

  it("barras horizontales: una categoría por métrica, un solo eje de valores", () => {
    expect(METRICAS_GRAFICA.map((m) => m.clave)).toEqual(["ofertadas", "asignadas", "atendidas", "inasistidas", "disponibles"]);
    expect(op.yAxis.type).toBe("category");
    expect(op.yAxis.data).toEqual(["Ofertadas", "Asignadas", "Atendidas", "Inasistidas", "Disponibles"]);
    expect(op.xAxis.type).toBe("value");
    expect(Array.isArray(op.xAxis)).toBe(false);
  });

  it("dos series, Actual y Escenario, con leyenda", () => {
    expect(op.series.map((s: any) => [s.type, s.name])).toEqual([
      ["bar", "Actual"],
      ["bar", "Escenario"],
    ]);
    expect(op.series[0].data).toEqual([1000, 900, 720, 180, 100]);
    expect(op.series[1].data).toEqual([1500, 1350, 1215, 135, 150]);
    expect(op.legend.data).toEqual(["Actual", "Escenario"]);
  });

  it("el tooltip muestra ambos valores y la diferencia", () => {
    const html = op.tooltip.formatter([{ dataIndex: 0 }]);
    expect(html).toContain("Ofertadas");
    expect(html).toContain("1.000");
    expect(html).toContain("1.500");
    expect(html).toContain("+500");
  });
});
