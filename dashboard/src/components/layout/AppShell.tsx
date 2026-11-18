"use client";

import { Suspense, useState } from "react";
import { Sidebar } from "./Sidebar";
import { AvisoSinAcceso } from "./AvisoSinAcceso";

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-fondo print:block print:min-h-0 print:bg-superficie">
      {/* Sidebar desktop — oculto en mobile y al imprimir */}
      <div className="hidden md:block print:hidden">
        <Sidebar onNavigate={() => {}} />
      </div>

      {/* Sidebar mobile — drawer overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-tinta/50 z-40 md:hidden print:hidden"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 w-64 md:hidden print:hidden animate-slide-in">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 print:block">
        {/* Mobile header */}
        <header className="md:hidden print:hidden flex items-center gap-3 px-4 py-3 bg-menu-fondo sticky top-0 z-30">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="p-2 -ml-2 rounded-control text-menu-tinta hover:bg-white/10 hover:text-white transition-colors"
          >
            <IconMenu className="w-5 h-5" />
          </button>
          <span className="font-titulo text-sm font-bold text-white">Interconsultas</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:px-7 md:py-6 overflow-auto print:p-0 print:overflow-visible">
          {/* useSearchParams exige un límite de Suspense en el App Router */}
          <Suspense fallback={null}>
            <AvisoSinAcceso />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
