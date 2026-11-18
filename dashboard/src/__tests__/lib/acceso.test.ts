import {
  esRol,
  esSeccion,
  puedeVer,
  puedeEditar,
  rutaInicio,
  destinoSinAcceso,
  seccionDeRuta,
  permisosEfectivos,
  cumpleRequisito,
  validarCambiosPermisos,
  PERMISOS_POR_DEFECTO,
  PERMISOS_API,
  SECCIONES,
  RUTA_SIN_SECCIONES,
} from "@/lib/acceso";
import type { Permisos, Rol, Seccion } from "@/lib/acceso";

const TODOS: Rol[] = ["admin", "direccion_medica", "coordinador"];
const CLAVES = SECCIONES.map((s) => s.clave);

function permisos(parcial: Partial<Permisos> = {}): Permisos {
  const base = Object.fromEntries(CLAVES.map((c) => [c, "ninguno"])) as Permisos;
  return { ...base, ...parcial };
}

/** Filas de permisos_rol como las sembró 018. */
function filasDe(rol: Rol, p: Permisos) {
  return Object.entries(p).map(([seccion, nivel]) => ({ rol, seccion, nivel }));
}

describe("SECCIONES", () => {
  it("lista las secciones en el orden del menú", () => {
    expect(CLAVES).toEqual([
      "dashboard", "cumplimiento", "productividad", "inteligencia", "carga",
      "profesionales", "metas", "citas", "usuarios",
    ]);
  });

  it("solo metas, citas, carga, profesionales y usuarios admiten edición", () => {
    const editables = SECCIONES.filter((s) => s.admiteEdicion).map((s) => s.clave);
    expect(editables.sort()).toEqual(["carga", "citas", "metas", "profesionales", "usuarios"]);
  });

  it("usuarios no es configurable", () => {
    const fijas = SECCIONES.filter((s) => !s.configurable).map((s) => s.clave);
    expect(fijas).toEqual(["usuarios"]);
  });

  it("cada sección tiene etiqueta y descripción", () => {
    for (const s of SECCIONES) {
      expect(s.etiqueta).not.toBe("");
      expect(s.descripcion).not.toBe("");
    }
  });
});

describe("seccionDeRuta", () => {
  it.each<[string, Seccion | null]>([
    ["/dashboard", "dashboard"],
    ["/dashboard/", "dashboard"],
    ["/dashboard/tipo/rx", "dashboard"],
    ["/dashboard/cumplimiento", "cumplimiento"],
    ["/dashboard/cumplimientos", "dashboard"],
    ["/dashboard/productividad", "productividad"],
    ["/dashboard/inteligencia", "inteligencia"],
    ["/admin/carga", "carga"],
    ["/admin/medicos", "profesionales"],
    ["/admin/metas", "metas"],
    ["/admin/metas/programas", "metas"],
    ["/admin/metasx", "usuarios"],
    ["/admin/citas", "citas"],
    ["/admin/citas/areas", "citas"],
    ["/admin/citas-atendidas", "citas"],
    ["/admin/usuarios", "usuarios"],
    // Cualquier otra página de administración queda solo para admin
    ["/admin", "usuarios"],
    ["/admin/ruta-nueva", "usuarios"],
    ["/otra", null],
  ])("%s → %s", (ruta, seccion) => {
    expect(seccionDeRuta(ruta)).toBe(seccion);
  });
});

describe("PERMISOS_POR_DEFECTO (semilla de 018 = acceso fijo anterior)", () => {
  /** Página → roles que podían abrirla antes de los permisos configurables. */
  const ANTES: Array<[string, Rol[]]> = [
    ["/dashboard", TODOS],
    ["/dashboard/tipo/rx", TODOS],
    ["/dashboard/cumplimiento", ["admin", "direccion_medica"]],
    ["/dashboard/productividad", ["admin", "direccion_medica"]],
    ["/dashboard/inteligencia", ["admin", "direccion_medica"]],
    ["/admin/metas", ["admin", "direccion_medica"]],
    ["/admin/metas/programas", ["admin", "direccion_medica"]],
    ["/admin/citas", ["admin"]],
    ["/admin/citas/areas", ["admin"]],
    ["/admin/citas-atendidas", ["admin"]],
    ["/admin/carga", ["admin"]],
    ["/admin/medicos", ["admin"]],
    ["/admin/usuarios", ["admin"]],
    ["/admin/ruta-nueva", ["admin"]],
  ];

  describe.each(ANTES)("%s", (ruta, permitidos) => {
    it.each(TODOS)("rol %s", (rol) => {
      expect(puedeVer(PERMISOS_POR_DEFECTO[rol], ruta)).toBe(permitidos.includes(rol));
    });
  });

  it("solo admin edita metas", () => {
    expect(puedeEditar(PERMISOS_POR_DEFECTO.admin, "metas")).toBe(true);
    expect(puedeEditar(PERMISOS_POR_DEFECTO.direccion_medica, "metas")).toBe(false);
    expect(puedeEditar(PERMISOS_POR_DEFECTO.coordinador, "metas")).toBe(false);
  });
});

describe("permisosEfectivos", () => {
  it("toma los niveles de las filas del rol e ignora las de otros roles", () => {
    const filas = [
      { rol: "coordinador", seccion: "productividad", nivel: "ver" },
      { rol: "direccion_medica", seccion: "carga", nivel: "editar" },
    ];
    const p = permisosEfectivos("coordinador", filas);
    expect(p.productividad).toBe("ver");
    expect(p.carga).toBe("ninguno");
  });

  it("una sección sin fila queda sin acceso", () => {
    expect(permisosEfectivos("coordinador", [])).toEqual(permisos());
  });

  it("admin tiene editar en todo sin importar la base de datos", () => {
    const filas = filasDe("admin", permisos());
    expect(permisosEfectivos("admin", filas)).toEqual(
      Object.fromEntries(CLAVES.map((c) => [c, "editar"])),
    );
  });

  it("usuarios es solo de admin aunque la base diga otra cosa", () => {
    const filas = [{ rol: "direccion_medica", seccion: "usuarios", nivel: "editar" }];
    expect(permisosEfectivos("direccion_medica", filas).usuarios).toBe("ninguno");
  });

  it("una sección de solo consulta no sube a editar", () => {
    const filas = [{ rol: "coordinador", seccion: "dashboard", nivel: "editar" }];
    expect(permisosEfectivos("coordinador", filas).dashboard).toBe("ver");
  });

  it("ignora secciones y niveles desconocidos", () => {
    const filas = [
      { rol: "coordinador", seccion: "otra", nivel: "ver" },
      { rol: "coordinador", seccion: "metas", nivel: "todo" },
    ];
    const p = permisosEfectivos("coordinador", filas);
    expect(p).toEqual(permisos());
    expect(Object.keys(p)).not.toContain("otra");
  });
});

describe("cumpleRequisito", () => {
  it("editar incluye ver", () => {
    const p = permisos({ metas: "editar" });
    expect(cumpleRequisito(p, { secciones: ["metas"], nivel: "ver" })).toBe(true);
    expect(cumpleRequisito(p, { secciones: ["metas"], nivel: "editar" })).toBe(true);
  });

  it("ver no alcanza para editar", () => {
    const p = permisos({ metas: "ver" });
    expect(cumpleRequisito(p, { secciones: ["metas"], nivel: "editar" })).toBe(false);
  });

  it("basta con una de las secciones", () => {
    const p = permisos({ cumplimiento: "ver" });
    expect(cumpleRequisito(p, { secciones: ["citas", "cumplimiento"], nivel: "ver" })).toBe(true);
    expect(cumpleRequisito(p, { secciones: ["citas", "metas"], nivel: "ver" })).toBe(false);
  });

  it("sin permisos no cumple nada", () => {
    expect(cumpleRequisito(null, { secciones: ["dashboard"], nivel: "ver" })).toBe(false);
  });
});

describe("puedeVer", () => {
  it("sigue los permisos de la sección de la página", () => {
    const p = permisos({ productividad: "ver" });
    expect(puedeVer(p, "/dashboard/productividad")).toBe(true);
    expect(puedeVer(p, "/dashboard")).toBe(false);
  });

  it("sin permisos o en rutas desconocidas no deja ver", () => {
    expect(puedeVer(null, "/dashboard")).toBe(false);
    expect(puedeVer(PERMISOS_POR_DEFECTO.admin, "/otra")).toBe(false);
  });
});

describe("rutaInicio", () => {
  it("admin conserva su inicio en Carga de archivos", () => {
    expect(rutaInicio("admin", PERMISOS_POR_DEFECTO.admin)).toBe("/admin/carga");
  });

  it("los demás roles inician en la primera sección visible, en orden del menú", () => {
    expect(rutaInicio("direccion_medica", PERMISOS_POR_DEFECTO.direccion_medica)).toBe("/dashboard");
    expect(rutaInicio("coordinador", permisos({ metas: "ver", productividad: "ver" }))).toBe(
      "/dashboard/productividad",
    );
  });

  it("sin ninguna sección visible no hay inicio", () => {
    expect(rutaInicio("coordinador", permisos())).toBeNull();
  });

  it.each(TODOS)("el inicio de %s siempre es visible para ese rol", (rol) => {
    const p = PERMISOS_POR_DEFECTO[rol];
    expect(puedeVer(p, rutaInicio(rol, p)!)).toBe(true);
  });
});

describe("destinoSinAcceso", () => {
  it("lleva al inicio del rol con el aviso", () => {
    expect(destinoSinAcceso("coordinador", PERMISOS_POR_DEFECTO.coordinador)).toBe(
      "/dashboard?sin_acceso=1",
    );
    expect(destinoSinAcceso("coordinador", permisos({ metas: "ver" }))).toBe("/admin/metas?sin_acceso=1");
  });

  it("sin secciones lleva a la página fija, que no exige ninguna sección (sin bucles)", () => {
    expect(destinoSinAcceso("coordinador", permisos())).toBe(RUTA_SIN_SECCIONES);
    expect(seccionDeRuta(RUTA_SIN_SECCIONES)).toBeNull();
  });
});

describe("PERMISOS_API", () => {
  it("las lecturas piden ver y las escrituras editar", () => {
    for (const [ruta, metodos] of Object.entries(PERMISOS_API)) {
      for (const [metodo, req] of Object.entries(metodos)) {
        const esperado = metodo === "GET" ? "ver" : "editar";
        // Los POST de consulta (filtros, export, cumplimiento) solo leen
        const soloLectura = ["/api/dashboard/filtros", "/api/dashboard/export", "/api/cumplimiento"];
        expect([ruta, metodo, req!.nivel]).toEqual([
          ruta, metodo, soloLectura.includes(ruta) ? "ver" : esperado,
        ]);
      }
    }
  });

  it("las fuentes de datos compartidas siguen abiertas a quien ve la sección que las consume", () => {
    expect(PERMISOS_API["/api/admin/medicos"].GET!.secciones).toEqual(
      expect.arrayContaining(["profesionales", "cumplimiento"]),
    );
    expect(PERMISOS_API["/api/admin/citas-atendidas"].GET!.secciones).toEqual(
      expect.arrayContaining(["citas", "cumplimiento"]),
    );
    expect(PERMISOS_API["/api/admin/citas/detalle"].GET!.secciones).toEqual(
      expect.arrayContaining(["citas", "cumplimiento"]),
    );
    // El simulador de Inteligencia lee los agregados de productividad
    expect(PERMISOS_API["/api/productividad"].GET!.secciones).toEqual(
      expect.arrayContaining(["productividad", "inteligencia"]),
    );
  });

  it("quien ve Inteligencia sin Productividad puede leer los agregados del simulador, pero no la ficha", () => {
    const soloInteligencia = { ...permisosEfectivos("coordinador", []), inteligencia: "ver" } as Permisos;
    expect(cumpleRequisito(soloInteligencia, PERMISOS_API["/api/productividad"].GET!)).toBe(true);
    expect(cumpleRequisito(soloInteligencia, PERMISOS_API["/api/productividad/profesional"].GET!)).toBe(false);
  });

  it("con los permisos por defecto cada rol conserva el acceso que tenía en la API", () => {
    const ANTES: Array<[string, string, Rol[]]> = [
      ["/api/dashboard/kpis", "GET", TODOS],
      ["/api/dashboard/filtros", "POST", TODOS],
      ["/api/dashboard/export", "POST", TODOS],
      ["/api/cumplimiento", "POST", ["admin", "direccion_medica"]],
      ["/api/productividad", "GET", ["admin", "direccion_medica"]],
      ["/api/productividad/profesional", "GET", ["admin", "direccion_medica"]],
      ["/api/inteligencia/grafo", "GET", ["admin", "direccion_medica"]],
      ["/api/admin/metas", "GET", ["admin", "direccion_medica"]],
      ["/api/admin/metas", "PUT", ["admin"]],
      ["/api/admin/metas/programas", "GET", ["admin", "direccion_medica"]],
      ["/api/admin/metas/programas", "PUT", ["admin"]],
      ["/api/admin/medicos", "GET", ["admin", "direccion_medica"]],
      ["/api/admin/medicos", "POST", ["admin"]],
      ["/api/admin/medicos/[id]", "PATCH", ["admin"]],
      ["/api/admin/medicos/[id]", "DELETE", ["admin"]],
      ["/api/admin/medicos/importar", "POST", ["admin"]],
      ["/api/admin/citas-atendidas", "GET", ["admin", "direccion_medica"]],
      ["/api/admin/citas-atendidas", "PUT", ["admin"]],
      ["/api/admin/citas-atendidas/importar", "POST", ["admin"]],
      ["/api/admin/citas/detalle", "GET", ["admin", "direccion_medica"]],
      ["/api/admin/citas/areas", "GET", ["admin"]],
      ["/api/admin/citas/areas", "PUT", ["admin"]],
      ["/api/carga/historial", "GET", ["admin"]],
      ["/api/carga/upload", "POST", ["admin"]],
      ["/api/carga/[jobId]", "DELETE", ["admin"]],
      ["/api/carga/validacion/[jobId]", "GET", ["admin"]],
      ["/api/carga/preview/[jobId]", "GET", ["admin"]],
      ["/api/carga/confirm/[jobId]", "POST", ["admin"]],
      ["/api/carga/cancel/[jobId]", "POST", ["admin"]],
      ["/api/admin/usuarios", "GET", ["admin"]],
      ["/api/admin/usuarios", "POST", ["admin"]],
      ["/api/admin/usuarios/[id]", "PATCH", ["admin"]],
      ["/api/admin/usuarios/[id]", "DELETE", ["admin"]],
      ["/api/admin/permisos", "GET", ["admin"]],
      ["/api/admin/permisos", "PUT", ["admin"]],
    ];
    const tabla = PERMISOS_API as Record<string, Record<string, Parameters<typeof cumpleRequisito>[1]>>;
    expect(ANTES.length).toBe(
      Object.values(PERMISOS_API).reduce((n, m) => n + Object.keys(m).length, 0),
    );
    for (const [ruta, metodo, roles] of ANTES) {
      for (const rol of TODOS) {
        expect([ruta, metodo, rol, cumpleRequisito(PERMISOS_POR_DEFECTO[rol], tabla[ruta][metodo])]).toEqual([
          ruta, metodo, rol, roles.includes(rol),
        ]);
      }
    }
  });
});

describe("validarCambiosPermisos", () => {
  const ok = (cambios: unknown) => validarCambiosPermisos({ cambios });

  it("acepta cambios válidos de los roles configurables", () => {
    const r = ok([
      { rol: "coordinador", seccion: "productividad", nivel: "ver" },
      { rol: "direccion_medica", seccion: "metas", nivel: "editar" },
      { rol: "direccion_medica", seccion: "cumplimiento", nivel: "ninguno" },
    ]);
    expect(r).toEqual({
      cambios: [
        { rol: "coordinador", seccion: "productividad", nivel: "ver" },
        { rol: "direccion_medica", seccion: "metas", nivel: "editar" },
        { rol: "direccion_medica", seccion: "cumplimiento", nivel: "ninguno" },
      ],
    });
  });

  it.each([
    ["cuerpo nulo", null],
    ["sin cambios", {}],
    ["cambios vacío", { cambios: [] }],
    ["cambios no es lista", { cambios: "x" }],
    ["fila no es objeto", { cambios: [null] }],
    ["rol admin", { cambios: [{ rol: "admin", seccion: "metas", nivel: "ver" }] }],
    ["rol desconocido", { cambios: [{ rol: "invitado", seccion: "metas", nivel: "ver" }] }],
    ["sección usuarios", { cambios: [{ rol: "coordinador", seccion: "usuarios", nivel: "editar" }] }],
    ["sección desconocida", { cambios: [{ rol: "coordinador", seccion: "otra", nivel: "ver" }] }],
    ["nivel desconocido", { cambios: [{ rol: "coordinador", seccion: "metas", nivel: "todo" }] }],
    ["editar en sección de solo consulta", { cambios: [{ rol: "coordinador", seccion: "dashboard", nivel: "editar" }] }],
    ["fila repetida", {
      cambios: [
        { rol: "coordinador", seccion: "metas", nivel: "ver" },
        { rol: "coordinador", seccion: "metas", nivel: "ninguno" },
      ],
    }],
  ])("rechaza: %s", (_caso, cuerpo) => {
    const r = validarCambiosPermisos(cuerpo);
    expect(r).toEqual({ error: expect.any(String) });
  });
});

describe("esRol / esSeccion", () => {
  it("reconoce solo los valores válidos", () => {
    for (const rol of TODOS) expect(esRol(rol)).toBe(true);
    expect(esRol("invitado")).toBe(false);
    expect(esSeccion("metas")).toBe(true);
    expect(esSeccion("otra")).toBe(false);
  });
});
