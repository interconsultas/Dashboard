/**
 * Genera un informe en PDF dentro del navegador y lo descarga: pide el
 * modelo a /api/informes/datos (mismos filtros y permisos que el Excel),
 * convierte las gráficas en imagen y arma el documento con @react-pdf.
 * Se importa de forma dinámica (useDescarga): no pesa en el bundle del tablero.
 */
import { pdf } from "@react-pdf/renderer";
import { contenidoPdf } from "@/lib/informes/documentosPdf";
import { guardarBlob, pedir, type Fetch } from "@/lib/informes/descarga";
import { graficasPdf, type DatosGraficas } from "@/lib/informes/graficas";
import type { ModeloInforme } from "@/lib/informes/modelo";
import { DocumentoInforme } from "./Documentos";
import { RUTA_FUENTES, registrarFuentesPdf } from "./fuentes";
import { imagenesGraficas } from "./imagenes";

const RUTA_LOGO = "/logo.png";

/** Descarga el PDF de la URL de datos; devuelve el nombre del archivo o lanza el error del servidor. */
export async function descargarInformePdf(url: string, ejecutar: Fetch = fetch): Promise<string> {
  const res = await pedir(url, ejecutar);
  const { modelo, graficas } = (await res.json()) as { modelo: ModeloInforme; graficas: DatosGraficas };

  const imagenes = await imagenesGraficas(graficasPdf(graficas));
  const origen = window.location.origin;
  registrarFuentesPdf(new URL(RUTA_FUENTES, origen).href);
  const contenido = contenidoPdf(modelo);

  const blob = await pdf(
    <DocumentoInforme contenido={contenido} imagenes={imagenes} logo={new URL(RUTA_LOGO, origen).href} />
  ).toBlob();
  guardarBlob(blob, contenido.encabezado.archivo);
  return contenido.encabezado.archivo;
}
