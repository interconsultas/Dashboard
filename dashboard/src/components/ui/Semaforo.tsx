interface Props {
  tasa: number | null;
  size?: "sm" | "md" | "lg";
}

const VERDE_MIN = Number(process.env.NEXT_PUBLIC_SEMAFORO_VERDE_MIN ?? 80);
const AMARILLO_MIN = Number(process.env.NEXT_PUBLIC_SEMAFORO_AMARILLO_MIN ?? 60);

export function Semaforo({ tasa, size = "md" }: Props) {
  if (tasa === null) {
    return <span className="inline-block rounded-full bg-gray-200" style={{ width: size === "sm" ? 10 : size === "lg" ? 18 : 14, height: size === "sm" ? 10 : size === "lg" ? 18 : 14 }} />;
  }

  const color =
    tasa >= VERDE_MIN ? "#4EA234" :
    tasa >= AMARILLO_MIN ? "#F59E0B" :
    "#EF4444";

  const dim = size === "sm" ? 10 : size === "lg" ? 18 : 14;

  return (
    <span
      className="inline-block rounded-full shadow-sm"
      style={{ backgroundColor: color, width: dim, height: dim, flexShrink: 0 }}
      title={`${tasa.toFixed(1)}% cumplimiento`}
    />
  );
}

export function colorTasa(tasa: number | null): string {
  if (tasa === null) return "#6B7280";
  if (tasa >= VERDE_MIN) return "#4EA234";
  if (tasa >= AMARILLO_MIN) return "#F59E0B";
  return "#EF4444";
}
