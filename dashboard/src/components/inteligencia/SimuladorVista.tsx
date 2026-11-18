"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo } from "react";
import useSWR from "swr";
import { fetcher, FetchError } from "@/lib/fetcher";
import {
  leerEstadoSimulador,
  queryEstadoSimulador,
  queryPestana,
  type EstadoSimulador,
  type Pestana,
} from "@/lib/inteligencia/parametros";
import {
  baseDesdeIndicadores,
  limitesPalancas,
  normalizarPalancas,
  OBJETIVO_META_INASISTENCIA,
  palancasBase,
  resultadoBase,
  resumenEscenario,
  simular,
  type ClavePalanca,
  type Palancas,
} from "@/lib/inteligencia/simulador";
import { aQueryString } from "@/lib/productividad/filtros";
import { META_INASISTENCIA } from "@/lib/productividad/metricas";
import type { Granularidad } from "@/lib/productividad/periodos";
import type { RespuestaProductividad } from "@/lib/productividad/tipos";
import { usePuedeVer } from "@/components/layout/RolContext";
import { Spinner } from "@/components/ui/Spinner";
import { EncabezadoInteligencia } from "./PestanasInteligencia";
import { SelectorPeriodo } from "./SelectorPeriodo";
import { SimuladorPalancas } from "./SimuladorPalancas";
import { SimuladorResultados } from "./SimuladorResultados";
import { CLASES_CAMPO, CLASES_ETIQUETA_CAMPO } from "@/components/ui/clases";

const API = "/api/productividad";
const RUTA_CITAS = "/admin/citas";
const TOLERANCIA = 1e-9;

const opcionesSWR = { keepPreviousData: true, revalidateOnFocus: false };

/* ── Subcomponents ───────────────────────────────── */

function Esqueleto() {
  return (
    <div data-testid="simulador-cargando" className="grid grid-cols-1 lg:grid-cols-12 gap-3">
      <div className="lg:col-span-4 skeleton h-[480px] rounded-tarjeta" />
      <div className="lg:col-span-8 skeleton h-[480px] rounded-tarjeta" />
    </div>
  );
}

function Aviso({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-10 text-center">
      <p className="text-base font-semibold text-primario">{titulo}</p>
      {children}
    </div>
  );
}

function Filtro({
  etiqueta,
  valor,
  todos,
  opciones,
  onCambiar,
}: {
  etiqueta: string;
  valor: string | null;
  todos: string;
  opciones: { valor: string; texto: string }[];
  onCambiar: (v: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className={CLASES_ETIQUETA_CAMPO}>
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor ?? ""}
        onChange={(e) => onCambiar(e.target.value || null)}
        className={`${CLASES_CAMPO} max-w-[220px]`}
      >
        <option value="">{todos}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}

function mensajeError(error: unknown): string {
  if (error instanceof FetchError && error.status === 403) {
    return "El simulador usa los datos de Productividad y su rol no tiene acceso a esa sección.";
  }
  return error instanceof Error ? error.message : "Error al consultar los datos";
}

/* ── Component ──────────────────────────────────── */

/**
 * Inteligencia › Simulador "¿qué pasa si…?". Toma los totales del periodo de
 * GET /api/productividad (con área y servicio) y proyecta un escenario con
 * las palancas. Todo el estado vive en la URL para compartir el escenario;
 * al cambiar periodo o filtros las palancas movidas se conservan (ver
 * EstadoSimulador) y se recortan a los límites de la nueva base.
 */
export function SimuladorVista() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const veCitas = usePuedeVer(RUTA_CITAS);

  const estado = useMemo(() => leerEstadoSimulador(new URLSearchParams(searchParams.toString())), [searchParams]);

  const qsApi = aQueryString({ ...estado, profesional: null });
  const { data, error, isValidating, isLoading } = useSWR<RespuestaProductividad>(
    qsApi ? `${API}?${qsApi}` : API,
    fetcher,
    opcionesSWR
  );

  /* ── Navegación ── */

  const navegar = (e: EstadoSimulador, reemplazar = false) => {
    const url = `${pathname}?${queryEstadoSimulador(e)}`;
    if (reemplazar) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  };

  const onPestana = (p: Pestana) => {
    if (p === "simulador") return;
    const qs = queryPestana(p, { granularidad: estado.granularidad, periodo: estado.periodo });
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const onGranularidad = (granularidad: Granularidad) => navegar({ ...estado, granularidad, periodo: null });
  const onPeriodo = (periodo: string) => navegar({ ...estado, periodo });
  const onArea = (area: string | null) => navegar({ ...estado, area, servicio: null });
  const onServicio = (servicio: string | null) => navegar({ ...estado, servicio });

  /* ── Modelo ── */

  const base = data ? baseDesdeIndicadores(data.kpis.actual, data.profesionales.con_agenda) : null;
  const modelo = useMemo(() => {
    if (!base) return null;
    const real = palancasBase(base);
    const palancas = normalizarPalancas(base, { ...real, ...estado.palancas });
    const actual = resultadoBase(base);
    const escenario = simular(base, palancas);
    return {
      real,
      palancas,
      limites: limitesPalancas(base),
      actual,
      escenario,
      resumen: resumenEscenario(actual, escenario, palancas, real),
    };
    // base se deriva de data: se memoriza por sus valores
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base?.ofertadas, base?.disponibles, base?.asignadas, base?.inasistidas, base?.profesionales, estado.palancas]);

  /** Guarda la palanca recortada; si vuelve al valor real se quita de la URL. */
  const fijarPalancas = (cambios: Partial<Palancas>) => {
    if (!base || !modelo) return;
    const efectivas = normalizarPalancas(base, { ...modelo.palancas, ...cambios });
    const palancas: Partial<Palancas> = { ...estado.palancas };
    for (const clave of Object.keys(cambios) as ClavePalanca[]) {
      if (Math.abs(efectivas[clave] - modelo.real[clave]) < TOLERANCIA) delete palancas[clave];
      else palancas[clave] = efectivas[clave];
    }
    navegar({ ...estado, palancas }, true);
  };
  const onRestablecer = (clave: ClavePalanca | null) => {
    if (clave === null) return navegar({ ...estado, palancas: {} }, true);
    const palancas = { ...estado.palancas };
    delete palancas[clave];
    navegar({ ...estado, palancas }, true);
  };

  /* ── Render ── */

  const areas = data?.opciones.areas ?? [];
  const servicios = (data?.opciones.servicios ?? []).filter((s) => !estado.area || s.area === estado.area);

  const encabezado = (
    <EncabezadoInteligencia pestana="simulador" onPestana={onPestana}>
      {isValidating && !isLoading && <Spinner className="h-4 w-4 text-primario/50" />}
      {data && (
        <>
          <SelectorPeriodo
            granularidad={estado.granularidad}
            periodo={data.periodo}
            periodos={data.periodos}
            onGranularidad={onGranularidad}
            onPeriodo={onPeriodo}
          />
          <Filtro
            etiqueta="Área"
            valor={estado.area}
            todos="Todas"
            opciones={areas.map((a) => ({ valor: a, texto: a }))}
            onCambiar={onArea}
          />
          <Filtro
            etiqueta="Servicio"
            valor={estado.servicio}
            todos="Todos"
            opciones={servicios.map((s) => ({ valor: s.codigo, texto: s.nombre }))}
            onCambiar={onServicio}
          />
        </>
      )}
    </EncabezadoInteligencia>
  );

  let cuerpo: React.ReactNode;
  if (error && !data) {
    cuerpo = (
      <div role="alert" className="bg-critico-suave rounded-tarjeta border border-critico/20 p-6 text-sm text-critico">
        {mensajeError(error)}
      </div>
    );
  } else if (!data) {
    cuerpo = <Esqueleto />;
  } else if (data.periodo === null) {
    cuerpo = (
      <Aviso titulo="Aún no hay informes de citas cargados">
        <p className="text-sm text-tinta-3 mt-1">El simulador parte de las cargas de citas de cada periodo.</p>
        {veCitas && (
          <Link href={RUTA_CITAS} className="inline-block mt-4 text-sm font-semibold text-primario underline">
            Ir a Citas
          </Link>
        )}
      </Aviso>
    );
  } else if (!base || !modelo || base.ofertadas === 0) {
    cuerpo = (
      <Aviso titulo="No hay citas ofertadas con este filtro en el periodo">
        <p className="text-sm text-tinta-3 mt-1">Elija otra área, otro servicio u otro periodo.</p>
      </Aviso>
    );
  } else {
    cuerpo = (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        <div className="lg:col-span-4 min-w-0">
          <SimuladorPalancas
            palancas={modelo.palancas}
            real={modelo.real}
            limites={modelo.limites}
            profesionalesBase={base.profesionales}
            onCambiar={(clave, valor) => fijarPalancas({ [clave]: valor })}
            onRestablecer={onRestablecer}
            onLlevarMeta={() => fijarPalancas({ pctInasistencia: OBJETIVO_META_INASISTENCIA })}
          />
        </div>
        <div className="lg:col-span-8 min-w-0">
          <SimuladorResultados base={modelo.actual} escenario={modelo.escenario} resumen={modelo.resumen} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {encabezado}
      {cuerpo}
    </div>
  );
}
