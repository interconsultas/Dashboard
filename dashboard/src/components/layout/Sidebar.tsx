"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <rect x="2" y="2" width="7" height="8" rx="1.5" />
      <rect x="11" y="2" width="7" height="5" rx="1.5" />
      <rect x="2" y="12" width="7" height="6" rx="1.5" />
      <rect x="11" y="9" width="7" height="9" rx="1.5" />
    </svg>
  );
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 14V4m0 0L6 8m4-4l4 4" />
      <path d="M3 14v2a2 2 0 002 2h10a2 2 0 002-2v-2" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="6" r="3" />
      <path d="M2 17c0-3 2.7-5 6-5s6 2 6 5" />
      <circle cx="15" cy="7" r="2" />
      <path d="M15 12c2 0 4 1.2 4 3.5" />
    </svg>
  );
}

function IconMedicos({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v6M7 5h6" />
      <rect x="4" y="10" width="12" height="8" rx="2" />
      <circle cx="10" cy="14" r="2" />
    </svg>
  );
}

function IconLogout({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17H4a1 1 0 01-1-1V4a1 1 0 011-1h3" />
      <path d="M14 14l3-4-3-4" />
      <path d="M17 10H8" />
    </svg>
  );
}

function IconChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M4.47 5.97a.75.75 0 011.06 0L8 8.44l2.47-2.47a.75.75 0 111.06 1.06l-3 3a.75.75 0 01-1.06 0l-3-3a.75.75 0 010-1.06z" />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

const TIPOS_PRESTACION = [
  { label: "Laboratorios", slug: "laboratorios" },
  { label: "RX", slug: "rx" },
  { label: "Ecografias capitadas", slug: "ecografias-capitadas" },
  { label: "Remisiones capitadas", slug: "remisiones-capitadas" },
  { label: "Medicamentos", slug: "medicamentos" },
  { label: "Remisiones Red Externa", slug: "remisiones-red-externa" },
  { label: "Procedimientos DX no capitados", slug: "procedimientos-dx-no-capitados" },
  { label: "Asesorias", slug: "asesorias" },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const [subOpen, setSubOpen] = useState(isDashboard);

  function handleNav() {
    onNavigate?.();
  }

  return (
    <aside className="w-60 md:w-60 h-screen sticky top-0 flex flex-col shadow-xl flex-shrink-0 bg-brand-navy">
      {/* Marca */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="bg-white rounded-xl px-3 py-2.5 flex items-center justify-center flex-1">
          <Image
            src="/logo.png"
            alt="IPS Manizales — Interconsultas"
            width={170}
            height={46}
            priority
            style={{ objectFit: "contain" }}
          />
        </div>
        {/* Boton cerrar — solo mobile */}
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="md:hidden ml-2 p-1.5 rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <IconClose className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto sidebar-scroll">

        {/* Dashboard — con sub-items */}
        <div>
          <div className="flex items-center">
            <Link
              href="/dashboard"
              onClick={handleNav}
              className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-l-lg text-sm font-medium transition-all ${
                pathname === "/dashboard"
                  ? "bg-brand-green text-white shadow-lg shadow-green-900/20"
                  : isDashboard
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <IconDashboard className="w-[18px] h-[18px] flex-shrink-0" />
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => setSubOpen((o) => !o)}
              className="px-2.5 py-2.5 rounded-r-lg text-white/40 hover:bg-white/10 hover:text-white/70 transition-all"
            >
              <IconChevron open={subOpen} className="w-4 h-4" />
            </button>
          </div>

          <div
            className={`overflow-hidden transition-all duration-200 ${
              subOpen ? "max-h-[500px] opacity-100 mt-1" : "max-h-0 opacity-0"
            }`}
          >
            <div className="ml-5 space-y-0.5 border-l border-white/10 pl-2">
              {TIPOS_PRESTACION.map((t) => {
                const href = `/dashboard/tipo/${t.slug}`;
                const active = pathname === href;
                return (
                  <Link
                    key={t.slug}
                    href={href}
                    onClick={handleNav}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? "bg-brand-green/90 text-white shadow-sm"
                        : "text-white/50 hover:bg-white/8 hover:text-white/90"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                        active ? "bg-white" : "bg-white/25"
                      }`}
                    />
                    {t.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Carga de archivos */}
        <Link
          href="/admin/carga"
          onClick={handleNav}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            pathname.startsWith("/admin/carga")
              ? "bg-brand-green text-white shadow-lg shadow-green-900/20"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <IconUpload className="w-[18px] h-[18px] flex-shrink-0" />
          Carga de archivos
        </Link>

        {/* Usuarios */}
        <Link
          href="/admin/usuarios"
          onClick={handleNav}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            pathname.startsWith("/admin/usuarios")
              ? "bg-brand-green text-white shadow-lg shadow-green-900/20"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <IconUsers className="w-[18px] h-[18px] flex-shrink-0" />
          Usuarios
        </Link>

        {/* Profesionales */}
        <Link
          href="/admin/medicos"
          onClick={handleNav}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            pathname.startsWith("/admin/medicos")
              ? "bg-brand-green text-white shadow-lg shadow-green-900/20"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <IconMedicos className="w-[18px] h-[18px] flex-shrink-0" />
          Profesionales
        </Link>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-white/50 hover:bg-white/10 hover:text-white/80"
        >
          <IconLogout className="w-[18px] h-[18px] flex-shrink-0" />
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
