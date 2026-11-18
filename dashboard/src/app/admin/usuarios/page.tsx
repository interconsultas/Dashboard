"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import { MatrizPermisos } from "@/components/usuarios/MatrizPermisos";
import { EncabezadoPagina } from "@/components/layout/EncabezadoPagina";

interface Usuario {
  id: number; email: string; nombre: string;
  rol: string; regional: string | null; activo: boolean; last_login: string | null;
}

const ROL_LABEL: Record<string, string> = {
  admin: "Administrador",
  direccion_medica: "Dirección médica",
  coordinador: "Coordinador",
};

const REGIONALES = [
  "MANIZALES", "VILLAMARÍA", "CHINCHINÁ",
  "PALESTINA", "NEIRA", "LA DORADA",
];

function BadgeRol({ rol }: { rol: string }) {
  const cls: Record<string, string> = {
    admin:            "bg-primario-suave text-primario",
    direccion_medica: "bg-bien-suave text-bien",
    coordinador:      "bg-atencion-suave text-atencion",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${cls[rol] ?? "bg-fondo text-tinta-3"}`}>
      {ROL_LABEL[rol] ?? rol}
    </span>
  );
}

const EMPTY = { email: "", nombre: "", password: "", rol: "admin", regional: "MANIZALES" };

type Pestana = "usuarios" | "permisos";

const PESTANAS: Array<{ clave: Pestana; etiqueta: string }> = [
  { clave: "usuarios", etiqueta: "Usuarios" },
  { clave: "permisos", etiqueta: "Permisos por rol" },
];

export default function UsuariosPage() {
  const [pestana, setPestana] = useState<Pestana>("usuarios");

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        migas={[{ etiqueta: "Administración" }, { etiqueta: "Usuarios" }]}
        titulo="Gestión de usuarios"
        subtitulo="Administra accesos al sistema"
      />

      <div
        role="tablist"
        aria-label="Usuarios y permisos"
        className="bg-superficie border border-borde rounded-tarjeta shadow-tarjeta px-3 sm:px-4 py-3 flex flex-wrap gap-1"
      >
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={pestana === p.clave}
            onClick={() => setPestana(p.clave)}
            className={`px-3 sm:px-3.5 py-2 rounded-control text-sm font-semibold transition-colors ${
              pestana === p.clave
                ? "bg-primario text-white"
                : "text-tinta-2 hover:bg-primario-suave hover:text-primario"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestana === "usuarios" ? <GestionUsuarios /> : <MatrizPermisos />}
    </div>
  );
}

function GestionUsuarios() {
  const { data: usuarios, isLoading } = useSWR<Usuario[]>("/api/admin/usuarios", fetcher);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      const url = editId ? `/api/admin/usuarios/${editId}` : "/api/admin/usuarios";
      const method = editId ? "PATCH" : "POST";
      const body = { ...form, regional: form.regional || null };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Error"); return; }
      mutate("/api/admin/usuarios");
      setForm({ ...EMPTY }); setEditId(null);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(u: Usuario) {
    setEditId(u.id);
    setForm({ email: u.email, nombre: u.nombre, password: "", rol: u.rol, regional: u.regional ?? "" });
    setError("");
  }

  async function toggleActivo(u: Usuario) {
    await fetch(`/api/admin/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...u, activo: !u.activo }),
    });
    mutate("/api/admin/usuarios");
  }

  const inputCls = "w-full border border-borde rounded-control px-3 py-2 text-sm text-tinta-2 focus:outline-none";

  return (
    <div className="space-y-6">
      {/* Formulario */}
      <div className="bg-superficie rounded-tarjeta border border-borde shadow-tarjeta p-6">
        <p className="text-sm font-semibold text-tinta-3 mb-4 uppercase tracking-wide">
          {editId ? "Editar usuario" : "Nuevo usuario"}
        </p>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-tinta-3 mb-1">Nombre completo</label>
            <input className={inputCls} value={form.nombre} required
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-tinta-3 mb-1">Correo electrónico</label>
            <input type="email" className={inputCls} value={form.email} required disabled={!!editId}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-tinta-3 mb-1">{editId ? "Nueva contraseña (opcional)" : "Contraseña"}</label>
            <input type="password" className={inputCls} value={form.password}
              required={!editId} placeholder={editId ? "Dejar en blanco para no cambiar" : ""}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>
          {editId && (
            <>
              <div>
                <label className="block text-xs text-tinta-3 mb-1">Rol</label>
                <select className={inputCls} value={form.rol}
                  onChange={e => setForm(p => ({ ...p, rol: e.target.value, regional: "" }))}>
                  <option value="admin">Administrador</option>
                  <option value="direccion_medica">Dirección médica</option>
                  <option value="coordinador">Coordinador</option>
                </select>
              </div>
              {form.rol === "coordinador" && (
                <div>
                  <label className="block text-xs text-tinta-3 mb-1">Regional</label>
                  <select className={inputCls} value={form.regional}
                    onChange={e => setForm(p => ({ ...p, regional: e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    {REGIONALES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-critico bg-critico-suave border border-critico/30 rounded-control px-3 py-2">{error}</p>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2 rounded-control text-sm font-semibold text-white bg-primario hover:bg-primario-oscuro disabled:opacity-60 transition-colors">
              {saving ? "Guardando…" : editId ? "Actualizar" : "Crear usuario"}
            </button>
            {editId && (
              <button type="button" onClick={() => { setEditId(null); setForm({ ...EMPTY }); setError(""); }}
                className="px-4 py-2 rounded-control text-sm border border-borde text-tinta-3 hover:bg-primario-suave">
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="overflow-x-auto bg-superficie rounded-tarjeta border border-borde shadow-tarjeta">
        <table className="tabla tabla-texto">
          <thead>
            <tr>
              {["Nombre", "Correo", "Rol", "Regional", "Último ingreso", "Estado", ""].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center !py-10 text-tinta-3">Cargando…</td></tr>
            )}
            {!isLoading && !usuarios?.length && (
              <tr><td colSpan={7} className="text-center !py-10 text-tinta-3">No hay usuarios</td></tr>
            )}
            {usuarios?.map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-tinta">{u.nombre}</td>
                <td className="text-tinta-3">{u.email}</td>
                <td><BadgeRol rol={u.rol} /></td>
                <td className="text-tinta-3 text-xs">{u.regional ?? "—"}</td>
                <td className="text-tinta-3 text-xs">{u.last_login ?? "Nunca"}</td>
                <td>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${u.activo ? "bg-bien-suave text-bien" : "bg-critico-suave text-critico"}`}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => startEdit(u)}
                      className="text-xs px-3 py-1.5 rounded-control font-semibold text-primario bg-primario-suave hover:bg-primario hover:text-white transition-colors">
                      Editar
                    </button>
                    <button onClick={() => toggleActivo(u)}
                      className="text-xs px-3 py-1.5 rounded-control font-semibold border border-borde text-tinta-3 hover:bg-primario-suave transition-colors">
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
