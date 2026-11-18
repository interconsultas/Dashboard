/**
 * Tokens de diseño — dirección visual "C · Moderna luminosa".
 *
 * Fuente única de verdad de la identidad: Tailwind (tailwind.config.ts), el
 * tema de ECharts (lib/tema-graficas.ts) y las variables CSS de globals.css
 * salen de aquí (una prueba verifica que globals.css no se desincronice).
 *
 * Colores del logo: azul #2A5299 y verde lima #A2D06A.
 * Contraste WCAG AA verificado en __tests__/lib/tema-tokens.test.ts.
 */

export const COLORES = {
  /* Superficies */
  fondo: "#F4F7FB",
  superficie: "#FFFFFF",
  "superficie-2": "#F7FAFD",
  borde: "#E3EAF3",

  /* Texto: tinta (títulos, cifras), tinta-2 (cuerpo), tinta-3 (etiquetas, ayudas) */
  tinta: "#13233A",
  "tinta-2": "#4B5D75",
  // El prototipo usaba #8796AB (3,0:1 sobre blanco); se oscurece para cumplir AA
  "tinta-3": "#5F6F86",

  /* Marca */
  primario: "#2A5299",
  "primario-oscuro": "#1B3A6E",
  "primario-suave": "#E6EEFA",
  // El acento es para rellenos, barras e íconos: como texto sobre blanco no cumple AA
  acento: "#7DB33F",
  "acento-lima": "#A2D06A",
  "acento-suave": "#E8F6E5",

  /* Menú lateral */
  "menu-fondo": "#16294A",
  "menu-tinta": "#A9B7CB",
  "menu-activo": "#A2D06A",
  "menu-activo-tinta": "#16294A",

  /* Estados (texto sobre su versión suave cumple AA) */
  bien: "#447016",
  "bien-suave": "#EEF6E2",
  atencion: "#9A5A00",
  "atencion-suave": "#FFF1DC",
  critico: "#C0392B",
  "critico-suave": "#FDEAE7",

  /* Gráficas: líneas de referencia (metas, promedios) */
  referencia: "#A5B3C6",
} as const;

export type Token = keyof typeof COLORES;

export const RADIOS = { tarjeta: "20px", control: "12px" } as const;

export const SOMBRAS = {
  tarjeta: "0 10px 30px -18px rgba(30,79,154,.45)",
  logo: "0 8px 22px -10px rgba(0,0,0,.5)",
} as const;

/** Degradado de la cabecera de página (texto blanco a la izquierda). */
export const DEGRADADO_CABECERA = "linear-gradient(120deg, #1B3A6E 0%, #2A5299 55%, #7DB33F 125%)";

/**
 * Familias tipográficas. Los archivos viven en el repo (src/app/fonts) y los
 * declara globals.css con @font-face: nada se descarga de Google en el build
 * ni en el navegador. El nombre de familia es fijo para que el canvas de
 * ECharts también lo use.
 */
export const FUENTES = {
  texto: ['"DM Sans"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
  titulo: ["Sora", '"DM Sans"', "system-ui", "sans-serif"],
} as const;

/** La familia de texto como cadena CSS (ECharts, estilos en línea). */
export const FUENTE_TEXTO = FUENTES.texto.join(", ");

/**
 * Paleta categórica de gráficas: arranca con el azul y el verde del logo.
 * Orden fijo (el color sigue a la entidad, nunca se recicla) y validado con
 * el validador de daltonismo de la skill dataviz (modo claro): separación CVD
 * entre vecinos ΔE ≥ 12,3 y visión normal ΔE ≥ 23. El lima, el ámbar y el
 * naranja quedan bajo 3:1 contra blanco: las gráficas que los usan llevan
 * etiquetas visibles o tabla.
 */
export const PALETA_CATEGORICA = [
  "#2A5299",
  "#7DB33F",
  "#D9669B",
  "#E0A100",
  "#1BA39C",
  "#E8833A",
  "#6A4FB3",
  "#D64545",
] as const;

/**
 * Escala secuencial de un solo tono (formato condicional, embudo, Pareto):
 * sale del azul del logo (#2A5299, paso 5) interpolando en OKLCH con el mismo
 * tono, de claro a oscuro. Luminosidad estrictamente decreciente (lo verifica
 * __tests__/lib/tema-tokens.test.ts) y validada con el validador ordinal de la
 * skill dataviz desde el paso 2 (el primero que se usa como barra suelta:
 * 2,02:1 contra blanco). Los pasos 0 y 1 solo van de fondo de celdas que
 * imprimen su valor o en barras con etiqueta visible.
 */
export const ESCALA_SECUENCIAL = [
  "#DEEAFF",
  "#BDD4FB",
  "#94B5EE",
  "#719AE1",
  "#4874C2",
  "#2A5299",
  "#153368",
] as const;

/** Desde este paso de ESCALA_SECUENCIAL el texto encima va blanco (AA en todos los pasos). */
export const PASO_TINTA_CLARA = 4;

/** Pares texto/fondo que la app usa como texto y deben cumplir AA (4,5:1). */
export const PARES_TEXTO: readonly [Token | "blanco", Token | "blanco"][] = [
  ["tinta", "fondo"],
  ["tinta", "superficie"],
  ["tinta", "superficie-2"],
  ["tinta-2", "fondo"],
  ["tinta-2", "superficie"],
  ["tinta-2", "superficie-2"],
  ["tinta-2", "primario-suave"],
  ["tinta-3", "fondo"],
  ["tinta-3", "superficie"],
  ["tinta-3", "superficie-2"],
  ["primario", "superficie"],
  ["primario", "primario-suave"],
  ["primario-oscuro", "superficie"],
  ["blanco", "primario"],
  ["blanco", "primario-oscuro"],
  ["blanco", "critico"],
  ["menu-activo-tinta", "acento-lima"],
  ["menu-tinta", "menu-fondo"],
  ["menu-activo-tinta", "menu-activo"],
  ["bien", "bien-suave"],
  ["bien", "superficie"],
  ["atencion", "atencion-suave"],
  ["atencion", "superficie"],
  ["critico", "critico-suave"],
  ["critico", "superficie"],
];

/* ── Contraste WCAG 2.x ───────────────────────── */

function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canales.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste entre dos colores #RRGGBB (1 a 21). */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Valor hex de un token (o blanco). */
export function hexToken(t: Token | "blanco"): string {
  return t === "blanco" ? "#FFFFFF" : COLORES[t];
}
