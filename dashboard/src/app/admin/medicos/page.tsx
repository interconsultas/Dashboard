"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";

interface Medico {
  usuario_txt: string;
  identificacion: number;
  nombre: string;
  estado: string | null;
  programa_especialidad: string | null;
  area: string | null;
}

const ESTADOS = ["ACTIVO", "INACTIVO"];

const PROGRAMAS = [
  "MÉDICO GENERAL INTEGRADOR",
  "ODONTÓLOGO",
  "AUXILIAR ENFERMERIA",
  "RCV",
  "SEGUIMIENTO CLÍNICO",
  "GESTIÓN",
  "PROGRAMAS PYM",
  "DIRECCIÓN MÉDICA",
  "GINECOLOGÍA Y OBSTETRICIA",
  "AUXILIAR SALUD ORAL",
  "SSR",
];

const AREAS = [
  "MEDICINA",
  "SALUD ORAL",
  "ENFERMERIA",
  "INTERCONSULTAS",
];

const EMPTY = {
  usuario_txt: "",
  identificacion: "",
  nombre: "",
  estado: "ACTIVO",
  programa_especialidad: "",
  area: "",
};

function BadgeEstado({ estado }: { estado: string | null }) {
  const activo = estado === "ACTIVO";
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
        activo ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
      }`}
    >
      {estado ?? "—"}
    </span>
  );
}

export default function MedicosPage() {
  const { data: medicos, isLoading } = useSWR<Medico[]>(
    "/api/admin/medicos",
    fetcher
  );
  const [form, setForm] = useState({ ...EMPTY });
  const [editKey, setEditKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const url = editKey
        ? `/api/admin/medicos/${encodeURIComponent(editKey)}`
        : "/api/admin/medicos";
      const method = editKey ? "PATCH" : "POST";
      const body = {
        ...form,
        identificacion: Number(form.identificacion) || null,
        programa_especialidad: form.programa_especialidad || null,
        area: form.area || null,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Error");
        return;
      }
      mutate("/api/admin/medicos");
      setForm({ ...EMPTY });
      setEditKey(null);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(m: Medico) {
    setEditKey(m.usuario_txt);
    setForm({
      usuario_txt: m.usuario_txt,
      identificacion: String(m.identificacion),
      nombre: m.nombre,
      estado: m.estado ?? "ACTIVO",
      programa_especialidad: m.programa_especialidad ?? "",
      area: m.area ?? "",
    });
    setError("");
  }

  async function handleDelete(m: Medico) {
    if (!confirm(`¿Eliminar a ${m.nombre}?`)) return;
    await fetch(`/api/admin/medicos/${encodeURIComponent(m.usuario_txt)}`, {
      method: "DELETE",
    });
    mutate("/api/admin/medicos");
  }

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none";

  const filtrados = medicos?.filter((m) => {
    if (!busqueda) return true;
    const q = busqueda.toUpperCase();
    return (
      m.nombre?.toUpperCase().includes(q) ||
      m.usuario_txt?.toUpperCase().includes(q) ||
      String(m.identificacion).includes(q) ||
      m.programa_especialidad?.toUpperCase().includes(q) ||
      m.area?.toUpperCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">
          Profesionales (Médicos)
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Catálogo de profesionales — {medicos?.length ?? 0} registros
        </p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <p className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">
          {editKey ? "Editar profesional" : "Nuevo profesional"}
        </p>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Usuario TXT
            </label>
            <input
              className={inputCls}
              value={form.usuario_txt}
              required
              disabled={!!editKey}
              onChange={(e) =>
                setForm((p) => ({ ...p, usuario_txt: e.target.value.toUpperCase() }))
              }
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Identificación
            </label>
            <input
              className={inputCls}
              type="number"
              value={form.identificacion}
              required
              onChange={(e) =>
                setForm((p) => ({ ...p, identificacion: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Nombre completo
            </label>
            <input
              className={inputCls}
              value={form.nombre}
              required
              onChange={(e) =>
                setForm((p) => ({ ...p, nombre: e.target.value.toUpperCase() }))
              }
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <select
              className={inputCls}
              value={form.estado}
              onChange={(e) =>
                setForm((p) => ({ ...p, estado: e.target.value }))
              }
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Programa / Especialidad
            </label>
            <select
              className={inputCls}
              value={form.programa_especialidad}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  programa_especialidad: e.target.value,
                }))
              }
            >
              <option value="">— Seleccionar —</option>
              {PROGRAMAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Área</label>
            <select
              className={inputCls}
              value={form.area}
              onChange={(e) =>
                setForm((p) => ({ ...p, area: e.target.value }))
              }
            >
              <option value="">— Seleccionar —</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-navy-dark disabled:opacity-60 transition-colors"
            >
              {saving
                ? "Guardando…"
                : editKey
                ? "Actualizar"
                : "Crear profesional"}
            </button>
            {editKey && (
              <button
                type="button"
                onClick={() => {
                  setEditKey(null);
                  setForm({ ...EMPTY });
                  setError("");
                }}
                className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Buscador */}
      <div>
        <input
          className="w-full sm:w-80 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none"
          placeholder="Buscar por nombre, usuario, identificación…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-navy">
            <tr>
              {[
                "Usuario TXT",
                "Identificación",
                "Nombre",
                "Estado",
                "Programa / Especialidad",
                "Área",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!isLoading && !filtrados?.length && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400">
                  {busqueda
                    ? "Sin resultados para esa búsqueda"
                    : "No hay profesionales"}
                </td>
              </tr>
            )}
            {filtrados?.map((m, idx) => (
              <tr
                key={m.usuario_txt}
                className={`${
                  idx % 2 === 0 ? "bg-white" : "bg-surface-alt"
                } hover:bg-brand-blue-soft-2 transition-colors`}
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                  {m.usuario_txt}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {m.identificacion}
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {m.nombre}
                </td>
                <td className="px-4 py-3">
                  <BadgeEstado estado={m.estado} />
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {m.programa_especialidad ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {m.area ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(m)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold text-brand-navy bg-brand-blue-soft hover:bg-brand-navy hover:text-white transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(m)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      Eliminar
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
