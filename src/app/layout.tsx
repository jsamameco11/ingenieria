import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, JetBrains_Mono, Source_Sans_3 } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "CALIA · Memorias de cálculo estructural",
  description: "Plataforma profesional de memorias de cálculo para puentes y edificaciones. AASHTO, NTE E.060 y E.030.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className={`${display.variable} ${sans.variable} ${mono.variable} blueprint-grid antialiased`}>
        <Header />
        {children}
      </body>
    </html>
  );
}
