/**
 * Corre `tasks` con un máximo de `limit` en simultáneo, preservando el orden
 * de los resultados según el orden de entrada (no según cuál termina primero).
 * Si alguna tarea rechaza, el rechazo se propaga (igual que Promise.all).
 */
export async function runLimited<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
