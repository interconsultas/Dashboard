import { ANIMACION, conAnimacion } from "@/lib/tema/animacion";

describe("conAnimacion", () => {
  it("aplica la animación de la app a una opción sin animación propia", () => {
    const o: any = conAnimacion({ series: [{ type: "line", data: [1, 2] }] }, false);
    expect(o).toMatchObject({
      animation: true,
      animationDuration: ANIMACION.duracion,
      animationEasing: "cubicOut",
      animationDurationUpdate: ANIMACION.duracionActualizacion,
      animationEasingUpdate: "cubicInOut",
    });
  });

  it("respeta lo que defina cada gráfica", () => {
    const o: any = conAnimacion({ animationDurationUpdate: 400, series: [] }, false);
    expect(o.animationDurationUpdate).toBe(400);
    expect(o.animationDuration).toBe(ANIMACION.duracion);
  });

  it("escalona la entrada de las barras sin tocar las demás series", () => {
    const o: any = conAnimacion(
      { series: [{ type: "bar", data: [1, 2, 3] }, { type: "line", data: [1] }, { type: "bar", animationDelay: 5 }] },
      false
    );
    expect(o.series[0].animationDelay(2)).toBe(2 * ANIMACION.escalonBarras);
    expect(o.series[1].animationDelay).toBeUndefined();
    expect(o.series[2].animationDelay).toBe(5);
  });

  it("con movimiento reducido apaga la animación aunque la gráfica la pida", () => {
    const o: any = conAnimacion({ animation: true, animationDuration: 900, series: [{ type: "bar" }] }, true);
    expect(o.animation).toBe(false);
    expect(o.series[0].animationDelay).toBeUndefined();
  });

  it("una gráfica puede apagar la animación explícitamente (p. ej. capturas para PDF)", () => {
    expect((conAnimacion({ animation: false, series: [] }, false) as any).animation).toBe(false);
  });
});
