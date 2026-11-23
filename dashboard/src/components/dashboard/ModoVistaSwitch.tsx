"use client";

import { Segmentado } from "@/components/ui/Segmentado";

export type ModoVista = "mes" | "dia";

interface Props {
  modo: ModoVista;
  onChange: (modo: ModoVista) => void;
  disabled?: boolean;
  disabledReason?: string;
}

/** Mes / Día: el modo día solo se habilita con un único mes seleccionado. */
export default function ModoVistaSwitch({ modo, onChange, disabled, disabledReason }: Props) {
  return (
    <Segmentado<ModoVista>
      etiqueta="Modo de vista"
      valor={modo}
      onCambiar={(m) => !(disabled && m === "dia") && onChange(m)}
      opciones={[
        { valor: "mes", etiqueta: "Mes" },
        { valor: "dia", etiqueta: "Día", deshabilitada: disabled, titulo: disabled ? disabledReason : undefined },
      ]}
    />
  );
}
