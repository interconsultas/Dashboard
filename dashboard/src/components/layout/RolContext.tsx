"use client";

import { createContext, useContext } from "react";
import { puedeVer, type Rol } from "@/lib/acceso";

const RolContext = createContext<Rol | null>(null);

/** Expone el rol de la sesión (leído en el layout del servidor) a los componentes cliente. */
export function RolProvider({ rol, children }: { rol: Rol | null; children: React.ReactNode }) {
  return <RolContext.Provider value={rol}>{children}</RolContext.Provider>;
}

/** Rol de la sesión actual; null fuera del proveedor o sin sesión. */
export function useRol(): Rol | null {
  return useContext(RolContext);
}

/** ¿Puede el rol actual abrir la página? Sirve para ocultar enlaces a secciones vedadas. */
export function usePuedeVer(pathname: string): boolean {
  return puedeVer(useRol(), pathname);
}
