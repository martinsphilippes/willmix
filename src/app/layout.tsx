import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Base dos links absolutos (imagem de compartilhamento): sempre o endereço principal.
  metadataBase: new URL("https://portal-wellmix.vercel.app"),
  title: {
    default: "Portal Wellmix",
    template: "%s · Wellmix",
  },
  description:
    "Portal Wellmix: importação do pedido à entrega, com cliente, fornecedor e parceiros no mesmo fluxo.",
  applicationName: "Portal Wellmix",
  appleWebApp: { title: "Wellmix", capable: true, statusBarStyle: "default" },
};

/** Barra do navegador (Safari/Chrome mobile) na cor da marca. */
export const viewport: Viewport = {
  themeColor: "#bf2026",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#f5f5f6] text-zinc-900">
        {children}
      </body>
    </html>
  );
}
