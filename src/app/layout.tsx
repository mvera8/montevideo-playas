import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { SITIO } from "@/lib/sitio";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Solo la cursiva de los títulos de la home ("...en un *mapa*"); un peso, sin variantes de más.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITIO.url),
  // Cada página pone solo su título ("Contacto") y la marca se agrega acá.
  title: { default: SITIO.marca, template: `%s · ${SITIO.marca}` },
  description: `Playas, guardavidas, calidad del agua y clima en ${SITIO.nombre}.`,
  openGraph: { siteName: SITIO.marca, locale: "es_UY", type: "website" },
  twitter: { card: "summary_large_image" },
  // Nombre sugerido en iOS al "Agregar a inicio" (sin esto usa el <title> o el short_name del manifest).
  appleWebApp: { title: `${SITIO.nombre} ${SITIO.alcance}` },
};

// Color de la barra del navegador en el celular: el mismo fondo del sitio en claro y oscuro (globals.css).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1620" },
  ],
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-UY"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
      {/* Google Analytics 4 (ver README, "Analytics"). Sin ID no se carga: en local y previews no mide. */}
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
    </html>
  );
}
