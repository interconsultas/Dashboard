import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/** true mientras la pantalla está en modo de impresión (ver `useImpresion`). */
export const ContextoImpresion = createContext(false);

/**
 * Para las gráficas: en modo de impresión deben dibujarse sin animación,
 * porque Recharts oculta etiquetas y puntos hasta que la animación termina.
 */
export function useModoImpresion(): boolean {
  return useContext(ContextoImpresion);
}

/**
 * Ancho útil de una hoja A4 horizontal con márgenes de 12 mm (273 mm ≈ 1031 px CSS).
 * Debe coincidir con la regla `@page` de globals.css.
 */
export const ANCHO_IMPRESION_PX = 1030;

/** Margen para que las gráficas se vuelvan a medir con el ancho de impresión antes de abrir el diálogo. */
export const ESPERA_LAYOUT_MS = 300;

/** Si el navegador no emite `afterprint`, el layout normal se restaura tras este tiempo. */
export const RESPALDO_RESTAURAR_MS = 1000;

/**
 * Impresión con `window.print()` para pantallas con gráficas de ancho adaptable.
 *
 * `imprimir` activa `imprimiendo` (la pantalla debe fijar entonces el ancho de la
 * región imprimible), espera a que el layout se asiente, abre el diálogo de
 * impresión y vuelve al layout normal con `afterprint`.
 */
export function useImpresion(): { imprimiendo: boolean; imprimir: () => void } {
  const [imprimiendo, setImprimiendo] = useState(false);
  const enCurso = useRef(false);
  const cuadro = useRef<number | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alTerminar = useRef<(() => void) | null>(null);

  const cancelarPendientes = useCallback(() => {
    if (cuadro.current !== null) cancelAnimationFrame(cuadro.current);
    if (temporizador.current !== null) clearTimeout(temporizador.current);
    if (alTerminar.current !== null) window.removeEventListener("afterprint", alTerminar.current);
    cuadro.current = null;
    temporizador.current = null;
    alTerminar.current = null;
  }, []);

  const restaurar = useCallback(() => {
    cancelarPendientes();
    enCurso.current = false;
    setImprimiendo(false);
  }, [cancelarPendientes]);

  const abrirDialogo = useCallback(() => {
    temporizador.current = null;
    alTerminar.current = restaurar;
    window.addEventListener("afterprint", restaurar);
    try {
      window.print();
    } catch {
      restaurar();
      return;
    }
    // En la mayoría de navegadores print() bloquea hasta cerrar el diálogo:
    // el respaldo empieza a contar cuando ya terminó.
    temporizador.current = setTimeout(restaurar, RESPALDO_RESTAURAR_MS);
  }, [restaurar]);

  const imprimir = useCallback(() => {
    if (enCurso.current) return;
    enCurso.current = true;
    setImprimiendo(true);

    cuadro.current = requestAnimationFrame(() => {
      cuadro.current = requestAnimationFrame(() => {
        cuadro.current = null;
        temporizador.current = setTimeout(abrirDialogo, ESPERA_LAYOUT_MS);
      });
    });
  }, [abrirDialogo]);

  useEffect(
    () => () => {
      cancelarPendientes();
      enCurso.current = false;
    },
    [cancelarPendientes]
  );

  return { imprimiendo, imprimir };
}
