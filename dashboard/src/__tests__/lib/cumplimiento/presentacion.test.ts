import {
  estadoMeta,
  filtrarProfesionales,
  fmtPct,
  fmtTasa,
  ordenarRanking,
  puntosGrafica,
  serieDeCategoria,
  serieGlobal,
} from "@/lib/cumplimiento/presentacion";
import { construirCumplimiento, type ProfesionalCumplimiento } from "@/lib/cumplimiento/calcular";
import { contarSinPrograma, serieDeFilas } from "@/lib/cumplimiento/presentacion";

function prof(parcial: Partial<ProfesionalCumplimiento> & { documento: string; nombre: string }): ProfesionalCumplimiento {
  return { programa: "RCV", citas: 0, periodosConDatos: 1, pct: {}, global: null, ...parcial };
}

describe("fmtPct", () => {
  it("muestra el porcentaje sin decimales", () => {
    expect(fmtPct(1.3683164589470311)).toBe("137%");
    expect(fmtPct(0.5952659544331487)).toBe("60%");
    expect(fmtPct(1)).toBe("100%");
    expect(fmtPct(0)).toBe("0%");
  });

  it("muestra una raya cuando no hay dato", () => {
    expect(fmtPct(null)).toBe("—");
  });

  it("separa los miles en porcentajes muy altos", () => {
    expect(fmtPct(12.5)).toBe("1.250%");
  });
});

describe("estadoMeta", () => {
  it("sin dato → 'sin_datos'", () => {
    expect(estadoMeta(null)).toBe("sin_datos");
  });

  it("por encima del 100% → 'sobre'", () => {
    expect(estadoMeta(1.37)).toBe("sobre");
    expect(estadoMeta(1.006)).toBe("sobre");
  });

  it("en el 100% o por debajo → 'dentro'", () => {
    expect(estadoMeta(1)).toBe("dentro");
    expect(estadoMeta(0.6)).toBe("dentro");
    expect(estadoMeta(0)).toBe("dentro");
  });

  it("decide con el valor redondeado que se muestra, para no marcar un '100%' como excedido", () => {
    expect(fmtPct(1.004)).toBe("100%");
    expect(estadoMeta(1.004)).toBe("dentro");
  });
});

describe("fmtTasa", () => {
  it("muestra dos decimales con coma", () => {
    expect(fmtTasa(10.492537)).toBe("10,49");
    expect(fmtTasa(0)).toBe("0,00");
    expect(fmtTasa(5.746656734947238)).toBe("5,75");
  });

  it("muestra una raya cuando no hay dato", () => {
    expect(fmtTasa(null)).toBe("—");
  });
});

describe("puntosGrafica", () => {
  it("convierte cada periodo en un punto con etiquetas y el valor en puntos porcentuales", () => {
    expect(
      puntosGrafica([
        { periodo: 202512, valor: 0.5 },
        { periodo: 202601, valor: 1.3683164589470311 },
      ])
    ).toEqual([
      { periodo: 202512, etiqueta: "Dic 25", etiquetaLarga: "Dic 2025", pct: 50, texto: "50%" },
      { periodo: 202601, etiqueta: "Ene 26", etiquetaLarga: "Ene 2026", pct: 136.8, texto: "137%" },
    ]);
  });

  it("conserva los meses sin dato como null (no como 0)", () => {
    expect(puntosGrafica([{ periodo: 202602, valor: null }])).toEqual([
      { periodo: 202602, etiqueta: "Feb 26", etiquetaLarga: "Feb 2026", pct: null, texto: "—" },
    ]);
  });

  it("ordena los puntos por periodo ascendente", () => {
    const puntos = puntosGrafica([
      { periodo: 202603, valor: 1 },
      { periodo: 202601, valor: 1 },
    ]);
    expect(puntos.map((p) => p.periodo)).toEqual([202601, 202603]);
  });
});

describe("serieGlobal y serieDeCategoria", () => {
  const SERIE = [
    { periodo: 202601, global: 0.5, pct: { medicamentos: 0.75, rx: null } },
    { periodo: 202602, global: null, pct: { medicamentos: null, rx: null } },
  ];

  it("serieGlobal extrae el global de cada periodo", () => {
    expect(serieGlobal(SERIE)).toEqual([
      { periodo: 202601, valor: 0.5 },
      { periodo: 202602, valor: null },
    ]);
  });

  it("serieDeCategoria extrae el porcentaje de una categoría", () => {
    expect(serieDeCategoria(SERIE, "medicamentos")).toEqual([
      { periodo: 202601, valor: 0.75 },
      { periodo: 202602, valor: null },
    ]);
  });

  it("serieDeCategoria trata una categoría ausente como sin dato", () => {
    expect(serieDeCategoria(SERIE, "ecografias").map((p) => p.valor)).toEqual([null, null]);
  });
});

describe("ordenarRanking", () => {
  const LISTA = [
    prof({ documento: "1", nombre: "PEREZ JUAN", programa: "RCV", citas: 400, global: 1.25, pct: { rx: 1 } }),
    prof({ documento: "2", nombre: "GOMEZ ANA", programa: "CPR", citas: 200, global: 0.25, pct: { rx: 0 } }),
    prof({ documento: "3", nombre: "ARIAS LUZ", programa: null, citas: 50, global: null, pct: { rx: null } }),
    prof({ documento: "4", nombre: "ZAPATA RUTH", programa: "RCV", citas: 900, global: 0.9, pct: { rx: 2 } }),
  ];
  const docs = (lista: ProfesionalCumplimiento[]) => lista.map((p) => p.documento);

  it("por global descendente deja al final las filas sin dato", () => {
    expect(docs(ordenarRanking(LISTA, "global", "desc"))).toEqual(["1", "4", "2", "3"]);
  });

  it("por global ascendente también deja al final las filas sin dato", () => {
    expect(docs(ordenarRanking(LISTA, "global", "asc"))).toEqual(["2", "4", "1", "3"]);
  });

  it("ordena por una categoría", () => {
    expect(docs(ordenarRanking(LISTA, "rx", "desc"))).toEqual(["4", "1", "2", "3"]);
    expect(docs(ordenarRanking(LISTA, "rx", "asc"))).toEqual(["2", "1", "4", "3"]);
  });

  it("ordena por citas", () => {
    expect(docs(ordenarRanking(LISTA, "citas", "desc"))).toEqual(["4", "1", "2", "3"]);
  });

  it("ordena por nombre", () => {
    expect(docs(ordenarRanking(LISTA, "nombre", "asc"))).toEqual(["3", "2", "1", "4"]);
    expect(docs(ordenarRanking(LISTA, "nombre", "desc"))).toEqual(["4", "1", "2", "3"]);
  });

  it("ordena por programa, con los profesionales sin programa al final", () => {
    expect(docs(ordenarRanking(LISTA, "programa", "asc"))).toEqual(["2", "1", "4", "3"]);
    expect(docs(ordenarRanking(LISTA, "programa", "desc"))).toEqual(["1", "4", "2", "3"]);
  });

  it("desempata por nombre y no modifica la lista original", () => {
    const copia = [...LISTA];
    ordenarRanking(LISTA, "global", "asc");
    expect(LISTA).toEqual(copia);

    const empate = [
      prof({ documento: "9", nombre: "ZETA", global: 1 }),
      prof({ documento: "8", nombre: "ALFA", global: 1 }),
    ];
    expect(docs(ordenarRanking(empate, "global", "desc"))).toEqual(["8", "9"]);
  });
});

describe("filtrarProfesionales", () => {
  const LISTA = [
    { documento: "10234567", nombre: "PÉREZ JUAN" },
    { documento: "30345678", nombre: "GOMEZ ANA" },
  ];

  it("sin texto retorna todos", () => {
    expect(filtrarProfesionales(LISTA, "  ")).toEqual(LISTA);
  });

  it("busca por nombre sin distinguir mayúsculas ni tildes", () => {
    expect(filtrarProfesionales(LISTA, "perez")).toEqual([LISTA[0]]);
    expect(filtrarProfesionales(LISTA, "Gómez")).toEqual([LISTA[1]]);
  });

  it("busca por cédula", () => {
    expect(filtrarProfesionales(LISTA, "3034")).toEqual([LISTA[1]]);
  });

  it("retorna vacío si nada coincide", () => {
    expect(filtrarProfesionales(LISTA, "xyz")).toEqual([]);
  });
});

describe("serieDeFilas y contarSinPrograma", () => {
  const base = { categoria: "medicamentos" };
  const { filas } = construirCumplimiento({
    entradas: [
      { ...base, documento: "1", nombre: "PEREZ JUAN", periodo: 202601, citas: 100, programa: "RCV", ordenes: 300 },
      { ...base, documento: "1", nombre: "PEREZ JUAN", periodo: 202602, citas: 0, programa: "RCV", ordenes: 50 },
      { ...base, documento: "2", nombre: "GOMEZ ANA", periodo: 202601, citas: 100, programa: null, ordenes: 10 },
      { ...base, documento: "2", nombre: "GOMEZ ANA", periodo: 202602, citas: 80, programa: null, ordenes: 10 },
      { ...base, documento: "3", nombre: "ARIAS LUZ", periodo: 202601, citas: 0, programa: null, ordenes: 10 },
    ],
    metas: [{ anio: 2026, programa: "RCV", categoria: "medicamentos", valor: 2 }],
  });

  it("serieDeFilas convierte las filas de un médico en una serie por periodo", () => {
    const serie = serieDeFilas(filas.filter((f) => f.documento === "1"));

    expect(serie.map((s) => [s.periodo, s.global, s.pct.medicamentos])).toEqual([
      [202601, 1.5, 1.5],
      [202602, null, null],
    ]);
    expect(serie[0].pct.rx).toBeNull();
  });

  it("contarSinPrograma cuenta una vez a cada médico con citas y sin programa", () => {
    // GOMEZ cuenta una sola vez; ARIAS no tiene citas
    expect(contarSinPrograma(filas)).toBe(1);
  });

  it("contarSinPrograma es 0 cuando todos tienen programa", () => {
    expect(contarSinPrograma(filas.filter((f) => f.documento === "1"))).toBe(0);
  });
});
