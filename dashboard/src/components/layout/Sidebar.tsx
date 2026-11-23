"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { puedeVer } from "@/lib/acceso";
import { Estado } from "@/components/ui/Estado";
import { InsigniaAlertas } from "./InsigniaAlertas";
import { useEnDesarrollo, usePermisos } from "./RolContext";

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

function IconMetas({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5" />
      <circle cx="10" cy="10" r="4" />
      <circle cx="10" cy="10" r="0.8" />
    </svg>
  );
}

function IconCitas({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="14" height="13" rx="2" />
      <path d="M3 8h14M7 2v4M13 2v4" />
      <path d="M7.5 12.5l1.8 1.8 3.2-3.6" />
    </svg>
  );
}

function IconCumplimiento({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17h14" />
      <path d="M5.5 17v-5M10 17V8M14.5 17v-7" />
      <path d="M3 5h14" strokeDasharray="2 2.5" />
    </svg>
  );
}

function IconProductividad({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2.5a7.5 7.5 0 107.5 7.5H10V2.5z" />
      <path d="M13 2.8A7.5 7.5 0 0117.2 7H13V2.8z" />
    </svg>
  );
}

function IconInteligencia({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="2.2" />
      <circle cx="4" cy="4.5" r="1.8" />
      <circle cx="16" cy="5" r="1.8" />
      <circle cx="5" cy="16" r="1.8" />
      <circle cx="15.5" cy="15.5" r="1.8" />
      <path d="M5.4 5.8l3 2.8M14.6 6.3l-3 2.6M6.4 14.7l2.1-2.9M14.2 14.2l-2.6-2.7" />
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

interface Entrada {
  href: string;
  etiqueta: string;
  Icono: (p: { className?: string }) => JSX.Element;
}

/** Grupo Administración, en el orden del menú. */
const ADMINISTRACION: readonly Entrada[] = [
  { href: "/admin/carga", etiqueta: "Carga de archivos", Icono: IconUpload },
  { href: "/admin/citas", etiqueta: "Citas", Icono: IconCitas },
  { href: "/admin/metas", etiqueta: "Metas", Icono: IconMetas },
  { href: "/admin/medicos", etiqueta: "Profesionales", Icono: IconMedicos },
  { href: "/admin/usuarios", etiqueta: "Usuarios", Icono: IconUsers },
];

/* ── Estilos del menú (dirección C) ── */

const BASE_ENTRADA = "flex items-center gap-2.5 px-3 py-2.5 rounded-control text-sm transition-colors";
/** Entrada activa: píldora lima con tinta oscura. */
const ACTIVA = "bg-menu-activo text-menu-activo-tinta font-bold";
/** Contenedor de la página activa (Dashboard cuando se ve un tipo de prestación). */
const CONTIENE_ACTIVA = "bg-white/10 text-white font-medium";
const INACTIVA = "text-menu-tinta font-medium hover:bg-white/10 hover:text-white";

function clasesEntrada(activa: boolean, contiene = false) {
  return `${BASE_ENTRADA} ${activa ? ACTIVA : contiene ? CONTIENE_ACTIVA : INACTIVA}`;
}

function TituloGrupo({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-4 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-menu-tinta/70">{children}</p>
  );
}

/** Etiqueta de módulo en desarrollo en el menú (texto, no solo color). */
function EtiquetaEnDesarrollo() {
  return (
    <Estado tono="atencion" icono={null} className="ml-auto text-[10px] px-1.5">
      En desarrollo
    </Estado>
  );
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  // Cumplimiento vive bajo /dashboard pero es una entrada propia del menú
  const isCumplimiento = pathname.startsWith("/dashboard/cumplimiento");
  // Productividad, igual que Cumplimiento, es una entrada propia bajo /dashboard
  const isProductividad = pathname.startsWith("/dashboard/productividad");
  const isInteligencia = pathname.startsWith("/dashboard/inteligencia");
  const isDashboard =
    pathname.startsWith("/dashboard") && !isCumplimiento && !isProductividad && !isInteligencia;
  const [subOpen, setSubOpen] = useState(isDashboard);
  // Solo se muestran las entradas que los permisos dejan abrir (los layouts hacen cumplir lo mismo)
  const permisos = usePermisos();
  const enDesarrollo = useEnDesarrollo();
  const ver = (href: string) => puedeVer(permisos, href);
  // Módulos en desarrollo: visibles (con etiqueta) para quien los verá al liberarse
  const productividadEnDesarrollo = enDesarrollo.includes("productividad");
  const inteligenciaEnDesarrollo = enDesarrollo.includes("inteligencia");
  const verProductividad = ver("/dashboard/productividad") || productividadEnDesarrollo;
  const verInteligencia = ver("/dashboard/inteligencia") || inteligenciaEnDesarrollo;
  const tiposVisibles = TIPOS_PRESTACION.filter((t) => ver(`/dashboard/tipo/${t.slug}`));
  const analisisVisibles =
    ["/dashboard", "/dashboard/cumplimiento"].some(ver) || verProductividad || verInteligencia;
  const adminVisibles = ADMINISTRACION.filter((e) => ver(e.href));

  function handleNav() {
    onNavigate?.();
  }

  /** Entrada simple del menú (sin subentradas). */
  function enlace(href: string, etiqueta: string, Icono: Entrada["Icono"], activa: boolean, extra?: React.ReactNode) {
    return (
      <Link
        key={href}
        href={href}
        onClick={handleNav}
        aria-current={activa ? "page" : undefined}
        className={clasesEntrada(activa)}
      >
        <Icono className="w-[18px] h-[18px] flex-shrink-0" />
        {etiqueta}
        {extra}
      </Link>
    );
  }

  return (
    <aside className="w-60 md:w-60 h-screen sticky top-0 flex flex-col flex-shrink-0 bg-menu-fondo">
      {/* Marca: el logo real en una tarjeta blanca */}
      <div className="px-3 pt-4 pb-2 flex items-center gap-2">
        <div className="bg-superficie rounded-control shadow-logo px-2.5 py-3 flex items-center justify-center flex-1">
          <Image
            src="/logo.png"
            alt="IPS Manizales — Interconsultas"
            width={172}
            height={46}
            priority
            style={{ objectFit: "contain" }}
          />
        </div>
        {/* Botón cerrar — solo mobile */}
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Cerrar menú"
            className="md:hidden p-1.5 rounded-control text-menu-tinta hover:bg-white/10 hover:text-white transition-colors"
          >
            <IconClose className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav aria-label="Menú principal" className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto sidebar-scroll">
        {analisisVisibles && <TituloGrupo>Análisis</TituloGrupo>}

        {/* Dashboard — con sub-items */}
        {ver("/dashboard") && (
          <div>
            <div className="flex items-center gap-0.5">
              <Link
                href="/dashboard"
                onClick={handleNav}
                aria-current={pathname === "/dashboard" ? "page" : undefined}
                className={`flex-1 ${clasesEntrada(pathname === "/dashboard", isDashboard)}`}
              >
                <IconDashboard className="w-[18px] h-[18px] flex-shrink-0" />
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => setSubOpen((o) => !o)}
                aria-expanded={subOpen}
                aria-label={subOpen ? "Ocultar tipos de prestación" : "Ver tipos de prestación"}
                className="px-2 py-2.5 rounded-control text-menu-tinta/70 hover:bg-white/10 hover:text-white transition-colors"
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
                {tiposVisibles.map((t) => {
                  const href = `/dashboard/tipo/${t.slug}`;
                  const active = pathname === href;
                  return (
                    <Link
                      key={t.slug}
                      href={href}
                      onClick={handleNav}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs transition-colors ${
                        active ? ACTIVA : "text-menu-tinta font-medium hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                          active ? "bg-menu-activo-tinta" : "bg-menu-tinta/40"
                        }`}
                      />
                      {t.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {ver("/dashboard/cumplimiento") &&
          enlace("/dashboard/cumplimiento", "Cumplimiento", IconCumplimiento, isCumplimiento)}
        {verProductividad &&
          enlace(
            "/dashboard/productividad",
            "Productividad",
            IconProductividad,
            isProductividad,
            productividadEnDesarrollo && <EtiquetaEnDesarrollo />,
          )}
        {verInteligencia &&
          enlace(
            "/dashboard/inteligencia",
            "Inteligencia",
            IconInteligencia,
            isInteligencia,
            <span className="ml-auto flex items-center gap-1">
              {inteligenciaEnDesarrollo && <EtiquetaEnDesarrollo />}
              {/* El conteo solo se consulta con acceso efectivo (no mientras esté en desarrollo para los demás) */}
              {ver("/dashboard/inteligencia") && <InsigniaAlertas />}
            </span>,
          )}

        {adminVisibles.length > 0 && <TituloGrupo>Administración</TituloGrupo>}
        {adminVisibles.map((e) => enlace(e.href, e.etiqueta, e.Icono, pathname.startsWith(e.href)))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/10">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-control text-sm font-medium transition-colors text-menu-tinta hover:bg-white/10 hover:text-white"
        >
          <IconLogout className="w-[18px] h-[18px] flex-shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
