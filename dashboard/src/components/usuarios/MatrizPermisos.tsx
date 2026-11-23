"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  ROLES_CONFIGURABLES,
  SECCIONES,
  etiquetaRol,
  type CambioPermiso,
  type Nivel,
  type Permisos,
  type Rol,
} from "@/lib/acceso";

type Matriz = Record<Rol, Permisos>;

const URL_PERMISOS = "/api/admin/permisos";

const ETIQUETA_NIVEL: Record<Nivel, string> = {
  ninguno: "Sin acceso",
  ver: "Ver",
  editar: "Editar",
};

/** Celdas que difieren del valor guardado, en orden de rol y de sección. */
function diferencias(guardado: Matriz, borrador: Matriz): CambioPermiso[] {
  return ROLES_CONFIGURABLES.flatMap((rol) =>
    SECCIONES.filter((s) => s.configurable && borrador[rol][s.clave] !== guardado[rol][s.clave]).map(
      (s) => ({ rol, seccion: s.clave, nivel: borrador[rol][s.clave] }),
    ),
  );
}

function copiar(m: Matriz): Matriz {
  return Object.fromEntries(Object.entries(m).map(([rol, p]) => [rol, { ...p }])) as Matriz;
}

function describirCambio(c: CambioPermiso): string {
  const seccion = SECCIONES.find((s) => s.clave === c.seccion)!.etiqueta;
  return `${etiquetaRol(c.rol)} · ${seccion}: ${ETIQUETA_NIVEL[c.nivel]}`;
}

/* ── Íconos y botón de acción ── */

function IconoVer() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconoEditar() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4z" strokeLinejoin="round" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

type Accion = "ver" | "editar";

const ACCIONES: { clave: Accion; etiqueta: string; Icono: () => JSX.Element }[] = [
  { clave: "ver", etiqueta: "Ver", Icono: IconoVer },
  { clave: "editar", etiqueta: "Editar", Icono: IconoEditar },
];

/** Una acción está activa si el nivel la incluye: editar incluye ver. */
function incluye(nivel: Nivel, accion: Accion): boolean {
  return accion === "ver" ? nivel !== "ninguno" : nivel === "editar";
}

/** Nivel resultante al pulsar una acción: activar editar activa ver; quitar ver quita editar. */
function alternar(nivel: Nivel, accion: Accion): Nivel {
  if (accion === "ver") return nivel === "ninguno" ? "ver" : "ninguno";
  return nivel === "editar" ? "ver" : "editar";
}

function BotonAccion({
  etiqueta,
  activo,
  deshabilitado,
  modificado,
  onClick,
  children,
}: {
  etiqueta: string;
  activo: boolean;
  deshabilitado: boolean;
  modificado: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      aria-pressed={activo}
      disabled={deshabilitado}
      onClick={onClick}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-lg transition-colors ${
        activo ? "bg-brand-navy text-white" : "bg-gray-100 text-gray-300"
      } ${deshabilitado ? (activo ? "opacity-60 cursor-not-allowed" : "opacity-50 cursor-not-allowed") : activo ? "hover:bg-brand-navy-dark" : "hover:bg-gray-200 hover:text-gray-500"} ${
        modificado ? "ring-2 ring-amber-400 ring-offset-1" : ""
      }`}
    >
      {children}
    </button>
  );
}

/** Matriz de permisos por rol (Administración › Usuarios). Solo admin la ve. */
export function MatrizPermisos() {
  const { data, error, isLoading, mutate } = useSWR<{ permisos: Matriz }>(URL_PERMISOS, fetcher);
  const [borrador, setBorrador] = useState<Matriz | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");
  const [confirmacion, setConfirmacion] = useState<string[] | null>(null);

  useEffect(() => {
    if (data) setBorrador(copiar(data.permisos));
  }, [data]);

  const cambios = useMemo(
    () => (data && borrador ? diferencias(data.permisos, borrador) : []),
    [data, borrador],
  );

  function cambiar(rol: Rol, seccion: CambioPermiso["seccion"], nivel: Nivel) {
    setConfirmacion(null);
    setBorrador((b) => (b ? { ...b, [rol]: { ...b[rol], [seccion]: nivel } } : b));
  }

  async function guardar() {
    setGuardando(true);
    setErrorGuardar("");
    setConfirmacion(null);
    try {
      const res = await fetch(URL_PERMISOS, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cambios }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorGuardar(json.error ?? "No se pudieron guardar los permisos");
        return;
      }
      setConfirmacion(cambios.map(describirCambio));
      await mutate({ permisos: json.permisos }, { revalidate: false });
    } catch {
      setErrorGuardar("No se pudieron guardar los permisos");
    } finally {
      setGuardando(false);
    }
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error.message ?? "No se pudieron cargar los permisos"}
      </p>
    );
  }
  if (isLoading || !data || !borrador) {
    return <p className="text-sm text-gray-400 py-10 text-center">Cargando…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Defina qué secciones abre cada rol. <strong>Ver</strong> permite consultar;{" "}
        <strong>Editar</strong> además cargar, guardar o eliminar. El administrador siempre tiene acceso
        total y la gestión de usuarios es solo suya. Los cambios aplican de inmediato, sin volver a iniciar
        sesión.
      </p>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        {ACCIONES.map(({ clave, etiqueta, Icono }) => (
          <span key={clave} className="inline-flex items-center gap-1.5">
            <Icono />
            {etiqueta}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded ring-2 ring-amber-400" /> Cambio sin guardar
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-navy">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Sección</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap">
                {etiquetaRol("admin")}
              </th>
              {ROLES_CONFIGURABLES.map((rol) => (
                <th key={rol} className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap">
                  {etiquetaRol(rol)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {SECCIONES.map((s) => (
              <tr key={s.clave}>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-800">{s.etiqueta}</span>
                  <p className="text-xs text-gray-400">{s.descripcion}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1.5">
                    {ACCIONES.map(({ clave, etiqueta, Icono }) => (
                      <BotonAccion
                        key={clave}
                        etiqueta={`${etiqueta} ${s.etiqueta} — ${etiquetaRol("admin")}`}
                        activo={clave === "ver" || s.admiteEdicion || !s.configurable}
                        deshabilitado
                        modificado={false}
                      >
                        <Icono />
                      </BotonAccion>
                    ))}
                  </div>
                </td>
                {ROLES_CONFIGURABLES.map((rol) => {
                  const nivel = borrador[rol][s.clave];
                  const guardadoNivel = data.permisos[rol][s.clave];
                  return (
                    <td key={rol} className="px-4 py-3">
                      <div className="flex justify-center gap-1.5">
                        {ACCIONES.map(({ clave, etiqueta, Icono }) => (
                          <BotonAccion
                            key={clave}
                            etiqueta={`${etiqueta} ${s.etiqueta} — ${etiquetaRol(rol)}`}
                            activo={incluye(nivel, clave)}
                            deshabilitado={guardando || !s.configurable || (clave === "editar" && !s.admiteEdicion)}
                            modificado={incluye(nivel, clave) !== incluye(guardadoNivel, clave)}
                            onClick={() => cambiar(rol, s.clave, alternar(nivel, clave))}
                          >
                            <Icono />
                          </BotonAccion>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errorGuardar && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errorGuardar}
        </p>
      )}

      {confirmacion && (
        <div role="status" className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
          <p className="font-semibold">
            Se guardaron {confirmacion.length} {confirmacion.length === 1 ? "cambio" : "cambios"}:
          </p>
          <ul className="list-disc ml-5">
            {confirmacion.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || cambios.length === 0}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-navy-dark disabled:opacity-60 transition-colors"
        >
          {guardando ? "Guardando…" : "Guardar permisos"}
        </button>
        <button
          type="button"
          onClick={() => {
            setBorrador(copiar(data.permisos));
            setErrorGuardar("");
          }}
          disabled={guardando || cambios.length === 0}
          className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-60"
        >
          Descartar
        </button>
        {cambios.length > 0 && !guardando && (
          <span className="text-xs text-amber-700">
            {cambios.length} {cambios.length === 1 ? "cambio sin guardar" : "cambios sin guardar"}
          </span>
        )}
      </div>
    </div>
  );
}
