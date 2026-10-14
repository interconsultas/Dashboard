import { wb, toW, buildExport, mergeViewFilters } from "@/lib/dashboard-filters";
import { getViewFilters } from "@/lib/view-registry";

const SIN_REGIONAL = { clause: "", params: [] as (string | null)[] };
const CAP = getViewFilters("vm_dash_remisiones_cap");

describe("mergeViewFilters (exportación = lo que muestra la pantalla)", () => {
  it("sin selección del usuario usa los valores de la vista", () => {
    const { filtros, vacio } = mergeViewFilters({}, CAP);
    expect(vacio).toBe(false);
    expect(filtros.prestacion).toEqual(CAP.prestacion);
    expect(filtros.tipo_convenio).toEqual(["CAPITADO"]);
  });

  it("selección vacía del usuario equivale a no seleccionar", () => {
    const { filtros, vacio } = mergeViewFilters({ prestacion: [] }, CAP);
    expect(vacio).toBe(false);
    expect(filtros.prestacion).toEqual(CAP.prestacion);
  });

  it("el usuario angosta prestacion: solo queda su selección", () => {
    const { filtros, vacio } = mergeViewFilters({ prestacion: ["CONTROL  EN PEDIATRIA"] }, CAP);
    expect(vacio).toBe(false);
    expect(filtros.prestacion).toEqual(["CONTROL  EN PEDIATRIA"]);
  });

  it("intersecta conservando solo los valores que la vista permite", () => {
    const { filtros } = mergeViewFilters(
      { prestacion: ["CONSULTA PEDIATRA", "RADIOGRAFIA DE TORAX"] },
      CAP,
    );
    expect(filtros.prestacion).toEqual(["CONSULTA PEDIATRA"]);
  });

  it("valor fuera de la lista de la vista: intersección vacía", () => {
    const { vacio } = mergeViewFilters({ prestacion: ["RADIOGRAFIA DE TORAX"] }, CAP);
    expect(vacio).toBe(true);
  });

  it("los campos que la vista no fija se conservan tal como los envió el usuario", () => {
    const { filtros } = mergeViewFilters(
      { diagnostico: ["X"], desde: 202601, hasta: 202603 },
      CAP,
    );
    expect(filtros.diagnostico).toEqual(["X"]);
    expect(filtros.desde).toBe(202601);
    expect(filtros.hasta).toBe(202603);
  });

  it("exclude_orden_agrup de la vista se aplica igual que antes (la vista manda)", () => {
    const med = getViewFilters("vm_dash_medicamentos");
    const { filtros } = mergeViewFilters({ exclude_orden_agrup: ["OTRA"] }, med);
    expect(filtros.exclude_orden_agrup).toEqual(["PROGRAMAS ESPECIALES"]);
  });
});

describe("buildExport", () => {
  it("usuario angosta prestacion: el WHERE filtra solo ese valor", () => {
    const b = wb();
    buildExport(b, { prestacion: ["CONTROL  EN PEDIATRIA"] }, CAP, SIN_REGIONAL);
    expect(toW(b)).toMatch(/r\.descripcion_prestacion IN \(\$\d+\)(?! *,)/);
    expect(b.params).toContain("CONTROL  EN PEDIATRIA");
    expect(b.params).not.toContain("CONSULTA PEDIATRA");
  });

  it("valor fuera de la vista: el WHERE no devuelve filas (no cae a todo)", () => {
    const b = wb();
    buildExport(b, { prestacion: ["RADIOGRAFIA DE TORAX"] }, CAP, SIN_REGIONAL);
    expect(b.clauses).toContain("FALSE");
    expect(b.params).not.toContain("RADIOGRAFIA DE TORAX");
  });

  it("sin selección del usuario: el WHERE usa la lista completa de la vista", () => {
    const b = wb();
    buildExport(b, {}, CAP, SIN_REGIONAL);
    expect(b.clauses).not.toContain("FALSE");
    for (const v of CAP.prestacion ?? []) expect(b.params).toContain(v);
  });
});
