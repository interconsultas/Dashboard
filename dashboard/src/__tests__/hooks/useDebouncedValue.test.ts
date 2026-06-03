/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("retorna valor inicial inmediatamente", () => {
    const { result } = renderHook(() => useDebouncedValue("initial", 300));
    expect(result.current).toBe("initial");
  });

  it("no actualiza antes de que pase el delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );

    rerender({ value: "b", delay: 300 });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current).toBe("a");
  });

  it("actualiza después del delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );

    rerender({ value: "b", delay: 300 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe("b");
  });

  it("reinicia el timer si el valor cambia dentro del delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );

    rerender({ value: "b", delay: 300 });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Cambia antes de que expire
    rerender({ value: "c", delay: 300 });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Solo pasaron 200ms desde "c", aún no debería actualizar
    expect(result.current).toBe("a");

    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Ahora sí pasaron 300ms desde "c"
    expect(result.current).toBe("c");
  });

  it("funciona con números", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 0, delay: 200 } }
    );

    rerender({ value: 42, delay: 200 });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current).toBe(42);
  });
});
