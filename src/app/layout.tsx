import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Join4 · PMO",
  description: "Gestão de horas, fechamentos e forecast da equipe Join4.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <head>
        {/*
          Carregado via <link> (em vez de next/font) de propósito: mesma
          abordagem já usada e validada no relatório de Fechamento de Horas,
          e funciona em qualquer ambiente de build sem depender de acesso a
          fonts.googleapis.com durante o build.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-ink">{children}</body>
    </html>
  );
}
