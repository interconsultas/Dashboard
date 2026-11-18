/**
 * Tipografía de los PDF (@react-pdf/renderer): Sora para títulos y DM Sans
 * para el texto, como en la app. @react-pdf no lee las woff2 variables de
 * src/app/fonts, así que usa los TTF estáticos (OFL) de public/fonts/pdf:
 * los sirve la propia app, nada se descarga de Google.
 */
import { Font } from "@react-pdf/renderer";

export const FAMILIA_TEXTO = "DM Sans";
export const FAMILIA_TITULO = "Sora";

/** Carpeta de los TTF dentro de public/. */
export const RUTA_FUENTES = "/fonts/pdf";

export const ARCHIVOS_FUENTES: readonly { familia: string; peso: number; archivo: string }[] = [
  { familia: FAMILIA_TITULO, peso: 600, archivo: "Sora-SemiBold.ttf" },
  { familia: FAMILIA_TITULO, peso: 700, archivo: "Sora-Bold.ttf" },
  { familia: FAMILIA_TEXTO, peso: 400, archivo: "DMSans-Regular.ttf" },
  { familia: FAMILIA_TEXTO, peso: 500, archivo: "DMSans-Medium.ttf" },
  { familia: FAMILIA_TEXTO, peso: 700, archivo: "DMSans-Bold.ttf" },
];

const registradas = new Set<string>();

/**
 * Registra las familias con la base de los archivos: una URL absoluta en el
 * navegador (`${origin}/fonts/pdf`) o una carpeta en Node. Idempotente por base.
 */
export function registrarFuentesPdf(base: string): void {
  if (registradas.has(base)) return;
  registradas.add(base);
  for (const familia of [FAMILIA_TITULO, FAMILIA_TEXTO]) {
    Font.register({
      family: familia,
      fonts: ARCHIVOS_FUENTES.filter((f) => f.familia === familia).map((f) => ({
        src: `${base}/${f.archivo}`,
        fontWeight: f.peso,
      })),
    });
  }
  // Sin guiones de partición: el español se corta por palabras completas
  Font.registerHyphenationCallback((palabra) => [palabra]);
}
