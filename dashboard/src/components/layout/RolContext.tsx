"use client";

import { createContext, useContext } from "react";
import { PERMISOS_POR_DEFECTO, puedeEditar, puedeVer, type Permisos, type Rol, type Seccion } from "@/lib/acceso";

interface Sesion {
  rol: Rol | null;
  permisos: Permisos | null;
  /** Secciones en desarrollo que el rol vería ya liberadas (menú con "En desarrollo"). */
  enDesarrollo: readonly Seccion[];
}

const SIN_SECCIONES: readonly Seccion[] = [];

const RolContext = createContext<Sesion>({ rol: null, permisos: null, enDesarrollo: SIN_SECCIONES });

/**
 * Expone el rol y los permisos efectivos de la sesión (leídos de permisos_rol
 * en el layout del servidor) a los componentes cliente. Si no se pasan
 * permisos se usan los del rol por defecto (útil en pruebas).
 */
export function RolProvider({
  rol,
  permisos,
  enDesarrollo = SIN_SECCIONES,
  children,
}: {
  rol: Rol | null;
  permisos?: Permisos | null;
  enDesarrollo?: readonly Seccion[];
  children: React.ReactNode;
}) {
  const efectivos = permisos === undefined ? (rol ? PERMISOS_POR_DEFECTO[rol] : null) : permisos;
  return <RolContext.Provider value={{ rol, permisos: efectivos, enDesarrollo }}>{children}</RolContext.Provider>;
}

/** Rol de la sesión actual; null fuera del proveedor o sin sesión. */
export function useRol(): Rol | null {
  return useContext(RolContext).rol;
}

/** Permisos efectivos de la sesión; null fuera del proveedor o sin sesión. */
export function usePermisos(): Permisos | null {
  return useContext(RolContext).permisos;
}

/** Secciones en desarrollo que la sesión vería ya liberadas (admin: todas las en desarrollo). */
export function useEnDesarrollo(): readonly Seccion[] {
  return useContext(RolContext).enDesarrollo;
}

/** ¿Puede abrir la página? Sirve para ocultar enlaces a secciones vedadas. */
export function usePuedeVer(pathname: string): boolean {
  return puedeVer(usePermisos(), pathname);
}

/** ¿Puede editar en la sección? Sirve para ocultar o bloquear controles de edición. */
export function usePuedeEditar(seccion: Seccion): boolean {
  return puedeEditar(usePermisos(), seccion);
}
