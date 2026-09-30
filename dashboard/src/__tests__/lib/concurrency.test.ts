import { runLimited } from "@/lib/concurrency";

describe("runLimited", () => {
  it("nunca corre más tareas en simultáneo que el límite dado", async () => {
    let activas = 0;
    let picoMaximo = 0;
    const resolvers: Array<() => void> = [];

    const tasks = Array.from({ length: 11 }, (_, i) => () => {
      activas++;
      picoMaximo = Math.max(picoMaximo, activas);
      return new Promise<number>((resolve) => {
        resolvers.push(() => {
          activas--;
          resolve(i);
        });
      });
    });

    const resultPromise = runLimited(tasks, 4);

    // Al arrancar, deberían haberse lanzado exactamente 4 (el límite), no las 11.
    expect(activas).toBe(4);
    expect(resolvers).toHaveLength(4);

    // Resolver de a una y verificar que nunca se supera el límite mientras se van
    // liberando lugares para las tareas restantes.
    while (resolvers.length > 0) {
      resolvers.shift()!();
      await Promise.resolve();
    }

    await resultPromise;

    expect(picoMaximo).toBeLessThanOrEqual(4);
  });

  it("devuelve los resultados en el mismo orden que las tareas de entrada, sin importar cuál termina primero", async () => {
    const tasks = [
      () => new Promise<string>((resolve) => setTimeout(() => resolve("a"), 30)),
      () => new Promise<string>((resolve) => setTimeout(() => resolve("b"), 10)),
      () => new Promise<string>((resolve) => setTimeout(() => resolve("c"), 20)),
    ];

    const results = await runLimited(tasks, 2);

    expect(results).toEqual(["a", "b", "c"]);
  });

  it("propaga el error si alguna tarea rechaza, igual que Promise.all", async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error("boom")),
      () => Promise.resolve(3),
    ];

    await expect(runLimited(tasks, 2)).rejects.toThrow("boom");
  });

  it("con límite mayor o igual a la cantidad de tareas, se comporta como Promise.all", async () => {
    const tasks = [() => Promise.resolve(1), () => Promise.resolve(2), () => Promise.resolve(3)];

    const results = await runLimited(tasks, 10);

    expect(results).toEqual([1, 2, 3]);
  });

  it("con lista vacía, devuelve un array vacío sin lanzar tareas", async () => {
    const results = await runLimited([], 4);
    expect(results).toEqual([]);
  });
});
