import { COLORES } from "@/lib/tema/tokens";

interface Props {
  tasa: number | null;
  size?: "sm" | "md" | "lg";
}

const VERDE_MIN = Number(process.env.NEXT_PUBLIC_SEMAFORO_VERDE_MIN ?? 80);
const AMARILLO_MIN = Number(process.env.NEXT_PUBLIC_SEMAFORO_AMARILLO_MIN ?? 60);

/** Nivel de la tasa: bien (≥ verde), atención (≥ amarillo) o crítico. */
function nivel(tasa: number): "bien" | "atencion" | "critico" {
  if (tasa >= VERDE_MIN) return "bien";
  if (tasa >= AMARILLO_MIN) return "atencion";
  return "critico";
}

const ETIQUETA_NIVEL = { bien: "bien", atencion: "atención", critico: "crítico" } as const;

/**
 * Punto de semáforo con los colores de estado (bien / atención / crítico).
 * No depende solo del color: se anuncia como imagen con la tasa y el nivel.
 */
export function Semaforo({ tasa, size = "md" }: Props) {
  const dim = size === "sm" ? 10 : size === "lg" ? 18 : 14;

  if (tasa === null) {
    return (
      <span
        role="img"
        aria-label="Sin dato de cumplimiento"
        className="inline-block rounded-full bg-borde"
        style={{ width: dim, height: dim }}
      />
    );
  }

  const n = nivel(tasa);
  return (
    <span
      role="img"
      aria-label={`${tasa.toFixed(1)}% cumplimiento (${ETIQUETA_NIVEL[n]})`}
      className="inline-block rounded-full shadow-sm"
      style={{ backgroundColor: COLORES[n], width: dim, height: dim, flexShrink: 0 }}
      title={`${tasa.toFixed(1)}% cumplimiento`}
    />
  );
}

export function colorTasa(tasa: number | null): string {
  if (tasa === null) return COLORES["tinta-3"];
  return COLORES[nivel(tasa)];
}
