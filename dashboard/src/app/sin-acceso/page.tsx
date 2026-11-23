"use client";

import { signOut } from "next-auth/react";

/**
 * Destino de quien no tiene ninguna sección asignada en permisos_rol. Queda
 * fuera de los layouts con menú y no exige ninguna sección, así que no hay
 * bucles de redirección.
 */
export default function SinAccesoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-app px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md text-center space-y-4">
        <h1 className="text-lg font-semibold text-brand-navy">Sin secciones asignadas</h1>
        <p className="text-sm text-gray-500">
          Su rol no tiene acceso a ninguna sección del dashboard. Solicite al administrador que le
          asigne permisos en Usuarios › Permisos por rol.
        </p>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-navy-dark transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
