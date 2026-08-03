import type { Metadata } from "next";
import { Public_Sans, Source_Serif_4 } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

// Par tipográfico: Public Sans (corpo, rótulos, UI — desenhada para uso
// governamental/institucional, o USWDS) + Source Serif 4 (títulos e
// dados de destaque, para transmitir gravidade e tradição documental).
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: "variable",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: "variable",
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
      className={`${publicSans.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
