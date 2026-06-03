/**
 * fetcher para SWR — lanza si la respuesta no es 2xx, así SWR rellena
 * `error` en lugar de dejar a la UI esperando con un cuerpo de error
 * parseado como `data`.
 */
export class FetchError extends Error {
  status: number;
  info: unknown;

  constructor(message: string, status: number, info: unknown) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.info = info;
  }
}

export async function postFetcher<T = unknown>([url, body]: [string, string]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    let info: unknown = null;
    try { info = await res.json(); } catch { /* respuesta no-JSON */ }
    const message =
      (info && typeof info === "object" && "error" in info && typeof (info as { error: unknown }).error === "string")
        ? (info as { error: string }).error
        : `Error ${res.status} en ${url}`;
    throw new FetchError(message, res.status, info);
  }

  return res.json() as Promise<T>;
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);

  if (!res.ok) {
    let info: unknown = null;
    try { info = await res.json(); } catch { /* respuesta no-JSON */ }
    const message =
      (info && typeof info === "object" && "error" in info && typeof (info as { error: unknown }).error === "string")
        ? (info as { error: string }).error
        : `Error ${res.status} en ${url}`;
    throw new FetchError(message, res.status, info);
  }

  return res.json() as Promise<T>;
}
