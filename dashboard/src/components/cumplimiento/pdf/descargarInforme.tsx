/**
 * Genera el informe de cumplimiento en PDF dentro del navegador y lo descarga.
 * Se importa de forma dinámica al pulsar "Exportar PDF": @react-pdf/renderer
 * no entra en el bundle inicial ni se ejecuta en el servidor.
 */
import { pdf } from "@react-pdf/renderer";
import { construirInforme, type EntradaInforme } from "@/lib/cumplimiento/informe";
import { DocumentoCumplimiento } from "./DocumentoCumplimiento";

const RUTA_LOGO = "/logo.png";

/** Tiempo para que el navegador empiece la descarga antes de liberar el blob. */
const LIBERAR_URL_MS = 1000;

export async function descargarInforme(entrada: EntradaInforme): Promise<void> {
  const informe = construirInforme(entrada);
  const logo = new URL(RUTA_LOGO, window.location.origin).href;
  const blob = await pdf(<DocumentoCumplimiento informe={informe} logo={logo} />).toBlob();

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = informe.nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), LIBERAR_URL_MS);
}
