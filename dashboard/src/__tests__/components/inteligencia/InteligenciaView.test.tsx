/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { PropsGrafico } from "@/components/productividad/Grafico";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/dashboard/inteligencia",
  useSearchParams: () => mockParams,
}));

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({ __esModule: true, default: (...args: unknown[]) => mockUseSWR(...args) }));

const mockFetcher = jest.fn();
jest.mock("@/lib/fetcher", () => {
  const real = jest.requireActual("@/lib/fetcher");
  return { ...real, fetcher: (...args: unknown[]) => mockFetcher(...args) };
});

// Sin espera en la búsqueda
jest.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: <T,>(v: T) => v }));

const mockGraficos: Record<string, PropsGrafico> = {};
jest.mock("@/components/productividad/Grafico", () => ({
  Grafico: (props: PropsGrafico) => {
    mockGraficos[props.etiqueta] = props;
    return <div role="img" aria-label={props.etiqueta} />;
  },
}));

import InteligenciaView from "@/components/inteligencia/InteligenciaView";
import { RolProvider } from "@/components/layout/RolContext";
import { OBJETOS, RELACIONES, colorTipo } from "@/lib/inteligencia/ontologia";
import type { Nodo } from "@/lib/inteligencia/grafo";
import { PERMISOS_POR_DEFECTO } from "@/lib/acceso";

/* ── Fixtures ── */

const PERIODO = { clave: "202610", etiqueta: "Oct 2026", etiqueta_larga: "Octubre 2026", fecha_inicial: "2026-10-01", fecha_final: "2026-10-31" };
const CONTEXTO = {
  granularidad: "mensual",
  periodo: PERIODO,
  periodos: {
    mensual: [{ ...PERIODO, clave: "202609", etiqueta_larga: "Septiembre 2026" }, PERIODO],
    semanal: [{ clave: "2026-11-09", etiqueta: "9–15 nov", etiqueta_larga: "9–15 nov 2026", fecha_inicial: "2026-11-09", fecha_final: "2026-11-15" }],
  },
  periodo_autorizaciones: 202610,
  atribucion: "nombre",
};
const ESQUEMA = {
  ...CONTEXTO,
  modo: "esquema",
  esquema: {
    tipos: OBJETOS.map((o, i) => ({ ...o, color: colorTipo(o.clave), cantidad: (i + 1) * 10 })),
    relaciones: RELACIONES.map((r) => ({ ...r, cantidad: 3 })),
  },
};

const nodo = (id: string, etiqueta: string, peso: number, propiedades: Nodo["propiedades"] = []): Nodo => {
  const i = id.indexOf(":");
  return { id, tipo: id.slice(0, i) as Nodo["tipo"], clave: id.slice(i + 1), etiqueta, peso, propiedades };
};

const PROF = nodo("profesional:1053", "PROFESIONAL A", 140, [
  { etiqueta: "Documento", valor: "1053", formato: "texto" },
  { etiqueta: "Área principal", valor: "Medicina general", formato: "texto" },
  { etiqueta: "% inasistencia", valor: 0.085, formato: "pct" },
  { etiqueta: "Citas asignadas", valor: 1400, formato: "numero" },
]);
const SERV = nodo("servicio:11", "CONSULTA", 160);
const CAT = nodo("categoria:rx", "Radiografías", 7);
const VECINDARIO = {
  ...CONTEXTO,
  modo: "vecindario",
  vecindario: {
    centro: PROF,
    nodos: [PROF, SERV, CAT],
    aristas: [
      { id: "atiende|profesional:1053|servicio:11", relacion: "atiende", origen: PROF.id, destino: SERV.id, peso: 100, metricas: { asignadas: 100 } },
      { id: "ordena|profesional:1053|categoria:rx", relacion: "ordena", origen: PROF.id, destino: CAT.id, peso: 7, metricas: { ordenes: 7 } },
    ],
    mas: [{ relacion: "atiende", tipo: "servicio", mostrados: 1, total: 4 }],
  },
};

type Estado = { data?: unknown; error?: unknown; isLoading?: boolean };
let respuestas: Record<string, Estado>;

function claves(): string[] {
  return mockUseSWR.mock.calls.map((c) => c[0]).filter(Boolean) as string[];
}

function mockSWR() {
  mockUseSWR.mockImplementation((clave: string | null) => {
    const base = { data: undefined, error: undefined, isLoading: false, isValidating: false, mutate: jest.fn() };
    if (!clave) return base;
    const modo = clave.startsWith("/api/productividad")
      ? "productividad"
      : new URLSearchParams(clave.split("?")[1]).get("modo") ?? "";
    return { ...base, ...(respuestas[modo] ?? {}) };
  });
}

function renderVista(rol: "admin" | "coordinador" = "admin") {
  return render(
    <RolProvider rol={rol} permisos={PERMISOS_POR_DEFECTO[rol]}>
      <InteligenciaView />
    </RolProvider>,
  );
}

function ultimaUrl() {
  const url = mockPush.mock.calls[mockPush.mock.calls.length - 1][0] as string;
  return Object.fromEntries(new URLSearchParams(url.split("?")[1] ?? ""));
}

describe("InteligenciaView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(mockGraficos)) delete mockGraficos[k];
    mockParams = new URLSearchParams();
    respuestas = { esquema: { data: ESQUEMA }, vecindario: { data: VECINDARIO } };
    mockSWR();
  });

  describe("estructura", () => {
    it("muestra el encabezado y las pestañas; Alertas está deshabilitada", () => {
      renderVista();
      expect(screen.getByRole("heading", { name: "Inteligencia" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Mapa de relaciones" })).toHaveAttribute("aria-selected", "true");
      const simulador = screen.getByRole("tab", { name: "Simulador" });
      expect(simulador).toBeEnabled();
      expect(simulador).toHaveAttribute("aria-selected", "false");
      const alertas = screen.getByRole("tab", { name: /Alertas/ });
      expect(alertas).toBeDisabled();
      expect(alertas).toHaveTextContent("Próximamente");
    });

    it("la pestaña Simulador conserva el periodo y suelta el nodo", () => {
      mockParams = new URLSearchParams("periodo=202609&nodo=profesional%3A1053");
      renderVista();
      fireEvent.click(screen.getByRole("tab", { name: "Simulador" }));
      expect(ultimaUrl()).toEqual({ pestana: "simulador", periodo: "202609" });
    });

    it("sin nodo en la URL consulta el esquema y dibuja el modelo", () => {
      renderVista();
      expect(claves()).toContain("/api/inteligencia/grafo?modo=esquema");
      expect(claves().some((c) => c.includes("modo=vecindario"))).toBe(false);
      expect(screen.getByRole("img", { name: "Modelo de relaciones" })).toBeInTheDocument();
    });

    it("la leyenda lista los tipos con su conteo", () => {
      renderVista();
      const leyenda = screen.getByRole("list", { name: "Tipos de objeto" });
      expect(within(leyenda).getByRole("button", { name: /Profesionales.*30/ })).toBeInTheDocument();
    });

    it("muestra el esqueleto mientras carga y el error si falla", () => {
      respuestas.esquema = { isLoading: true };
      const { unmount } = renderVista();
      expect(screen.getByTestId("inteligencia-cargando")).toBeInTheDocument();
      unmount();
      respuestas.esquema = { error: new Error("Error al consultar los datos") };
      renderVista();
      expect(screen.getByRole("alert")).toHaveTextContent("Error al consultar los datos");
    });

    it("sin cargas de citas muestra el estado vacío", () => {
      respuestas.esquema = { data: { ...ESQUEMA, periodo: null, periodos: { mensual: [], semanal: [] } } };
      renderVista();
      expect(screen.getByText("Aún no hay informes de citas cargados")).toBeInTheDocument();
    });
  });

  describe("periodo", () => {
    it("cambiar el mes navega con el periodo y conserva el nodo", () => {
      mockParams = new URLSearchParams("nodo=profesional%3A1053");
      renderVista();
      fireEvent.change(screen.getByLabelText("Mes"), { target: { value: "202609" } });
      expect(ultimaUrl()).toEqual({ periodo: "202609", nodo: "profesional:1053" });
    });

    it("cambiar a semanal reinicia el periodo", () => {
      renderVista();
      fireEvent.click(screen.getByRole("button", { name: "Semanal" }));
      expect(ultimaUrl()).toEqual({ granularidad: "semanal" });
    });

    it("pasa periodo y granularidad a la API", () => {
      mockParams = new URLSearchParams("granularidad=semanal&periodo=2026-11-09");
      renderVista();
      expect(claves()).toContain("/api/inteligencia/grafo?modo=esquema&granularidad=semanal&periodo=2026-11-09");
    });
  });

  describe("explorar instancias", () => {
    it("elegir un tipo en la leyenda lista sus instancias; elegir una centra el mapa en ella", () => {
      respuestas.buscar = { data: { ...CONTEXTO, modo: "buscar", resultados: [{ id: "servicio:11", tipo: "servicio", clave: "11", etiqueta: "CONSULTA", peso: 160 }] } };
      renderVista();
      fireEvent.click(screen.getByRole("button", { name: /Servicios/ }));
      expect(claves()).toContain("/api/inteligencia/grafo?modo=buscar&tipo=servicio&limite=100");
      fireEvent.click(screen.getByRole("button", { name: /CONSULTA/ }));
      expect(ultimaUrl()).toEqual({ nodo: "servicio:11" });
    });

    it("clic en un tipo del modelo también lista sus instancias", () => {
      renderVista();
      act(() => mockGraficos["Modelo de relaciones"].eventos!.click({ data: { tipo: "regional" } } as never));
      expect(claves()).toContain("/api/inteligencia/grafo?modo=buscar&tipo=regional&limite=100");
    });

    it("la búsqueda consulta con el texto desde 2 caracteres", () => {
      renderVista();
      const caja = screen.getByRole("searchbox", { name: "Buscar en el mapa" });
      fireEvent.change(caja, { target: { value: "c" } });
      expect(claves().some((c) => c.includes("modo=buscar"))).toBe(false);
      fireEvent.change(caja, { target: { value: "cons" } });
      expect(claves()).toContain("/api/inteligencia/grafo?modo=buscar&q=cons");
    });
  });

  describe("vecindario", () => {
    beforeEach(() => {
      mockParams = new URLSearchParams("nodo=profesional%3A1053");
    });

    it("consulta el vecindario del nodo de la URL y dibuja el grafo de instancias", () => {
      renderVista();
      expect(claves()).toContain("/api/inteligencia/grafo?modo=vecindario&tipo=profesional&id=1053");
      expect(screen.getByRole("img", { name: "Mapa de relaciones de PROFESIONAL A" })).toBeInTheDocument();
    });

    it("el panel de detalle muestra tipo, propiedades y enlaces a Productividad", () => {
      renderVista();
      const panel = screen.getByRole("region", { name: "Detalle" });
      expect(within(panel).getByRole("heading", { name: "PROFESIONAL A" })).toBeInTheDocument();
      expect(within(panel).getByText("Profesional")).toBeInTheDocument();
      expect(within(panel).getByText("8,5 %")).toBeInTheDocument();
      expect(within(panel).getByText("1.400")).toBeInTheDocument();
      expect(within(panel).getByRole("link", { name: "Abrir en Productividad" })).toHaveAttribute(
        "href", "/dashboard/productividad?periodo=202610&profesional=1053",
      );
      expect(within(panel).getByRole("link", { name: "Ver ficha" })).toHaveAttribute(
        "href", "/dashboard/productividad?periodo=202610&ficha=1053",
      );
    });

    it("sin acceso a Productividad no muestra los enlaces", () => {
      renderVista("coordinador");
      expect(screen.queryByRole("link", { name: "Abrir en Productividad" })).not.toBeInTheDocument();
    });

    it("muestra cuántos vecinos quedan ocultos", () => {
      renderVista();
      expect(screen.getByText("Se muestran 1 de 4 servicios")).toBeInTheDocument();
    });

    it("clic en un nodo lo centra (con su rastro) y el botón Volver regresa", () => {
      jest.useFakeTimers();
      const { rerender } = renderVista();
      act(() => {
        mockGraficos["Mapa de relaciones de PROFESIONAL A"].eventos!.click({ dataType: "node", data: { id: "servicio:11" } } as never);
        jest.runAllTimers();
      });
      expect(ultimaUrl()).toEqual({ nodo: "servicio:11" });

      mockParams = new URLSearchParams("nodo=servicio%3A11");
      respuestas.vecindario = { data: { ...VECINDARIO, vecindario: { ...VECINDARIO.vecindario, centro: SERV, mas: [] } } };
      rerender(
        <RolProvider rol="admin" permisos={PERMISOS_POR_DEFECTO.admin}>
          <InteligenciaView />
        </RolProvider>,
      );
      const rastro = screen.getByRole("navigation", { name: "Recorrido" });
      expect(within(rastro).getByRole("button", { name: "PROFESIONAL A" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Volver" }));
      expect(ultimaUrl()).toEqual({ nodo: "profesional:1053" });
      jest.useRealTimers();
    });

    it("doble clic expande el nodo sin perder el grafo actual", async () => {
      jest.useFakeTimers();
      mockFetcher.mockResolvedValue({
        ...VECINDARIO,
        vecindario: { centro: CAT, nodos: [CAT, nodo("regional:CENTRO", "CENTRO", 40)], aristas: [{ id: "x", relacion: "autorizada_en", origen: CAT.id, destino: "regional:CENTRO", peso: 40, metricas: {} }], mas: [] },
      });
      renderVista();
      const grafico = () => mockGraficos["Mapa de relaciones de PROFESIONAL A"];
      await act(async () => {
        grafico().eventos!.click({ dataType: "node", data: { id: CAT.id } } as never);
        grafico().eventos!.dblclick({ dataType: "node", data: { id: CAT.id } } as never);
        jest.runAllTimers();
      });
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockFetcher).toHaveBeenCalledWith("/api/inteligencia/grafo?modo=vecindario&tipo=categoria&id=rx");
      const ids = (grafico().opcion as { series: { data: { id: string }[] }[] }).series[0].data.map((d) => d.id);
      expect(ids).toEqual(["profesional:1053", "servicio:11", "categoria:rx", "regional:CENTRO"]);
      jest.useRealTimers();
    });

    it("los vecinos del panel se pueden centrar y expandir con el teclado", async () => {
      mockFetcher.mockResolvedValue(VECINDARIO);
      renderVista();
      const vecinos = screen.getByRole("list", { name: "Vecinos" });
      fireEvent.click(within(vecinos).getByRole("button", { name: "CONSULTA" }));
      expect(ultimaUrl()).toEqual({ nodo: "servicio:11" });
      await act(async () => {
        fireEvent.click(within(vecinos).getByRole("button", { name: "Expandir CONSULTA" }));
      });
      expect(mockFetcher).toHaveBeenCalledWith("/api/inteligencia/grafo?modo=vecindario&tipo=servicio&id=11");
    });

    it("un nodo que no existe en el periodo ofrece volver al modelo", () => {
      respuestas.vecindario = { error: new Error("El elemento no existe en el periodo") };
      renderVista();
      expect(screen.getByRole("alert")).toHaveTextContent("El elemento no existe en el periodo");
      fireEvent.click(screen.getByRole("button", { name: "Ver el modelo" }));
      expect(ultimaUrl()).toEqual({});
    });
  });
});

/* ── Simulador ── */

describe("InteligenciaView › Simulador", () => {
  const { indicadores, metricasVacias } = jest.requireActual("@/lib/productividad/metricas");
  const ACTUAL = indicadores({ ...metricasVacias(), ofertadas: 1000, disponibles: 100, asignadas: 900, inasistidas: 180 });
  const PRODUCTIVIDAD = {
    granularidad: "mensual",
    periodos: CONTEXTO.periodos,
    periodo: "202610",
    opciones: {
      areas: ["Medicina general", "Salud oral"],
      servicios: [
        { codigo: "50110", nombre: "CONSULTA MEDICINA", area: "Medicina general" },
        { codigo: "20", nombre: "HIGIENE ORAL", area: "Salud oral" },
      ],
      profesionales: [],
    },
    kpis: { actual: ACTUAL, anterior: null, periodo_anterior: null, serie: [] },
    profesionales: { con_agenda: 10, destacados: 0, lista: [] },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(mockGraficos)) delete mockGraficos[k];
    mockParams = new URLSearchParams("pestana=simulador");
    respuestas = { productividad: { data: PRODUCTIVIDAD } };
    mockSWR();
  });

  const ultimoReplace = () => {
    const url = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    return Object.fromEntries(new URLSearchParams(url.split("?")[1] ?? ""));
  };

  it("selecciona la pestaña y consulta productividad, no el grafo", () => {
    renderVista();
    expect(screen.getByRole("tab", { name: "Simulador" })).toHaveAttribute("aria-selected", "true");
    expect(claves()).toEqual(expect.arrayContaining(["/api/productividad"]));
    expect(claves().some((c) => c.startsWith("/api/inteligencia"))).toBe(false);
  });

  it("pasa periodo, área y servicio a la API", () => {
    mockParams = new URLSearchParams("pestana=simulador&periodo=202609&area=Medicina+general&servicio=50110");
    renderVista();
    expect(claves()).toContain("/api/productividad?periodo=202609&area=Medicina+general&servicio=50110");
  });

  it("con las palancas reales el escenario es igual a la realidad", () => {
    renderVista();
    expect(screen.getByText("Mueva las palancas para comparar un escenario con lo que pasó en el periodo.")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Atendidas" })).getByText("= sin cambio")).toBeInTheDocument();
  });

  it("lee las palancas de la URL y resume el escenario", () => {
    mockParams = new URLSearchParams("pestana=simulador&prof=5&inas=10");
    renderVista();
    expect(screen.getByRole("slider", { name: "Δ profesionales" })).toHaveValue("5");
    expect(
      screen.getByText(/^Con 5 profesionales más y la inasistencia en 10 %, se atenderían 495 citas más en el periodo/)
    ).toBeInTheDocument();
  });

  it("mover una palanca reemplaza la URL", () => {
    renderVista();
    fireEvent.change(screen.getByRole("slider", { name: "Δ profesionales" }), { target: { value: "3" } });
    expect(ultimoReplace()).toEqual({ pestana: "simulador", prof: "3" });
  });

  it("Llevar a la meta fija la inasistencia en 9,9 % y Restablecer todo limpia las palancas", () => {
    mockParams = new URLSearchParams("pestana=simulador&prof=2");
    renderVista();
    fireEvent.click(screen.getByRole("button", { name: /Llevar a la meta/ }));
    expect(ultimoReplace()).toEqual({ pestana: "simulador", prof: "2", inas: "9.9" });
    fireEvent.click(screen.getByRole("button", { name: "Restablecer todo" }));
    expect(ultimoReplace()).toEqual({ pestana: "simulador" });
    fireEvent.click(screen.getByRole("button", { name: "Restablecer Δ profesionales" }));
    expect(ultimoReplace()).toEqual({ pestana: "simulador" });
  });

  it("cambiar el periodo conserva las palancas", () => {
    mockParams = new URLSearchParams("pestana=simulador&prof=5");
    renderVista();
    fireEvent.change(screen.getByLabelText("Mes"), { target: { value: "202609" } });
    expect(ultimaUrl()).toEqual({ pestana: "simulador", periodo: "202609", prof: "5" });
  });

  it("el área filtra los servicios y al cambiarla se suelta el servicio", () => {
    mockParams = new URLSearchParams("pestana=simulador&area=Medicina+general&servicio=50110");
    renderVista();
    const servicio = screen.getByLabelText("Servicio");
    expect(within(servicio).getAllByRole("option").map((o) => o.textContent)).toEqual(["Todos", "CONSULTA MEDICINA"]);
    fireEvent.change(screen.getByLabelText("Área"), { target: { value: "Salud oral" } });
    expect(ultimaUrl()).toEqual({ pestana: "simulador", area: "Salud oral" });
    fireEvent.change(servicio, { target: { value: "" } });
    expect(ultimaUrl()).toEqual({ pestana: "simulador", area: "Medicina general" });
  });

  it("volver al mapa conserva granularidad y periodo", () => {
    mockParams = new URLSearchParams("pestana=simulador&periodo=202609&area=Salud+oral&prof=1");
    renderVista();
    fireEvent.click(screen.getByRole("tab", { name: "Mapa de relaciones" }));
    expect(ultimaUrl()).toEqual({ periodo: "202609" });
  });

  it("estados de carga, error, sin permiso, sin cargas y sin citas en el filtro", () => {
    const { FetchError } = jest.requireActual("@/lib/fetcher");
    respuestas.productividad = { isLoading: true };
    let r = renderVista();
    expect(screen.getByTestId("simulador-cargando")).toBeInTheDocument();
    r.unmount();

    respuestas.productividad = { error: new Error("Error al consultar los datos") };
    r = renderVista();
    expect(screen.getByRole("alert")).toHaveTextContent("Error al consultar los datos");
    r.unmount();

    respuestas.productividad = { error: new FetchError("Prohibido", 403, null) };
    r = renderVista();
    expect(screen.getByRole("alert")).toHaveTextContent("El simulador usa los datos de Productividad");
    r.unmount();

    respuestas.productividad = { data: { ...PRODUCTIVIDAD, periodo: null, kpis: { ...PRODUCTIVIDAD.kpis, actual: null } } };
    r = renderVista();
    expect(screen.getByText("Aún no hay informes de citas cargados")).toBeInTheDocument();
    r.unmount();

    respuestas.productividad = {
      data: { ...PRODUCTIVIDAD, kpis: { ...PRODUCTIVIDAD.kpis, actual: indicadores(metricasVacias()) }, profesionales: { con_agenda: 0, destacados: 0, lista: [] } },
    };
    renderVista();
    expect(screen.getByText("No hay citas ofertadas con este filtro en el periodo")).toBeInTheDocument();
  });
});
