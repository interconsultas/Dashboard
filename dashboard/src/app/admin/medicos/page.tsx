"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import { ImportarMedicosExcel } from "@/components/medicos/ImportarMedicosExcel";
import { usePuedeEditar } from "@/components/layout/RolContext";
import { EncabezadoPagina } from "@/components/layout/EncabezadoPagina";
import { clasesBoton } from "@/components/ui/Boton";

interface Medico {
  usuario_txt: string;
  identificacion: number;
  nombre: string;
  estado: string | null;
  programa_especialidad: string | null;
  area: string | null;
}

const ESTADOS = ["ACTIVO", "INACTIVO"];

// Listas base; se combinan con los valores existentes en la BD
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
        activo ? "bg-bien-suave text-bien" : "bg-critico-suave text-critico"
      }`}
    >
      {estado ?? "—"}
    </span>
  );
}

export default function MedicosPage() {
  // Con nivel 'ver' la página queda en solo consulta (la API rechaza las escrituras)
  const editable = usePuedeEditar("profesionales");
  const { data: medicos, isLoading } = useSWR<Medico[]>(
    "/api/admin/medicos",
    fetcher
  );
  const [form, setForm] = useState({ ...EMPTY });
  const [editKey, setEditKey] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const programas = useMemo(() => {
    const set = new Set(PROGRAMAS);
    medicos?.forEach((m) => {
      if (m.programa_especialidad) set.add(m.programa_especialidad);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [medicos]);

  const areas = useMemo(() => {
    const set = new Set(AREAS);
    medicos?.forEach((m) => {
      if (m.area) set.add(m.area);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [medicos]);

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
      cerrarModal();
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
    setModalAbierto(true);
  }

  function abrirNuevo() {
    setEditKey(null);
    setForm({ ...EMPTY });
    setError("");
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditKey(null);
    setForm({ ...EMPTY });
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
    "w-full border border-borde rounded-control px-3 py-2 text-sm text-tinta-2 focus:outline-none";

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
      <EncabezadoPagina
        migas={[{ etiqueta: "Administración" }, { etiqueta: "Profesionales" }]}
        titulo="Profesionales (Médicos)"
        subtitulo={`Catálogo de profesionales — ${medicos?.length ?? 0} registros`}
        acciones={
          <>
            {editable ? (
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={abrirNuevo}
                className={clasesBoton({ variante: "secundario" })}
              >
                Nuevo profesional
              </button>
              <ImportarMedicosExcel onImportado={() => mutate("/api/admin/medicos")} />
            </div>
            ) : (
              <p className="text-xs text-tinta-3 bg-superficie-2 border border-borde rounded-control px-3 py-2">
                Solo consulta: no puede agregar, importar, editar ni eliminar profesionales.
              </p>
            )}
          </>
        }
      />

      {/* Formulario (crear y editar) */}
      {modalAbierto && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-profesional"
        className="fixed inset-0 z-50 flex items-center justify-center bg-menu-fondo/50 backdrop-blur-[2px] px-4"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !saving) cerrarModal();
        }}
      >
      <div className="bg-superficie border border-borde rounded-tarjeta shadow-tarjeta max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h3 id="titulo-modal-profesional" className="font-titulo text-lg font-bold text-tinta mb-4">
          {editKey ? "Editar profesional" : "Nuevo profesional"}
        </h3>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <div>
            <label className="block text-xs text-tinta-3 mb-1">
              Usuario TXT
            </label>
            <input
              className={inputCls}
              value={form.usuario_txt}
              required
              autoFocus={!editKey}
              disabled={!!editKey}
              onChange={(e) =>
                setForm((p) => ({ ...p, usuario_txt: e.target.value.toUpperCase() }))
              }
            />
          </div>
          <div>
            <label className="block text-xs text-tinta-3 mb-1">
              Identificación
            </label>
            <input
              className={inputCls}
              type="number"
              value={form.identificacion}
              required
              autoFocus={!!editKey}
              onChange={(e) =>
                setForm((p) => ({ ...p, identificacion: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-xs text-tinta-3 mb-1">
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
            <label className="block text-xs text-tinta-3 mb-1">Estado</label>
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
            <label className="block text-xs text-tinta-3 mb-1">
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
              {programas.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-tinta-3 mb-1">Área</label>
            <select
              className={inputCls}
              value={form.area}
              onChange={(e) =>
                setForm((p) => ({ ...p, area: e.target.value }))
              }
            >
              <option value="">— Seleccionar —</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <div className="sm:col-span-2">
              <p className="text-xs text-critico bg-critico-suave border border-critico/30 rounded-control px-3 py-2">
                {error}
              </p>
            </div>
          )}

          <div className="sm:col-span-2 mt-3 flex justify-end gap-3">
            <button
              type="button"
              onClick={cerrarModal}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-control text-tinta-2 bg-fondo hover:bg-borde disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-control text-sm font-semibold text-white bg-primario hover:bg-primario-oscuro disabled:opacity-60 transition-colors"
            >
              {saving
                ? "Guardando…"
                : editKey
                ? "Actualizar"
                : "Crear profesional"}
            </button>
          </div>
        </form>
      </div>
      </div>
      )}

      {/* Buscador */}
      <div>
        <input
          className="w-full sm:w-80 border border-borde rounded-control px-3 py-2 text-sm text-tinta-2 focus:outline-none"
          placeholder="Buscar por nombre, usuario, identificación…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-superficie rounded-tarjeta border border-borde shadow-tarjeta">
        <table className="tabla tabla-texto">
          <thead>
            <tr>
              {[
                "Usuario TXT",
                "Identificación",
                "Nombre",
                "Estado",
                "Programa / Especialidad",
                "Área",
                "Programa de metas",
                "",
              ].map((h) => (
                <th
                  key={h}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-center !py-10 text-tinta-3">
                  Cargando…
                </td>
              </tr>
            )}
            {!isLoading && !filtrados?.length && (
              <tr>
                <td colSpan={7} className="text-center !py-10 text-tinta-3">
                  {busqueda
                    ? "Sin resultados para esa búsqueda"
                    : "No hay profesionales"}
                </td>
              </tr>
            )}
            {filtrados?.map((m) => (
              <tr key={m.usuario_txt}>
                <td className="font-mono text-xs text-tinta-2">
                  {m.usuario_txt}
                </td>
                <td className="text-tinta-3">
                  {m.identificacion}
                </td>
                <td className="font-medium text-tinta">
                  {m.nombre}
                </td>
                <td>
                  <BadgeEstado estado={m.estado} />
                </td>
                <td className="text-tinta-3 text-xs">
                  {m.programa_especialidad ?? "—"}
                </td>
                <td className="text-tinta-3 text-xs">
                  {m.area ?? "—"}
                </td>
                <td className="text-right">
                  {editable && (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(m)}
                      className="text-xs px-3 py-1.5 rounded-control font-semibold text-primario bg-primario-suave hover:bg-primario hover:text-white transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(m)}
                      className="text-xs px-3 py-1.5 rounded-control font-semibold border border-borde text-tinta-3 hover:bg-critico-suave hover:text-critico transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
