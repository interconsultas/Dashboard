"use client";

import { ReactNode, useId } from "react";
import { Boton } from "./Boton";

interface Props {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const tituloId = useId();
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-menu-fondo/50 backdrop-blur-[2px] px-4"
    >
      <div className="bg-superficie border border-borde rounded-tarjeta shadow-tarjeta max-w-sm w-full p-6">
        <h3 id={tituloId} className="font-titulo text-lg font-bold text-tinta">{title}</h3>
        <div className="mt-2 text-sm text-tinta-2">{message}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Boton variante="secundario" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Boton>
          <Boton variante={variant === "destructive" ? "peligro" : "primario"} onClick={onConfirm} disabled={loading}>
            {loading ? "Procesando..." : confirmLabel}
          </Boton>
        </div>
      </div>
    </div>
  );
}
