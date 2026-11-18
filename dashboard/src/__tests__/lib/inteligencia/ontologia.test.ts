import {
  OBJETOS,
  RELACIONES,
  TIPOS_OBJETO,
  colorTipo,
  defRelacion,
  defTipo,
  esClaveValida,
  esTipoObjeto,
  idNodo,
  parseIdNodo,
  VISTA_CATEGORIA,
} from "@/lib/inteligencia/ontologia";
import { CATEGORIAS } from "@/lib/cumplimiento/categorias";
import { isAllowedView } from "@/lib/view-registry";
import { COLORES_AREA } from "@/lib/productividad/presentacion";

describe("tipos de objeto", () => {
  it("define los 7 tipos en un orden fijo", () => {
    expect(TIPOS_OBJETO).toEqual([
      "area", "servicio", "profesional", "especialidad", "programa", "categoria", "regional",
    ]);
    expect(OBJETOS.map((o) => o.clave)).toEqual(TIPOS_OBJETO);
  });

  it("cada tipo tiene etiqueta, plural, descripción y llave", () => {
    for (const o of OBJETOS) {
      expect(o.etiqueta).not.toBe("");
      expect(o.plural).not.toBe("");
      expect(o.descripcion).not.toBe("");
      expect(o.llave).not.toBe("");
    }
    expect(defTipo("servicio").etiqueta).toBe("Servicio");
  });

  it("el color sigue la posición del tipo en la paleta categórica", () => {
    TIPOS_OBJETO.forEach((t, i) => expect(colorTipo(t)).toBe(COLORES_AREA[i]));
  });

  it("esTipoObjeto reconoce solo los tipos definidos", () => {
    expect(esTipoObjeto("profesional")).toBe(true);
    expect(esTipoObjeto("paciente")).toBe(false);
    expect(esTipoObjeto(3)).toBe(false);
  });
});

describe("tipos de relación", () => {
  it("cada relación une dos tipos definidos y su peso es una de sus métricas", () => {
    for (const r of RELACIONES) {
      expect(esTipoObjeto(r.origen)).toBe(true);
      expect(esTipoObjeto(r.destino)).toBe(true);
      expect(r.metricas.map((m) => m.clave)).toContain(r.peso);
      expect(r.etiqueta).not.toBe("");
      expect(r.fuente).not.toBe("");
    }
  });

  it("modela las relaciones pedidas", () => {
    const pares = RELACIONES.map((r) => `${r.origen}>${r.destino}`);
    expect(pares).toEqual([
      "servicio>area",
      "profesional>servicio",
      "profesional>especialidad",
      "especialidad>programa",
      "programa>categoria",
      "profesional>categoria",
      "categoria>regional",
    ]);
    expect(defRelacion("atiende").metricas.map((m) => m.clave)).toEqual([
      "asignadas", "inasistidas", "pct_inasistencia", "disponibles",
    ]);
  });

  it("cada categoría de autorización tiene su vista vm_dash_* registrada", () => {
    expect(Object.keys(VISTA_CATEGORIA).sort()).toEqual(CATEGORIAS.map((c) => c.clave).sort());
    for (const vista of Object.values(VISTA_CATEGORIA)) expect(isAllowedView(vista)).toBe(true);
  });
});

describe("identificadores de nodo", () => {
  it("arma y separa tipo:clave (la clave puede tener dos puntos)", () => {
    expect(idNodo("servicio", "152")).toBe("servicio:152");
    expect(parseIdNodo("especialidad:A: B")).toEqual({ tipo: "especialidad", clave: "A: B" });
    expect(parseIdNodo("paciente:1")).toBeNull();
    expect(parseIdNodo("servicio:")).toBeNull();
    expect(parseIdNodo("sin-separador")).toBeNull();
  });

  it.each<[string, string, boolean]>([
    ["profesional", "1053", true],
    ["profesional", "10a", false],
    ["profesional", "1234567890123456", false],
    ["servicio", "890201-1", true],
    ["servicio", "a b", false],
    ["categoria", "rx", true],
    ["categoria", "otra", false],
    ["area", "Salud oral", true],
    ["especialidad", "MEDICINA INTERNA", true],
    ["regional", "x".repeat(151), false],
    ["programa", " ", false],
    ["area", "con\nsalto", false],
  ])("esClaveValida(%s, %s) = %s", (tipo, clave, esperado) => {
    expect(esClaveValida(tipo as never, clave)).toBe(esperado);
  });
});
