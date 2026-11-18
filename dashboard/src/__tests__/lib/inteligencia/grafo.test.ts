import {
  buscar,
  construirGrafo,
  esquema,
  vecindario,
  type DatosGrafo,
  type Nodo,
} from "@/lib/inteligencia/grafo";

/** Datos mínimos de un periodo: 2 áreas, 3 servicios, 3 profesionales (uno fuera del catálogo). */
function datos(extra: Partial<DatosGrafo> = {}): DatosGrafo {
  return {
    areas: ["Medicina general", "Salud oral", "Vacunación"],
    atiende: [
      { documento: "1", nombre: "PROFESIONAL UNO", codigo_servicio: "11", nombre_servicio: "CONSULTA", area: "Medicina general", asignadas: 100, inasistidas: 10, disponibles: 5 },
      { documento: "1", nombre: "PROFESIONAL UNO", codigo_servicio: "12", nombre_servicio: "CONTROL", area: "Medicina general", asignadas: 40, inasistidas: 2, disponibles: 0 },
      { documento: "2", nombre: "PROFESIONAL DOS", codigo_servicio: "11", nombre_servicio: "CONSULTA", area: "Medicina general", asignadas: 60, inasistidas: 12, disponibles: 3 },
      { documento: "2", nombre: "PROFESIONAL DOS", codigo_servicio: "20", nombre_servicio: "ODONTOLOGIA", area: "Salud oral", asignadas: 80, inasistidas: 0, disponibles: 1 },
      { documento: "3", nombre: "PROFESIONAL TRES", codigo_servicio: "20", nombre_servicio: "ODONTOLOGIA", area: "Salud oral", asignadas: 0, inasistidas: 0, disponibles: 9 },
    ],
    medicos: [
      { documento: "1", especialidad: "MÉDICO GENERAL INTEGRADOR" },
      { documento: "2", especialidad: "ODONTOLOGÍA" },
      { documento: "99", especialidad: "PEDIATRÍA" }, // sin citas en el periodo
    ],
    mapeo: [
      { especialidad: "MÉDICO GENERAL INTEGRADOR", programa: "PROGRAMADA" },
      { especialidad: "PEDIATRÍA", programa: "PEDIATRÍA" },
    ],
    metas: [
      { programa: "PROGRAMADA", categoria: "medicamentos", valor_meta: 2.5, escala: "ratio" },
      { programa: "PROGRAMADA", categoria: "rx", valor_meta: 4.3, escala: "x100" },
    ],
    ordenes: [
      { documento: "1", categoria: "medicamentos", ordenes: 250, cantidad: 900 },
      { documento: "1", categoria: "rx", ordenes: 5, cantidad: 5 },
      { documento: "2", categoria: "medicamentos", ordenes: 30, cantidad: 60 },
    ],
    regionales: [
      { categoria: "medicamentos", regional: "CENTRO", ordenes: 300, cantidad: 1000 },
      { categoria: "medicamentos", regional: null, ordenes: 20, cantidad: 40 },
      { categoria: "rx", regional: "CENTRO", ordenes: 5, cantidad: 5 },
    ],
    ...extra,
  };
}

function nodo(g: ReturnType<typeof construirGrafo>, id: string): Nodo {
  const n = g.nodos.get(id);
  if (!n) throw new Error(`No existe ${id}`);
  return n;
}

function prop(n: Nodo, etiqueta: string) {
  return n.propiedades.find((p) => p.etiqueta === etiqueta)?.valor;
}

describe("construirGrafo — nodos", () => {
  const g = construirGrafo(datos());

  it("crea las instancias de cada tipo", () => {
    const porTipo = (t: string) => Array.from(g.nodos.values()).filter((n) => n.tipo === t).map((n) => n.clave).sort();
    expect(porTipo("area")).toEqual(["Medicina general", "Salud oral", "Vacunación"]);
    expect(porTipo("servicio")).toEqual(["11", "12", "20"]);
    expect(porTipo("profesional")).toEqual(["1", "2", "3"]);
    // La especialidad del médico sin citas no aparece por él, pero sí por el mapeo
    expect(porTipo("especialidad")).toEqual(["MÉDICO GENERAL INTEGRADOR", "ODONTOLOGÍA", "PEDIATRÍA"]);
    expect(porTipo("programa")).toEqual(["PEDIATRÍA", "PROGRAMADA"]);
    expect(porTipo("categoria")).toHaveLength(7);
    expect(porTipo("regional")).toEqual(["CENTRO", "Sin regional"]);
  });

  it("pesa servicios, áreas y profesionales por citas asignadas", () => {
    expect(nodo(g, "servicio:11").peso).toBe(160);
    expect(nodo(g, "area:Medicina general").peso).toBe(200);
    expect(nodo(g, "area:Vacunación").peso).toBe(0);
    expect(nodo(g, "profesional:2").peso).toBe(140);
    expect(nodo(g, "especialidad:MÉDICO GENERAL INTEGRADOR").peso).toBe(140);
    expect(nodo(g, "programa:PROGRAMADA").peso).toBe(140);
  });

  it("pesa categorías y regionales por órdenes del periodo", () => {
    expect(nodo(g, "categoria:medicamentos").peso).toBe(320);
    expect(nodo(g, "regional:CENTRO").peso).toBe(305);
  });

  it("usa el nombre de las citas y la etiqueta de la categoría", () => {
    expect(nodo(g, "profesional:1").etiqueta).toBe("PROFESIONAL UNO");
    expect(nodo(g, "servicio:20").etiqueta).toBe("ODONTOLOGIA");
    expect(nodo(g, "categoria:rx").etiqueta).toBe("Radiografías");
  });

  it("propiedades del profesional: área principal, especialidad, programa, inasistencia y órdenes", () => {
    const p = nodo(g, "profesional:1");
    expect(prop(p, "Documento")).toBe("1");
    expect(prop(p, "Área principal")).toBe("Medicina general");
    expect(prop(p, "Especialidad")).toBe("MÉDICO GENERAL INTEGRADOR");
    expect(prop(p, "Programa de metas")).toBe("PROGRAMADA");
    expect(prop(p, "Citas asignadas")).toBe(140);
    expect(prop(p, "Inasistidas")).toBe(12);
    expect(prop(p, "% inasistencia")).toBeCloseTo(12 / 140);
    expect(prop(p, "Órdenes · Medicamentos")).toBe(250);
    expect(prop(p, "Órdenes · Radiografías")).toBe(5);
    expect(prop(p, "Órdenes · Laboratorios")).toBeUndefined();
  });

  it("el área principal desempata por el orden de las áreas", () => {
    const g2 = construirGrafo(datos({
      atiende: [
        { documento: "5", nombre: "P", codigo_servicio: "20", nombre_servicio: "ODONTOLOGIA", area: "Salud oral", asignadas: 10, inasistidas: 0, disponibles: 0 },
        { documento: "5", nombre: "P", codigo_servicio: "11", nombre_servicio: "CONSULTA", area: "Medicina general", asignadas: 10, inasistidas: 0, disponibles: 0 },
      ],
    }));
    expect(prop(nodo(g2, "profesional:5"), "Área principal")).toBe("Medicina general");
  });

  it("marca al profesional fuera del catálogo de médicos y sin asignadas no tiene % inasistencia", () => {
    const p = nodo(g, "profesional:3");
    expect(prop(p, "Especialidad")).toBe("Fuera del catálogo de médicos");
    expect(prop(p, "Programa de metas")).toBe("Sin programa");
    expect(prop(p, "% inasistencia")).toBeNull();
  });

  it("la categoría separa las órdenes atribuidas a profesionales de las demás", () => {
    const c = nodo(g, "categoria:medicamentos");
    expect(prop(c, "Órdenes")).toBe(320);
    expect(prop(c, "Atribuidas a profesionales con citas")).toBe(280);
    expect(prop(c, "Sin profesional con citas")).toBe(40);
    expect(prop(c, "Escala de la meta")).toBe("Órdenes por cita");
  });
});

describe("construirGrafo — aristas", () => {
  const g = construirGrafo(datos());
  const arista = (relacion: string, origen: string, destino: string) =>
    g.aristas.find((a) => a.relacion === relacion && a.origen === origen && a.destino === destino);

  it("servicio → área con las asignadas del servicio", () => {
    expect(arista("pertenece_a", "servicio:11", "area:Medicina general")?.peso).toBe(160);
  });

  it("profesional → servicio con métricas y % de inasistencia", () => {
    const a = arista("atiende", "profesional:2", "servicio:11");
    expect(a?.peso).toBe(60);
    expect(a?.metricas).toEqual({ asignadas: 60, inasistidas: 12, pct_inasistencia: 0.2, disponibles: 3 });
  });

  it("profesional → especialidad solo para los del catálogo", () => {
    expect(arista("tiene_especialidad", "profesional:1", "especialidad:MÉDICO GENERAL INTEGRADOR")?.peso).toBe(140);
    expect(g.aristas.filter((a) => a.relacion === "tiene_especialidad")).toHaveLength(2);
  });

  it("especialidad → programa con el número de profesionales activos", () => {
    expect(arista("cuenta_en_programa", "especialidad:MÉDICO GENERAL INTEGRADOR", "programa:PROGRAMADA")?.metricas).toEqual({ profesionales: 1 });
    expect(arista("cuenta_en_programa", "especialidad:PEDIATRÍA", "programa:PEDIATRÍA")?.peso).toBe(0);
  });

  it("programa → categoría con la meta", () => {
    expect(arista("tiene_meta", "programa:PROGRAMADA", "categoria:rx")?.metricas).toEqual({ valor_meta: 4.3 });
  });

  it("profesional → categoría con órdenes y cantidad; omite órdenes en cero", () => {
    expect(arista("ordena", "profesional:1", "categoria:medicamentos")?.metricas).toEqual({ ordenes: 250, cantidad: 900 });
    const g2 = construirGrafo(datos({ ordenes: [{ documento: "1", categoria: "rx", ordenes: 0, cantidad: 0 }] }));
    expect(g2.aristas.filter((a) => a.relacion === "ordena")).toHaveLength(0);
  });

  it("ignora órdenes de profesionales que no están en el grafo y categorías desconocidas", () => {
    const g2 = construirGrafo(datos({
      ordenes: [
        { documento: "777", categoria: "rx", ordenes: 3, cantidad: 3 },
        { documento: "1", categoria: "otra", ordenes: 3, cantidad: 3 },
      ],
      regionales: [{ categoria: "otra", regional: "CENTRO", ordenes: 3, cantidad: 3 }],
    }));
    expect(g2.aristas.filter((a) => a.relacion === "ordena")).toHaveLength(0);
    expect(g2.nodos.has("regional:CENTRO")).toBe(false);
  });

  it("categoría → regional con las órdenes", () => {
    expect(arista("autorizada_en", "categoria:medicamentos", "regional:Sin regional")?.peso).toBe(20);
  });

  it("indexa las aristas por nodo", () => {
    expect(g.porNodo.get("profesional:1")?.map((a) => a.relacion).sort()).toEqual([
      "atiende", "atiende", "ordena", "ordena", "tiene_especialidad",
    ]);
  });
});

describe("vecindario", () => {
  const g = construirGrafo(datos());

  it("devuelve el centro, sus vecinos y las aristas entre ellos", () => {
    const v = vecindario(g, "servicio:11", 25)!;
    expect(v.centro.id).toBe("servicio:11");
    expect(v.nodos.map((n) => n.id).sort()).toEqual(
      ["area:Medicina general", "profesional:1", "profesional:2", "servicio:11"].sort(),
    );
    expect(v.aristas.map((a) => a.id).sort()).toEqual([
      "atiende|profesional:1|servicio:11",
      "atiende|profesional:2|servicio:11",
      "pertenece_a|servicio:11|area:Medicina general",
    ]);
    expect(v.mas).toEqual([]);
  });

  it("toma los N de más peso por tipo de relación y cuenta los demás", () => {
    const v = vecindario(g, "area:Medicina general", 1)!;
    expect(v.nodos.map((n) => n.id)).toEqual(["area:Medicina general", "servicio:11"]);
    expect(v.mas).toEqual([{ relacion: "pertenece_a", tipo: "servicio", mostrados: 1, total: 2 }]);
  });

  it("el centro siempre va primero y un nodo inexistente da null", () => {
    expect(vecindario(g, "categoria:rx", 25)!.nodos[0].id).toBe("categoria:rx");
    expect(vecindario(g, "profesional:404", 25)).toBeNull();
  });
});

describe("esquema", () => {
  it("cuenta instancias por tipo y aristas por relación", () => {
    const e = esquema(construirGrafo(datos()));
    expect(e.tipos.map((t) => [t.clave, t.cantidad])).toEqual([
      ["area", 3], ["servicio", 3], ["profesional", 3], ["especialidad", 3],
      ["programa", 2], ["categoria", 7], ["regional", 2],
    ]);
    expect(Object.fromEntries(e.relaciones.map((r) => [r.clave, r.cantidad]))).toEqual({
      pertenece_a: 3, atiende: 5, tiene_especialidad: 2, cuenta_en_programa: 2,
      tiene_meta: 2, ordena: 3, autorizada_en: 3,
    });
    expect(e.tipos[0].color).toMatch(/^#/);
  });
});

describe("buscar", () => {
  const g = construirGrafo(datos());

  it("encuentra por nombre sin tildes ni mayúsculas, en todos los tipos", () => {
    const r = buscar(g, { q: "odontologia", tipo: null, limite: 20 });
    // Ambas coinciden exacto: gana la de más peso (la especialidad suma todas las citas de sus profesionales)
    expect(r.map((x) => x.id)).toEqual(["especialidad:ODONTOLOGÍA", "servicio:20"]);
  });

  it("encuentra por documento y por código", () => {
    expect(buscar(g, { q: "2", tipo: null, limite: 20 }).map((x) => x.id)[0]).toBe("profesional:2");
    expect(buscar(g, { q: "12", tipo: "servicio", limite: 20 }).map((x) => x.id)).toEqual(["servicio:12"]);
  });

  it("prioriza coincidencia exacta, luego inicio, luego peso", () => {
    // Mismo inicio y mismo peso (140): desempata el nombre
    const r = buscar(g, { q: "profesional", tipo: null, limite: 20 });
    expect(r.map((x) => x.id)).toEqual(["profesional:2", "profesional:1", "profesional:3"]);
    expect(buscar(g, { q: "consulta", tipo: null, limite: 20 }).map((x) => x.id)).toEqual(["servicio:11"]);
  });

  it("sin texto lista las instancias del tipo por peso", () => {
    const r = buscar(g, { q: "", tipo: "area", limite: 2 });
    expect(r.map((x) => x.clave)).toEqual(["Medicina general", "Salud oral"]);
    expect(r[0]).toMatchObject({ tipo: "area", etiqueta: "Medicina general", peso: 200 });
  });

  it("respeta el límite y el filtro de tipo", () => {
    expect(buscar(g, { q: "a", tipo: null, limite: 3 })).toHaveLength(3);
    expect(buscar(g, { q: "a", tipo: "regional", limite: 20 }).every((x) => x.tipo === "regional")).toBe(true);
  });
});
