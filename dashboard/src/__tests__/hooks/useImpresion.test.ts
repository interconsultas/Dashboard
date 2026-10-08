/**
 * @jest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import {
  ESPERA_LAYOUT_MS,
  RESPALDO_RESTAURAR_MS,
  useImpresion,
} from "@/hooks/useImpresion";

/** Avanza los dos cuadros de animación previos a la espera del layout. */
function avanzarCuadros() {
  act(() => {
    jest.advanceTimersToNextFrame();
  });
  act(() => {
    jest.advanceTimersToNextFrame();
  });
}

function avanzar(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe("useImpresion", () => {
  let print: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    print = jest.fn();
    window.print = print;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("parte sin modo de impresión", () => {
    const { result } = renderHook(() => useImpresion());

    expect(result.current.imprimiendo).toBe(false);
    expect(print).not.toHaveBeenCalled();
  });

  it("activa el modo de impresión de inmediato, antes de abrir el diálogo", () => {
    const { result } = renderHook(() => useImpresion());

    act(() => result.current.imprimir());

    expect(result.current.imprimiendo).toBe(true);
    expect(print).not.toHaveBeenCalled();
  });

  it("espera dos cuadros y el tiempo de asentamiento del layout antes de imprimir", () => {
    const { result } = renderHook(() => useImpresion());

    act(() => result.current.imprimir());
    avanzarCuadros();
    expect(print).not.toHaveBeenCalled();

    avanzar(ESPERA_LAYOUT_MS - 1);
    expect(print).not.toHaveBeenCalled();

    avanzar(1);
    expect(print).toHaveBeenCalledTimes(1);
    expect(result.current.imprimiendo).toBe(true);
  });

  it("restaura el layout normal al recibir 'afterprint'", () => {
    const { result } = renderHook(() => useImpresion());

    act(() => result.current.imprimir());
    avanzarCuadros();
    avanzar(ESPERA_LAYOUT_MS);

    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });

    expect(result.current.imprimiendo).toBe(false);
  });

  it("ignora un 'afterprint' ajeno que llega antes de abrir el diálogo", () => {
    const { result } = renderHook(() => useImpresion());

    act(() => result.current.imprimir());
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });

    expect(result.current.imprimiendo).toBe(true);
  });

  it("si 'afterprint' no llega, restaura el layout tras el tiempo de respaldo", () => {
    const { result } = renderHook(() => useImpresion());

    act(() => result.current.imprimir());
    avanzarCuadros();
    avanzar(ESPERA_LAYOUT_MS);

    avanzar(RESPALDO_RESTAURAR_MS - 1);
    expect(result.current.imprimiendo).toBe(true);

    avanzar(1);
    expect(result.current.imprimiendo).toBe(false);
  });

  it("restaura el layout si el navegador rechaza la impresión", () => {
    print.mockImplementation(() => {
      throw new Error("print bloqueado");
    });
    const { result } = renderHook(() => useImpresion());

    act(() => result.current.imprimir());
    avanzarCuadros();
    avanzar(ESPERA_LAYOUT_MS);

    expect(print).toHaveBeenCalledTimes(1);
    expect(result.current.imprimiendo).toBe(false);
  });

  it("no abre un segundo diálogo si se solicita imprimir mientras se prepara", () => {
    const { result } = renderHook(() => useImpresion());

    act(() => result.current.imprimir());
    act(() => result.current.imprimir());
    avanzarCuadros();
    avanzar(ESPERA_LAYOUT_MS);
    avanzar(ESPERA_LAYOUT_MS);

    expect(print).toHaveBeenCalledTimes(1);
  });

  it("permite volver a imprimir después de restaurar", () => {
    const { result } = renderHook(() => useImpresion());

    act(() => result.current.imprimir());
    avanzarCuadros();
    avanzar(ESPERA_LAYOUT_MS);
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });

    act(() => result.current.imprimir());
    avanzarCuadros();
    avanzar(ESPERA_LAYOUT_MS);

    expect(print).toHaveBeenCalledTimes(2);
    expect(result.current.imprimiendo).toBe(true);
  });

  it("al desmontar mientras se prepara cancela la impresión pendiente", () => {
    const { result, unmount } = renderHook(() => useImpresion());

    act(() => result.current.imprimir());
    unmount();
    avanzarCuadros();
    avanzar(ESPERA_LAYOUT_MS + RESPALDO_RESTAURAR_MS);

    expect(print).not.toHaveBeenCalled();
  });

  it("al desmontar con el diálogo abierto deja de escuchar 'afterprint'", () => {
    const quitar = jest.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() => useImpresion());

    act(() => result.current.imprimir());
    avanzarCuadros();
    avanzar(ESPERA_LAYOUT_MS);
    unmount();

    expect(quitar).toHaveBeenCalledWith("afterprint", expect.any(Function));
    expect(jest.getTimerCount()).toBe(0);
    quitar.mockRestore();
  });
});
