/**
 * Registro de las gráficas montadas en pantalla, por su etiqueta accesible.
 * GraficoCliente registra cada instancia de ECharts al estar lista y la quita
 * al desmontarse; el PDF captura de aquí la imagen de lo que el usuario ve.
 */

export interface GraficaCapturable {
  getDataURL(opciones: { type: "png"; pixelRatio: number; backgroundColor: string }): string;
  isDisposed?(): boolean;
}

/** PNG a doble resolución con fondo blanco (el tema usa fondo transparente). */
export const OPCIONES_CAPTURA = { type: "png", pixelRatio: 2, backgroundColor: "#fff" } as const;

const registro = new Map<string, GraficaCapturable>();

/** Registra la gráfica; devuelve la función que la quita (solo si sigue siendo la misma). */
export function registrarGrafica(etiqueta: string, grafica: GraficaCapturable): () => void {
  registro.set(etiqueta, grafica);
  return () => {
    if (registro.get(etiqueta) === grafica) registro.delete(etiqueta);
  };
}

/** Imagen (data URL) de la gráfica en pantalla; null si no está montada o no se pudo capturar. */
export function capturarGrafica(etiqueta: string): string | null {
  const g = registro.get(etiqueta);
  if (!g || g.isDisposed?.()) return null;
  try {
    return g.getDataURL({ ...OPCIONES_CAPTURA });
  } catch {
    return null;
  }
}
