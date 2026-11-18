import type { Metadata } from "next";
// Las fuentes (DM Sans y Sora) se autoalojan desde globals.css: ver @font-face allí
import "./globals.css";

export const metadata: Metadata = {
  title: "Interconsultas",
  description: "Sistema de autorizaciones médicas IPS Manizales",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
