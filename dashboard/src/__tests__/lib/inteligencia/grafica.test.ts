import { fusionarSubgrafos, opcionesEsquema, opcionesInstancias, type Subgrafo } from "@/lib/inteligencia/grafica";
import { colorTipo, TIPOS_OBJETO } from "@/lib/inteligencia/ontologia";
import type { Arista, Esquema, Nodo } from "@/lib/inteligencia/grafo";
import { OBJETOS, RELACIONES } from "@/lib/inteligencia/ontologia";

/* eslint-disable @typescript-eslint/no-explicit-any -- se inspecciona la opción de ECharts */

const n = (id: string, peso: number, etiqueta = id): Nodo => {
  const [tipo, clave] = id.split(":");
  return { id, tipo: tipo as Nodo["tipo"], clave, etiqueta, peso, propiedades: [] };
};
const a = (relacion: Arista["relacion"], origen: string, destino: string, peso: number): Arista => ({
  id: `${relacion}|${origen}|${destino}`, relacion, origen, destino, peso, metricas: { asignadas: peso },
});

const SUB: Subgrafo = {
  nodos: [n("servicio:11", 160, "CONSULTA"), n("profesional:1", 140, "UNO"), n("profesional:2", 35, "DOS"), n("area:MG", 200, "Medicina general")],
  aristas: [a("atiende", "profesional:1", "servicio:11", 100), a("atiende", "profesional:2", "servicio:11", 25), a("pertenece_a", "servicio:11", "area:MG", 160)],
};

function serie(op: any) {
  return op.series[0];
}

describe("opcionesInstancias", () => {
  const op: any = opcionesInstancias(SUB, "servicio:11");

  it("grafo de fuerza con una categoría por tipo, en orden fijo y con su color", () => {
    const s = serie(op);
    expect(s.type).toBe("graph");
    expect(s.layout).toBe("force");
    expect(s.roam).toBe(true);
    expect(s.categories.map((c: any) => c.itemStyle.color)).toEqual(TIPOS_OBJETO.map(colorTipo));
  });

  it("nodos con su id, tipo y categoría; el centro resaltado y con etiqueta", () => {
    const datos = serie(op).data;
    expect(datos.map((d: any) => d.id)).toEqual(["servicio:11", "profesional:1", "profesional:2", "area:MG"]);
    expect(datos[0]).toMatchObject({ name: "CONSULTA", category: TIPOS_OBJETO.indexOf("servicio"), value: 160 });
    expect(datos[0].label.show).toBe(true);
    expect(datos[0].itemStyle.borderWidth).toBeGreaterThan(0);
    expect(datos[1].itemStyle).toBeUndefined();
  });

  it("el tamaño crece con el peso dentro de cada tipo", () => {
    const [, uno, dos] = serie(op).data;
    expect(uno.symbolSize).toBeGreaterThan(dos.symbolSize);
  });

  it("aristas por índice, grosor según el peso y etiqueta de la relación al pasar el cursor", () => {
    const links = serie(op).links;
    expect(links[0]).toMatchObject({ source: 1, target: 0, value: 100, relacion: "atiende" });
    expect(links[0].lineStyle.width).toBeGreaterThan(links[1].lineStyle.width);
    expect(serie(op).edgeLabel.show).toBe(false);
    expect(serie(op).emphasis.edgeLabel.show).toBe(true);
    expect(serie(op).edgeLabel.formatter({ data: links[0] })).toBe("atiende");
  });

  it("descarta aristas cuyos extremos no están en el subgrafo", () => {
    const op2: any = opcionesInstancias({ ...SUB, aristas: [...SUB.aristas, a("ordena", "profesional:9", "categoria:rx", 3)] }, null);
    expect(serie(op2).links).toHaveLength(3);
  });

  it("el tooltip describe nodos y aristas", () => {
    const f = op.tooltip.formatter;
    expect(f({ dataType: "node", data: serie(op).data[0] })).toContain("Servicio");
    const t = f({ dataType: "edge", data: serie(op).links[0] });
    expect(t).toContain("UNO");
    expect(t).toContain("atiende");
    expect(t).toContain("CONSULTA");
    expect(t).toContain("Citas asignadas");
  });
});

describe("opcionesEsquema", () => {
  const ESQ: Esquema = {
    tipos: OBJETOS.map((o, i) => ({ ...o, color: colorTipo(o.clave), cantidad: i * 10 })),
    relaciones: RELACIONES.map((r) => ({ ...r, cantidad: 5 })),
  };
  const op: any = opcionesEsquema(ESQ);

  it("un nodo por tipo con su conteo y una arista por relación con su etiqueta visible", () => {
    const s = serie(op);
    expect(s.data.map((d: any) => d.tipo)).toEqual(TIPOS_OBJETO);
    expect(s.data[2].name).toBe("Profesionales");
    expect(s.data[2].value).toBe(20);
    expect(s.links).toHaveLength(7);
    expect(s.links[1]).toMatchObject({ source: 2, target: 1 });
    expect(s.edgeLabel.show).toBe(true);
    expect(s.edgeLabel.formatter({ data: s.links[1] })).toBe("atiende");
  });
});

describe("fusionarSubgrafos", () => {
  it("une nodos y aristas sin repetir, conservando el orden del primero", () => {
    const extra: Subgrafo = {
      nodos: [n("profesional:1", 140, "UNO"), n("categoria:rx", 5)],
      aristas: [a("atiende", "profesional:1", "servicio:11", 100), a("ordena", "profesional:1", "categoria:rx", 5)],
    };
    const f = fusionarSubgrafos(SUB, extra);
    expect(f.nodos.map((x) => x.id)).toEqual(["servicio:11", "profesional:1", "profesional:2", "area:MG", "categoria:rx"]);
    expect(f.aristas).toHaveLength(4);
  });
});
