import type { Config } from "tailwindcss";

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
        brand: {
          navy:       "#1A3F72",   // azul marino del logo
          "navy-dark":"#15335C",   // hover de botones primarios
          green:      "#4EA234",   // verde del logo
          "green-dark":"#3D8229",  // hover de botones de éxito
          "blue-soft":"#E8EFF8",   // fondo suave azul (badges, hover de botones secundarios)
          "blue-soft-2":"#EEF3FB", // hover de filas
          "green-soft":"#EDF7E8",  // fondo suave verde
        },
        // Superficies neutras del shell de la app
        surface: {
          app:    "#F0F4F9",       // fondo del shell
          alt:    "#F8FAFD",       // fila alternada (tablas zebra)
        },
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
