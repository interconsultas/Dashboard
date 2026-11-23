/**
 * Animación común de las gráficas ECharts, alineada con las de Recharts del
 * resto de la app (entrada ~900 ms con salida suave).
 */
export const ANIMACION = {
  /** Entrada al dibujar la gráfica. */
  duracion: 900,
  /** Transición al cambiar los datos (filtros, periodo). */
  duracionActualizacion: 500,
  /** Retraso entre barras consecutivas al entrar. */
  escalonBarras: 25,
} as const;

type Serie = Record<string, unknown> & { type?: string };
type Opcion = Record<string, unknown> & { series?: Serie | Serie[] };

/** ¿El usuario pidió reducir el movimiento en su sistema? */
export function prefiereMenosMovimiento(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Completa la opción con la animación de la app sin pisar lo que la gráfica ya
 * define. Con movimiento reducido la apaga por completo.
 */
export function conAnimacion<T extends object>(opcion: T, reducirMovimiento: boolean): T {
  const o = opcion as Opcion;
  if (reducirMovimiento) return { ...o, animation: false } as T;

  const series = Array.isArray(o.series)
    ? o.series.map((s) =>
        s.type === "bar" && s.animationDelay === undefined
          ? { ...s, animationDelay: (idx: number) => idx * ANIMACION.escalonBarras }
          : s
      )
    : o.series;

  return {
    animation: true,
    animationDuration: ANIMACION.duracion,
    animationEasing: "cubicOut",
    animationDurationUpdate: ANIMACION.duracionActualizacion,
    animationEasingUpdate: "cubicInOut",
    ...o,
    ...(series !== undefined && { series }),
  } as T;
}
