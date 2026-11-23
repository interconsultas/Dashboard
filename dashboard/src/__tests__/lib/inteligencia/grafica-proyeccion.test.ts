import { opcionesProyeccion } from "@/lib/inteligencia/graficaProyeccion";
import type { SerieProyectada } from "@/lib/inteligencia/alertas";

const SERIE: SerieProyectada = {
  id: "Psicosocial",
  nombre: "Psicosocial",
  area: "Psicosocial",
  asignadas_ultimo: 1000,
  historia: [
    { clave: "202608", etiqueta: "Ago 2026", valor: 0.1 },
    { clave: "202609", etiqueta: "Sep 2026", valor: null },
    { clave: "202610", etiqueta: "Oct 2026", valor: 0.14 },
  ],
  inasistencia: { valor: 0.16, min: 0.13, max: 0.19, error: 0.03, pendiente: 0.02, direccion: "sube", periodos: 2 },
  asignadas: null,
};
const SIGUIENTE = { clave: "202611", etiqueta: "Nov 2026", etiqueta_larga: "Noviembre 2026" };

type Serie = { name: string; data: (number | null)[]; markLine?: { data: { yAxis: number }[] } };

describe("opcionesProyeccion", () => {
  const o = opcionesProyeccion(SERIE, SIGUIENTE, 0.1, "#2a78d6") as unknown as { xAxis: { data: string[] }; series: Serie[] };
  const serie = (n: string) => o.series.find((s) => s.name === n)!;

  it("eje: historia + el periodo proyectado", () => {
    expect(o.xAxis.data).toEqual(["Ago 2026", "Sep 2026", "Oct 2026", "Nov 2026"]);
  });

  it("historia con huecos, proyección punteada desde el último dato y meta como línea", () => {
    expect(serie("Inasistencia").data).toEqual([0.1, null, 0.14, null]);
    expect(serie("Proyección").data).toEqual([null, null, 0.14, 0.16]);
    expect(serie("Inasistencia").markLine!.data[0].yAxis).toBe(0.1);
  });

  it("banda del rango: base = mínimo y ancho = máximo − mínimo, desde el último dato", () => {
    expect(serie("Rango base").data).toEqual([null, null, 0.14, 0.13]);
    const ancho = serie("Rango").data;
    expect(ancho.slice(0, 3)).toEqual([null, null, 0]);
    expect(ancho[3]).toBeCloseTo(0.06);
  });

  it("sin proyección solo dibuja la historia", () => {
    const sin = opcionesProyeccion({ ...SERIE, inasistencia: null }, SIGUIENTE, 0.1, "#000") as unknown as { xAxis: { data: string[] }; series: Serie[] };
    expect(sin.xAxis.data).toHaveLength(3);
    expect(sin.series.map((s) => s.name)).toEqual(["Inasistencia"]);
  });
});
