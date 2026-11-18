"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher, FetchError } from "@/lib/fetcher";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  leerEstado,
  leerPestana,
  queryEstado,
  queryPestana,
  MAX_LIMITE,
  type EstadoInteligencia,
  type Pestana,
} from "@/lib/inteligencia/parametros";
import { parseIdNodo, type TipoObjeto } from "@/lib/inteligencia/ontologia";
import { fusionarSubgrafos, type Subgrafo } from "@/lib/inteligencia/grafica";
import type { RespuestaBusqueda, RespuestaEsquema, RespuestaVecindario } from "@/lib/inteligencia/tipos";
import type { Granularidad } from "@/lib/productividad/periodos";
import { usePuedeVer } from "@/components/layout/RolContext";
import { Spinner } from "@/components/ui/Spinner";
import { clasesBoton } from "@/components/ui/Boton";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { MapaInstancias, MapaModelo } from "./MapaRelaciones";
import { PanelDetalle } from "./PanelDetalle";
import { PanelExplorar } from "./PanelExplorar";
import { EncabezadoInteligencia } from "./PestanasInteligencia";
import { SimuladorVista } from "./SimuladorVista";
import { AlertasVista } from "./AlertasVista";
import { SelectorPeriodo } from "./SelectorPeriodo";

const API = "/api/inteligencia/grafo";
const RUTA_CITAS = "/admin/citas";
/** Espera para distinguir clic (centrar) de doble clic (expandir). */
const ESPERA_CLIC_MS = 250;

const opcionesSWR = {
  keepPreviousData: true,
  revalidateOnFocus: false,
  onErrorRetry(err: unknown, _key: string, _config: unknown, revalidate: (o: { retryCount: number }) => void, { retryCount }: { retryCount: number }) {
    if (err instanceof FetchError && err.status === 503 && retryCount < 5) {
      setTimeout(() => revalidate({ retryCount }), 3000 * (retryCount + 1));
    }
  },
};

/** URL de la API: modo y sus parámetros primero, luego granularidad y periodo. */
function urlApi(modo: string, extra: Record<string, string>, estado: EstadoInteligencia): string {
  const params = new URLSearchParams({ modo, ...extra });
  const contexto = queryEstado({ ...estado, nodo: null });
  return `${API}?${params.toString()}${contexto ? `&${contexto}` : ""}`;
}

function urlVecindario(id: string, estado: EstadoInteligencia): string | null {
  const nodo = parseIdNodo(id);
  return nodo ? urlApi("vecindario", { tipo: nodo.tipo, id: nodo.clave }, estado) : null;
}

/* ── Subcomponents ───────────────────────────────── */

function Esqueleto() {
  return (
    <div data-testid="inteligencia-cargando" className="grid grid-cols-1 lg:grid-cols-12 gap-3">
      <div className="lg:col-span-3 skeleton h-[420px] rounded-tarjeta" />
      <div className="lg:col-span-6 skeleton h-[560px] rounded-tarjeta" />
      <div className="lg:col-span-3 skeleton h-[420px] rounded-tarjeta" />
    </div>
  );
}

function Alerta({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="bg-critico-suave rounded-tarjeta border border-critico/20 p-6 text-sm text-critico">
      {children}
    </div>
  );
}

/* ── Component ──────────────────────────────────── */

/**
 * Contenedor de Inteligencia: la pestaña vive en la URL (`?pestana=simulador`;
 * sin ella, el mapa). Al cambiar de pestaña se conservan granularidad y periodo.
 */
export default function InteligenciaView() {
  const searchParams = useSearchParams();
  const pestana = leerPestana(new URLSearchParams(searchParams.toString()));
  if (pestana === "simulador") return <SimuladorVista />;
  if (pestana === "alertas") return <AlertasVista />;
  return <VistaMapa />;
}

/**
 * Inteligencia › Mapa de relaciones. El nodo centrado y el
 * periodo viven en la URL (compartible, botón Atrás); la búsqueda, el rastro
 * de nodos visitados y las expansiones viven en el estado del componente.
 */
function VistaMapa() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const veProductividad = usePuedeVer("/dashboard/productividad");
  const veCitas = usePuedeVer(RUTA_CITAS);

  const estado = useMemo(() => leerEstado(new URLSearchParams(searchParams.toString())), [searchParams]);
  const { nodo } = estado;

  /* ── Datos ── */

  const esquemaR = useSWR<RespuestaEsquema>(urlApi("esquema", {}, estado), fetcher, opcionesSWR);
  const vecindarioR = useSWR<RespuestaVecindario>(nodo ? urlVecindario(nodo, estado) : null, fetcher, opcionesSWR);

  const [texto, setTexto] = useState("");
  const [tipoLista, setTipoLista] = useState<TipoObjeto | null>(null);
  const q = useDebouncedValue(texto.trim(), 300);
  const claveBusqueda =
    q.length >= 2
      ? urlApi("buscar", { q }, estado)
      : tipoLista
        ? urlApi("buscar", { tipo: tipoLista, limite: String(MAX_LIMITE) }, estado)
        : null;
  const busquedaR = useSWR<RespuestaBusqueda>(claveBusqueda, fetcher, opcionesSWR);

  /* ── Navegación ── */

  const navegar = useCallback(
    (e: EstadoInteligencia) => {
      const qs = queryEstado(e);
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );
  const centrar = useCallback((id: string | null) => navegar({ ...estado, nodo: id }), [navegar, estado]);

  const onGranularidad = (granularidad: Granularidad) => navegar({ ...estado, granularidad, periodo: null });
  const onPeriodo = (periodo: string) => navegar({ ...estado, periodo });

  /* ── Rastro de nodos visitados ── */

  const [rastro, setRastro] = useState<string[]>([]);
  const [etiquetas, setEtiquetas] = useState<Record<string, string>>({});
  useEffect(() => {
    setRastro((r) => {
      if (!nodo) return [];
      const i = r.indexOf(nodo);
      return i >= 0 ? r.slice(0, i + 1) : [...r, nodo];
    });
  }, [nodo]);

  const vecindario = vecindarioR.data?.vecindario ?? null;
  useEffect(() => {
    if (!vecindario) return;
    setEtiquetas((e) => ({ ...e, ...Object.fromEntries(vecindario.nodos.map((n) => [n.id, n.etiqueta])) }));
  }, [vecindario]);

  /* ── Expansiones (doble clic o "+") ── */

  const [extras, setExtras] = useState<Subgrafo[]>([]);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [errorExpandir, setErrorExpandir] = useState<string | null>(null);
  const contextoClave = `${estado.granularidad}|${estado.periodo}|${nodo}`;
  useEffect(() => {
    setExtras([]);
    setExpandidos(new Set());
    setErrorExpandir(null);
  }, [contextoClave]);

  const expandir = useCallback(
    async (id: string) => {
      const url = urlVecindario(id, estado);
      if (!url || expandidos.has(id)) return;
      setExpandidos((s) => new Set(s).add(id));
      try {
        const r = (await fetcher(url)) as RespuestaVecindario;
        setExtras((x) => [...x, { nodos: r.vecindario.nodos, aristas: r.vecindario.aristas }]);
      } catch (err) {
        setErrorExpandir(err instanceof Error ? err.message : "No se pudo expandir el nodo");
      }
    },
    [estado, expandidos]
  );

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);
  const onClicNodo = useCallback(
    (id: string) => {
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        temporizador.current = null;
        if (id !== nodo) centrar(id);
      }, ESPERA_CLIC_MS);
    },
    [centrar, nodo]
  );
  const onDobleClicNodo = useCallback(
    (id: string) => {
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = null;
      void expandir(id);
    },
    [expandir]
  );
  const onTipoModelo = useCallback((tipo: string) => {
    setTexto("");
    setTipoLista(tipo as TipoObjeto);
  }, []);

  const subgrafo = useMemo<Subgrafo | null>(() => {
    if (!vecindario) return null;
    return extras.reduce(fusionarSubgrafos, { nodos: vecindario.nodos, aristas: vecindario.aristas });
  }, [vecindario, extras]);

  /* ── Render ── */

  const esquema = esquemaR.data?.esquema ?? null;
  const contexto = esquemaR.data ?? vecindarioR.data ?? null;
  const validando = (esquemaR.isValidating && !esquemaR.isLoading) || vecindarioR.isLoading || vecindarioR.isValidating;

  const onPestana = (p: Pestana) => {
    if (p === "mapa") return;
    router.push(`${pathname}?${queryPestana(p, { granularidad: estado.granularidad, periodo: estado.periodo })}`, { scroll: false });
  };


  const encabezado = (
    <EncabezadoInteligencia pestana="mapa" onPestana={onPestana}>
      {validando && <Spinner className="h-4 w-4 text-primario/50" />}
      {contexto && (
        <SelectorPeriodo
          granularidad={estado.granularidad}
          periodo={contexto.periodo?.clave ?? null}
          periodos={contexto.periodos}
          onGranularidad={onGranularidad}
          onPeriodo={onPeriodo}
        />
      )}
    </EncabezadoInteligencia>
  );

  if (esquemaR.error && !esquemaR.data) {
    return (
      <div className="space-y-4">
        {encabezado}
        <Alerta>{esquemaR.error instanceof Error ? esquemaR.error.message : "Error al consultar los datos"}</Alerta>
      </div>
    );
  }

  if (!esquemaR.data || !esquema) {
    return (
      <div className="space-y-4">
        {encabezado}
        <Esqueleto />
      </div>
    );
  }

  if (esquemaR.data.periodo === null) {
    return (
      <div className="space-y-4">
        {encabezado}
        <EstadoVacio
          titulo="Aún no hay informes de citas cargados"
          descripcion="El mapa se arma por periodo a partir de las cargas de citas."
          accion={
            veCitas && (
              <Link href={RUTA_CITAS} className={clasesBoton({ variante: "secundario" })}>
                Ir a Citas
              </Link>
            )
          }
        />
      </div>
    );
  }

  const periodoClave = esquemaR.data.periodo.clave;
  const centro = vecindario && vecindario.centro.id === nodo ? vecindario.centro : null;
  const resultados = claveBusqueda ? busquedaR.data?.resultados ?? null : null;

  let mapa: React.ReactNode;
  if (!nodo) {
    mapa = <MapaModelo esquema={esquema} onTipo={onTipoModelo} />;
  } else if (vecindarioR.error && !centro) {
    mapa = (
      <Alerta>
        <p>{vecindarioR.error instanceof Error ? vecindarioR.error.message : "Error al consultar los datos"}</p>
        <button type="button" onClick={() => centrar(null)} className="mt-3 text-sm font-semibold text-brand-navy underline">
          Ver el modelo
        </button>
      </Alerta>
    );
  } else if (!subgrafo || !vecindario) {
    mapa = <div data-testid="mapa-cargando" className="skeleton h-[460px] sm:h-[560px] rounded-xl" />;
  } else {
    mapa = (
      <MapaInstancias
        subgrafo={subgrafo}
        centro={vecindario.centro.id}
        etiqueta={vecindario.centro.etiqueta}
        onClic={onClicNodo}
        onDobleClic={onDobleClicNodo}
      />
    );
  }

  const anterior = rastro.length >= 2 ? rastro[rastro.length - 2] : null;

  return (
    <div className="space-y-3">
      {encabezado}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        <div className="lg:col-span-3 min-w-0">
          <PanelExplorar
            tipos={esquema.tipos}
            tipoActivo={q.length >= 2 ? null : tipoLista}
            texto={texto}
            resultados={resultados}
            buscando={busquedaR.isLoading}
            onTexto={(t) => {
              setTexto(t);
              if (t.trim().length >= 2) setTipoLista(null);
            }}
            onTipo={(t) => {
              setTexto("");
              setTipoLista(t);
            }}
            onElegir={(id) => centrar(id)}
          />
        </div>

        <section aria-label="Mapa" className="lg:col-span-6 min-w-0 bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2 min-h-[28px]">
            {nodo ? (
              <>
                <button
                  type="button"
                  onClick={() => centrar(anterior)}
                  className="text-xs font-semibold text-brand-navy border border-borde rounded-lg px-2 py-1 hover:bg-superficie-2"
                >
                  Volver
                </button>
                <nav aria-label="Recorrido" className="flex-1 min-w-0">
                  <ol className="flex flex-wrap items-center gap-1 text-xs text-tinta-3">
                    <li>
                      <button type="button" onClick={() => centrar(null)} className="hover:text-brand-navy hover:underline">
                        Modelo
                      </button>
                    </li>
                    {rastro.map((id) => (
                      <li key={id} className="flex items-center gap-1 min-w-0">
                        <span aria-hidden>›</span>
                        {id === nodo ? (
                          <span aria-current="page" className="font-semibold text-brand-navy truncate max-w-[180px]">
                            {etiquetas[id] ?? parseIdNodo(id)?.clave}
                          </span>
                        ) : (
                          <button type="button" onClick={() => centrar(id)} className="truncate max-w-[180px] hover:text-brand-navy hover:underline">
                            {etiquetas[id] ?? parseIdNodo(id)?.clave}
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                </nav>
              </>
            ) : (
              <p className="text-xs text-tinta-3">
                Modelo de la IPS en {esquemaR.data.periodo.etiqueta_larga}. Clic en un tipo para ver sus instancias.
              </p>
            )}
          </div>
          {mapa}
          {nodo && centro && (
            <p className="text-[11px] text-tinta-3 mt-2">
              Clic en un nodo para centrarlo; doble clic para agregar sus relaciones. Arrastre para mover y use la rueda para acercar.
            </p>
          )}
          {errorExpandir && (
            <p role="status" className="text-xs text-critico mt-1">
              {errorExpandir}
            </p>
          )}
        </section>

        <div className="lg:col-span-3 min-w-0">
          <PanelDetalle
            nodo={centro}
            esquema={esquema}
            vecinos={vecindario && centro ? vecindario.nodos.slice(1) : []}
            aristas={vecindario && centro ? vecindario.aristas : []}
            mas={vecindario && centro ? vecindario.mas : []}
            expandidos={expandidos}
            granularidad={estado.granularidad}
            periodo={periodoClave}
            veProductividad={veProductividad}
            onCentrar={(id) => centrar(id)}
            onExpandir={(id) => void expandir(id)}
          />
        </div>
      </div>
    </div>
  );
}
