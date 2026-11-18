import type { Config } from "tailwindcss";
import { COLORES, DEGRADADO_CABECERA, FUENTES, RADIOS, SOMBRAS } from "./src/lib/tema/tokens";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Tokens de la dirección visual C (bg-superficie, text-tinta-2, bg-menu-fondo…)
        ...COLORES,
        // Claves heredadas, apuntadas a la paleta nueva para que las páginas
        // que aún no adoptan los componentes nuevos ya cambien de identidad
        brand: {
          navy:       COLORES["primario-oscuro"],
          "navy-dark":COLORES["menu-fondo"],     // hover de botones primarios
          green:      COLORES.acento,
          "green-dark":"#5E8F2A",                // hover de botones de éxito
          "blue-soft":COLORES["primario-suave"], // badges, hover de botones secundarios
          "blue-soft-2":COLORES["primario-suave"], // hover de filas
          "green-soft":COLORES["acento-suave"],
        },
        surface: {
          app:    COLORES.fondo,
          alt:    COLORES["superficie-2"],       // fila alternada (tablas zebra)
        },
      },
      fontFamily: {
        sans: [...FUENTES.texto],
        titulo: [...FUENTES.titulo],
      },
      borderRadius: {
        tarjeta: RADIOS.tarjeta,
        control: RADIOS.control,
      },
      boxShadow: {
        tarjeta: SOMBRAS.tarjeta,
        logo: SOMBRAS.logo,
      },
      backgroundImage: {
        cabecera: DEGRADADO_CABECERA,
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out forwards",
        "slide-in": "slide-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
