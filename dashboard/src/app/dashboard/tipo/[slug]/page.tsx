"use client";

import { useParams, notFound } from "next/navigation";
import DashboardView from "@/components/dashboard/DashboardView";

interface TipoConfig {
  title: string;
  subtitle: string;
  viewName: string;
}

const TIPOS: Record<string, TipoConfig> = {
  laboratorios: {
    title: "Laboratorios",
    subtitle: "Detalle de autorizaciones — Laboratorios",
    viewName: "vm_dash_laboratorios",
  },
  rx: {
    title: "RX",
    subtitle: "Detalle de autorizaciones — RX",
    viewName: "vm_dash_rx",
  },
  "ecografias-capitadas": {
    title: "Ecografias capitadas",
    subtitle: "Detalle de autorizaciones — Ecografias capitadas",
    viewName: "vm_dash_ecografias",
  },
  "remisiones-capitadas": {
    title: "Remisiones capitadas",
    subtitle: "Detalle de autorizaciones — Remisiones capitadas",
    viewName: "vm_dash_remisiones_cap",
  },
  medicamentos: {
    title: "Medicamentos",
    subtitle: "Detalle de autorizaciones — Medicamentos",
    viewName: "vm_dash_medicamentos",
  },
  "remisiones-red-externa": {
    title: "Remisiones Red Externa",
    subtitle: "Detalle de autorizaciones — Remisiones Red Externa",
    viewName: "vm_dash_remisiones_ext",
  },
  "procedimientos-dx-no-capitados": {
    title: "Procedimientos DX no capitados",
    subtitle: "Detalle de autorizaciones — Procedimientos DX no capitados",
    viewName: "vm_dash_proc_dx",
  },
};

const PLACEHOLDER: Record<string, string> = {
  asesorias: "Asesorias",
};

export default function TipoPrestacionPage() {
  const { slug } = useParams<{ slug: string }>();

  const config = TIPOS[slug];
  if (config) {
    return (
      <DashboardView
        title={config.title}
        subtitle={config.subtitle}
        viewName={config.viewName}
      />
    );
  }

  const titulo = PLACEHOLDER[slug];
  if (!titulo) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-brand-navy">{titulo}</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Detalle de autorizaciones — {titulo}
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <p className="text-gray-400 text-sm">Vista en construccion</p>
      </div>
    </div>
  );
}
