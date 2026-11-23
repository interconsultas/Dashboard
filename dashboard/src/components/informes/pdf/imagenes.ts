/**
 * Imágenes de las gráficas del PDF: la que está en pantalla se captura tal
 * cual la ve el usuario (registro de GraficoCliente); la que no, se dibuja
 * en un lienzo fuera de pantalla con el mismo tema y se libera. Navegador.
 */
import { echarts, NOMBRE_TEMA } from "@/lib/echarts";
import type { GraficaPdf } from "@/lib/informes/graficas";
import { OPCIONES_CAPTURA, capturarGrafica } from "@/lib/informes/registroGraficas";
import type { ImagenesGraficas } from "./Documentos";

function dibujarFueraDePantalla(g: GraficaPdf): string | null {
  const nodo = document.createElement("div");
  nodo.style.cssText = `position:fixed;left:-10000px;top:0;width:${g.ancho}px;height:${g.alto}px;`;
  nodo.setAttribute("aria-hidden", "true");
  document.body.appendChild(nodo);
  const instancia = echarts.init(nodo, NOMBRE_TEMA, { renderer: "canvas", width: g.ancho, height: g.alto });
  try {
    instancia.setOption(g.opcion as Parameters<typeof instancia.setOption>[0]);
    return instancia.getDataURL({ ...OPCIONES_CAPTURA });
  } catch {
    return null;
  } finally {
    instancia.dispose();
    nodo.remove();
  }
}

export async function imagenesGraficas(graficas: readonly GraficaPdf[]): Promise<ImagenesGraficas> {
  const imagenes: ImagenesGraficas = {};
  for (const g of graficas) {
    const url = (g.enPantalla ? capturarGrafica(g.enPantalla) : null) ?? dibujarFueraDePantalla(g);
    if (url) imagenes[g.id] = url;
  }
  return imagenes;
}
