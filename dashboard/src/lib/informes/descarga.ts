/**
 * Descarga de informes desde el navegador: arma la URL de la ruta con los
 * filtros activos y guarda la respuesta con el nombre que da el servidor.
 */
import { aQueryString, type FiltrosProductividad } from "@/lib/productividad/filtros";
import type { TipoInforme } from "./modelo";

export type FormatoInforme = "excel";

/**
 * URL del informe. El mensual no lleva filtros de área, servicio ni
 * profesional, y solo lleva el periodo si es un mes (en semanal: el último mes).
 */
export function urlInforme(
  formato: FormatoInforme,
  tipo: TipoInforme,
  filtros: FiltrosProductividad,
  documento?: string
): string {
  const params = new URLSearchParams({ tipo });
  if (tipo === "mensual") {
    if (filtros.granularidad === "mensual" && filtros.periodo) params.set("periodo", filtros.periodo);
  } else {
    new URLSearchParams(aQueryString(filtros)).forEach((v, k) => params.set(k, v));
    if (tipo === "ficha" && documento) params.set("documento", documento);
  }
  return `/api/informes/${formato}?${params.toString()}`;
}

/** Nombre del archivo en Content-Disposition (filename="…"), o el de reserva. */
export function nombreDeDisposicion(disposicion: string | null, reserva: string): string {
  const m = disposicion?.match(/filename="([^"]+)"/);
  return m ? m[1] : reserva;
}

type Fetch = (url: string) => Promise<Pick<Response, "ok" | "status" | "headers" | "json" | "blob">>;

/** Descarga la URL como archivo; devuelve el nombre guardado o lanza el error del servidor. */
export async function descargarArchivo(url: string, ejecutar: Fetch = fetch): Promise<string> {
  const res = await ejecutar(url);
  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof cuerpo?.error === "string" ? cuerpo.error : "No se pudo generar el informe");
  }
  const nombre = nombreDeDisposicion(res.headers.get("Content-Disposition"), "informe.xlsx");
  const enlace = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = enlace;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(enlace);
  return nombre;
}
