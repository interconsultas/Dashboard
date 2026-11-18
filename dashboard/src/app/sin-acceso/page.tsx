"use client";

import { signOut } from "next-auth/react";
import { Boton } from "@/components/ui/Boton";

/**
 * Destino de quien no tiene ninguna sección asignada en permisos_rol. Queda
 * fuera de los layouts con menú y no exige ninguna sección, así que no hay
 * bucles de redirección.
 */
export default function SinAccesoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-fondo px-4">
      <div className="bg-superficie rounded-tarjeta shadow-tarjeta border border-borde p-8 w-full max-w-md text-center space-y-4">
        <h1 className="font-titulo text-xl font-bold text-tinta">Sin secciones asignadas</h1>
        <p className="text-sm text-tinta-2">
          Su rol no tiene acceso a ninguna sección del dashboard. Solicite al administrador que le
          asigne permisos en Usuarios › Permisos por rol.
        </p>
        <Boton onClick={() => signOut({ callbackUrl: "/login" })}>Cerrar sesión</Boton>
      </div>
    </div>
  );
}
