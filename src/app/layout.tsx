import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getLocale, getT } from "@/i18n/server";
import { INTL_TAG } from "@/i18n";
import { IntroPlayer } from "@/components/intro-player";
import { INTRO_BOOT } from "@/lib/intro";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Título e descrição no idioma do usuário (aba do navegador, compartilhamento). */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    // Base dos links absolutos (imagem de compartilhamento): sempre o endereço principal.
    metadataBase: new URL("https://portal-wellmix.vercel.app"),
    title: {
      default: t("app.name"),
      template: "%s · Wellmix",
    },
    description: t("app.description"),
    applicationName: t("app.name"),
    appleWebApp: { title: "Wellmix", capable: true, statusBarStyle: "default" },
  };
}

/** Barra do navegador (Safari/Chrome mobile) na cor da marca. */
export const viewport: Viewport = {
  themeColor: "#bf2026",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Idioma do documento segue a escolha do usuário (leitores de tela, fontes CJK, página de erro).
  const locale = await getLocale();
  const t = await getT();
  return (
    <html
      lang={INTL_TAG[locale]}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // A abertura marca <html data-wm-intro> antes da hidratação (só neste elemento).
      suppressHydrationWarning
    >
      <head>
        {/* Abertura do portal (desktop): decide antes do primeiro quadro e cobre a tela (src/lib/intro.ts). */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_BOOT }} />
      </head>
      <body className="flex min-h-full flex-col bg-[#f5f5f6] text-zinc-900">
        {children}
        <IntroPlayer
          labels={{
            title: t("intro.title"),
            skip: t("intro.skip"),
            brazil: t("intro.map.brazil"),
            china: t("intro.map.china"),
            caption: t("intro.map.caption"),
          }}
        />
      </body>
    </html>
  );
}
