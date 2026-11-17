import {
  FILTROS_VACIOS,
  aQueryString,
  aplicarArea,
  aplicarServicio,
  leerFiltros,
  validarParametros,
} from "@/lib/productividad/filtros";

const sp = (s: string) => new URLSearchParams(s);

describe("leerFiltros (cliente, tolerante)", () => {
  it("sin parámetros: mensual y sin filtros", () => {
    expect(leerFiltros(sp(""))).toEqual(FILTROS_VACIOS);
    expect(FILTROS_VACIOS.granularidad).toBe("mensual");
  });

  it("lee todos los filtros y recorta espacios", () => {
    expect(
      leerFiltros(sp("granularidad=semanal&periodo=2026-10-05&area=Salud%20oral&servicio=%20171%20&profesional=123"))
    ).toEqual({ granularidad: "semanal", periodo: "2026-10-05", area: "Salud oral", servicio: "171", profesional: "123" });
  });

  it("una granularidad desconocida vuelve a mensual y los vacíos son null", () => {
    expect(leerFiltros(sp("granularidad=anual&area="))).toEqual(FILTROS_VACIOS);
  });
});

describe("aQueryString", () => {
  it("omite los valores por defecto", () => {
    expect(aQueryString(FILTROS_VACIOS)).toBe("");
  });

  it("es inverso de leerFiltros", () => {
    const f = { granularidad: "semanal" as const, periodo: "2026-10-05", area: "Enfermería", servicio: "11", profesional: "99" };
    expect(leerFiltros(sp(aQueryString(f)))).toEqual(f);
  });
});

describe("aplicarArea / aplicarServicio (coherencia área–servicio)", () => {
  const servicios = [
    { codigo: "11", nombre: "CONSULTA", area: "Medicina general" },
    { codigo: "152", nombre: "ODONTOLOGIA", area: "Salud oral" },
  ];

  it("elegir un servicio fija también su área", () => {
    expect(aplicarServicio(FILTROS_VACIOS, "152", servicios)).toMatchObject({ servicio: "152", area: "Salud oral" });
  });

  it("quitar el servicio conserva el área", () => {
    const f = { ...FILTROS_VACIOS, area: "Salud oral", servicio: "152" };
    expect(aplicarServicio(f, null, servicios)).toMatchObject({ servicio: null, area: "Salud oral" });
  });

  it("cambiar de área quita un servicio de otra área", () => {
    const f = { ...FILTROS_VACIOS, area: "Salud oral", servicio: "152" };
    expect(aplicarArea(f, "Medicina general", servicios)).toMatchObject({ area: "Medicina general", servicio: null });
  });

  it("quitar el área quita el servicio", () => {
    const f = { ...FILTROS_VACIOS, area: "Salud oral", servicio: "152" };
    expect(aplicarArea(f, null, servicios)).toMatchObject({ area: null, servicio: null });
  });

  it("re-elegir la misma área conserva el servicio", () => {
    const f = { ...FILTROS_VACIOS, area: "Salud oral", servicio: "152" };
    expect(aplicarArea(f, "Salud oral", servicios)).toMatchObject({ area: "Salud oral", servicio: "152" });
  });
});

describe("validarParametros (API, estricto)", () => {
  const areas = ["Medicina general", "Salud oral"];

  it("sin parámetros: mensual, periodo por defecto", () => {
    expect(validarParametros(sp(""), areas)).toEqual({ filtros: FILTROS_VACIOS });
  });

  it("acepta una combinación válida", () => {
    expect(validarParametros(sp("periodo=202610&area=Salud%20oral&servicio=152&profesional=1053"), areas)).toEqual({
      filtros: { granularidad: "mensual", periodo: "202610", area: "Salud oral", servicio: "152", profesional: "1053" },
    });
  });

  it.each([
    ["granularidad desconocida", "granularidad=anual"],
    ["periodo mensual con formato de semana", "periodo=2026-10-01"],
    ["periodo mensual con mes 13", "periodo=202613"],
    ["periodo semanal con formato de mes", "granularidad=semanal&periodo=202610"],
    ["periodo semanal con fecha imposible", "granularidad=semanal&periodo=2026-02-30"],
    ["área que no está en el catálogo", "area=Cardiolog%C3%ADa"],
    ["servicio con caracteres no válidos", "servicio=1%20OR%201%3D1"],
    ["servicio demasiado largo", `servicio=${"9".repeat(21)}`],
    ["profesional con letras", "profesional=12a4"],
    ["profesional demasiado largo", `profesional=${"1".repeat(16)}`],
    ["parámetro repetido", "area=Salud%20oral&area=Medicina%20general"],
  ])("rechaza %s", (_caso, qs) => {
    const r = validarParametros(sp(qs), areas);
    expect(r).toHaveProperty("error");
    expect(typeof (r as { error: string }).error).toBe("string");
  });
});
