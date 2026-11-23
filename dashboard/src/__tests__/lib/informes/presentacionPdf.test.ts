import { informeFicha, informeMensual, informeVista } from "@/lib/informes/construir";
import {
  filaTotales,
  fmtValor,
  fmtVariacionKpi,
  prepararKpis,
  prepararTabla,
  semaforoInasistencia,
} from "@/lib/informes/presentacionPdf";
import type { KpiInforme, TablaInforme } from "@/lib/informes/modelo";
import { FILTROS_VACIOS } from "@/lib/productividad/filtros";
import { ALERTAS, FICHA, PRODUCTIVIDAD } from "@/test-utils/informes";

const AHORA = new Date("2026-11-18T15:32:00Z");
const VISTA = informeVista(PRODUCTIVIDAD, { ...FILTROS_VACIOS, periodo: "202610" }, AHORA);
const tabla = (id: string, t = VISTA.tablas) => t.find((x) => x.id === id) as TablaInforme;

describe("fmtValor", () => {
  it.each([
    ["entero", 12345, "12.345"],
    ["entero", 12.6, "13"],
    ["decimal", 2.345, "2,3"],
    ["porcentaje", 0.1712, "17,1 %"],
    ["porcentaje", 0, "0,0 %"],
    ["texto", "CONSULTA", "CONSULTA"],
    ["entero", null, "—"],
    ["porcentaje", null, "—"],
    ["texto", null, ""],
  ] as const)("%s %p → %p", (tipo, valor, esperado) => {
    expect(fmtValor(tipo, valor)).toBe(esperado);
  });
});

describe("semaforoInasistencia (meta 10 %)", () => {
  it.each([
    [0.05, "En meta"],
    [0.0999, "En meta"],
    [0.1, "Alto"],
    [0.15, "Muy alto"],
    [0.2, "Crítico"],
  ])("%p → %p", (v, etiqueta) => {
    expect(semaforoInasistencia(v)?.etiqueta).toBe(etiqueta);
  });

  it("verde bajo la meta y rojo por encima, con colores distintos por banda", () => {
    expect(semaforoInasistencia(0.05)).toMatchObject({ fondo: "#EEF6E2", tinta: "#447016" });
    expect(semaforoInasistencia(0.25)).toMatchObject({ fondo: "#C0392B", tinta: "#FFFFFF" });
  });

  it("sin valor no hay semáforo", () => {
    expect(semaforoInasistencia(null)).toBeNull();
  });
});

describe("fmtVariacionKpi", () => {
  const base: KpiInforme = { clave: "x", etiqueta: "X", tipo: "entero", valor: 110, anterior: 100, variacion: "relativa" };
  it("relativa con flecha y puntos porcentuales", () => {
    expect(fmtVariacionKpi(base)).toBe("↑ 10 %");
    expect(fmtVariacionKpi({ ...base, valor: 90 })).toBe("↓ 10 %");
    expect(fmtVariacionKpi({ ...base, tipo: "porcentaje", valor: 0.171, anterior: 0.15, variacion: "puntos" })).toBe("↑ 2,1 pp");
    expect(fmtVariacionKpi({ ...base, valor: 100 })).toBe("= 0 %");
  });
  it("null sin periodo anterior o sin variación", () => {
    expect(fmtVariacionKpi({ ...base, anterior: null })).toBeNull();
    expect(fmtVariacionKpi({ ...base, variacion: null })).toBeNull();
    expect(fmtVariacionKpi({ ...base, anterior: 0 })).toBeNull();
  });
});

describe("filaTotales", () => {
  it("suma los conteos y calcula las razones sobre los totales", () => {
    const t = filaTotales(tabla("areas"));
    expect(t).toMatchObject({ area: "Total", asignadas: 800, inasistidas: 120, ofertadas: 1000 });
    expect(t!.pct_inasistencia).toBeCloseTo(0.15);
    expect(t!.pct_disponibilidad).toBeCloseTo(0.2);
  });
  it("null si la tabla no lleva totales o no tiene filas", () => {
    expect(filaTotales(tabla("tendencia"))).toBeNull();
    expect(filaTotales({ ...tabla("areas"), filas: [] })).toBeNull();
  });
});

describe("prepararTabla", () => {
  it("formatea las celdas, alinea los números a la derecha y marca el semáforo con texto", () => {
    const t = prepararTabla(tabla("areas"));
    expect(t.columnas.map((c) => c.etiqueta)).toEqual([
      "Área", "Ofertadas", "Asignadas", "Atendidas", "Inasistidas", "% inasistencia", "Sin asignar", "% disponibilidad", "Citas perdidas",
    ]);
    expect(t.columnas[0].alineacion).toBe("izquierda");
    expect(t.columnas[1].alineacion).toBe("derecha");
    const [mg, so] = t.filas;
    expect(mg.map((c) => c.texto)).toEqual(["Medicina general", "600", "500", "400", "100", "20,0 %", "100", "16,7 %", "200"]);
    expect(mg[5].semaforo?.etiqueta).toBe("Crítico");
    expect(so[5].semaforo?.etiqueta).toBe("En meta");
    expect(mg[7].semaforo).toBeUndefined();
    expect(t.total?.map((c) => c.texto)).toEqual(["Total", "1.000", "800", "680", "120", "15,0 %", "200", "20,0 %", "320"]);
    expect(t.total?.[5].semaforo?.etiqueta).toBe("Muy alto");
  });

  it("las columnas de texto largo pesan más que las numéricas", () => {
    const t = prepararTabla(tabla("servicios"));
    const peso = (e: string) => t.columnas.find((c) => c.etiqueta === e)!.peso;
    expect(peso("Servicio")).toBeGreaterThan(peso("Código"));
    expect(peso("Código")).toBeLessThanOrEqual(peso("Asignadas") * 1.5);
  });

  it("con límite recorta las filas, omite los totales y lo aclara en la nota", () => {
    const t = prepararTabla(tabla("profesionales"), { limite: 1 });
    expect(t.filas).toHaveLength(1);
    expect(t.total).toBeNull();
    expect(t.nota).toBe("Se muestran 1 de 2 filas; el listado completo está en el Excel.");
  });

  it("sin recorte conserva la nota del modelo", () => {
    const m = informeMensual(PRODUCTIVIDAD, ALERTAS, AHORA);
    const t = prepararTabla(tabla("profesionales", m.tablas), { limite: 25 });
    expect(t.filas).toHaveLength(2);
    expect(t.nota).toBe("Ordenado de más a menos citas inasistidas.");
    expect(t.total).not.toBeNull();
  });
});

describe("prepararKpis", () => {
  it("formatea valor y variación y marca el semáforo del % de inasistencia", () => {
    const k = prepararKpis(VISTA.kpis);
    const asignadas = k.find((x) => x.clave === "asignadas")!;
    expect(asignadas).toMatchObject({ etiqueta: "Citas asignadas", valor: "800", variacion: "↑ 14,3 %" });
    const pct = k.find((x) => x.clave === "pct_inasistencia")!;
    expect(pct).toMatchObject({ valor: "15,0 %", variacion: "↑ 5 pp" });
    expect(pct.semaforo?.etiqueta).toBe("Muy alto");
    expect(k.find((x) => x.clave === "con_agenda")).toMatchObject({ valor: "2", variacion: null, semaforo: null });
  });

  it("ficha: percentil e institución sin variación", () => {
    const k = prepararKpis(informeFicha(FICHA, AHORA).kpis);
    expect(k.find((x) => x.clave === "percentil")!.valor).toBe("80");
    expect(k.find((x) => x.clave === "institucion")!.valor).toBe("15,0 %");
  });
});
