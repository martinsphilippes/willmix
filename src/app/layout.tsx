import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getLocale, getT } from "@/i18n/server";
import { INTL_TAG } from "@/i18n";
import { IntroPlayer } from "@/components/intro-player";
import { INTRO_BOOT } from "@/lib/intro";
import { PwaInstall } from "@/components/pwa-install";

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
  width: "device-width",
  initialScale: 1,
  // Aplicativo instalado em aparelho com recorte na tela: usa a tela toda
  // (as margens seguras ficam no globals.css).
  viewportFit: "cover",
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
        <PwaInstall
          labels={{
            title: t("pwa.install.title"),
            body: t("pwa.install.body"),
            button: t("pwa.install.button"),
            ios: t("pwa.install.ios"),
            mac: t("pwa.install.mac"),
            dismiss: t("pwa.install.dismiss"),
          }}
        />
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
