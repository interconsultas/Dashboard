"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";

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
    admin:            "bg-brand-blue-soft-2 text-brand-navy",
    direccion_medica: "bg-green-50 text-green-800",
    coordinador:      "bg-amber-50 text-amber-800",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${cls[rol] ?? "bg-gray-100 text-gray-500"}`}>
      {ROL_LABEL[rol] ?? rol}
    </span>
  );
}

const EMPTY = { email: "", nombre: "", password: "", rol: "admin", regional: "MANIZALES" };

export default function UsuariosPage() {
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

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Gestión de usuarios</h1>
        <p className="text-sm text-gray-400 mt-0.5">Administra accesos al sistema</p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <p className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">
          {editId ? "Editar usuario" : "Nuevo usuario"}
        </p>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nombre completo</label>
            <input className={inputCls} value={form.nombre} required
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Correo electrónico</label>
            <input type="email" className={inputCls} value={form.email} required disabled={!!editId}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{editId ? "Nueva contraseña (opcional)" : "Contraseña"}</label>
            <input type="password" className={inputCls} value={form.password}
              required={!editId} placeholder={editId ? "Dejar en blanco para no cambiar" : ""}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>
          {editId && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rol</label>
                <select className={inputCls} value={form.rol}
                  onChange={e => setForm(p => ({ ...p, rol: e.target.value, regional: "" }))}>
                  <option value="admin">Administrador</option>
                  <option value="direccion_medica">Dirección médica</option>
                  <option value="coordinador">Coordinador</option>
                </select>
              </div>
              {form.rol === "coordinador" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Regional</label>
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
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-navy-dark disabled:opacity-60 transition-colors">
              {saving ? "Guardando…" : editId ? "Actualizar" : "Crear usuario"}
            </button>
            {editId && (
              <button type="button" onClick={() => { setEditId(null); setForm({ ...EMPTY }); setError(""); }}
                className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-500 hover:bg-gray-50">
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-navy">
            <tr>
              {["Nombre", "Correo", "Rol", "Regional", "Último ingreso", "Estado", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Cargando…</td></tr>
            )}
            {!isLoading && !usuarios?.length && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No hay usuarios</td></tr>
            )}
            {usuarios?.map((u, idx) => (
              <tr key={u.id}
                className={`${idx % 2 === 0 ? "bg-white" : "bg-surface-alt"} hover:bg-brand-blue-soft-2 transition-colors`}>
                <td className="px-4 py-3 font-medium text-gray-800">{u.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3"><BadgeRol rol={u.rol} /></td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.regional ?? "—"}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{u.last_login ?? "Nunca"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${u.activo ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => startEdit(u)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold text-brand-navy bg-brand-blue-soft hover:bg-brand-navy hover:text-white transition-colors">
                      Editar
                    </button>
                    <button onClick={() => toggleActivo(u)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
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
