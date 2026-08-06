import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Saira_Condensed } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

// Trio tipográfico da "Sala de Situação": Public Sans (corpo/UI — desenhada
// para uso governamental, o USWDS), Saira Condensed (display — condensada e
// técnica, usada em caps com tracking, remete a sinalização e estêncil
// militar) e IBM Plex Mono (timestamps, contadores e metadados — leitura
// de instrumento).
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: "variable",
});

const sairaCondensed = Saira_Condensed({
  variable: "--font-saira",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Sistema de Notícias",
  description: "Painel de apoio à decisão — notícias coletadas por palavra-chave",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${publicSans.variable} ${sairaCondensed.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
