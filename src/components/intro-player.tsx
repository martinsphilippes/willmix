"use client";

import { useEffect } from "react";
import { INTRO_ATTR, INTRO_SCRIPT_SRC } from "@/lib/intro";

/** Textos da abertura, já no idioma do usuário (src/i18n/modules/intro.ts). */
export type IntroLabels = {
  /** Rótulo acessível da camada. */
  title: string;
  /** Botão "Pular". */
  skip: string;
  brazil: string;
  china: string;
  caption: string;
};

type IntroInfo = { played: boolean; skipped: boolean; reduced: boolean };

/** API global de public/intro/wellmix-intro.js (só o que o portal usa). */
type IntroApi = {
  play(opts: {
    /** false: a regra de repetição é do script inline (src/lib/intro.ts), não do sessionStorage da peça. */
    once?: boolean;
    skipLabel?: string;
    ariaLabel?: string;
    labels?: { brazil?: string; china?: string; caption?: string };
    container?: HTMLElement;
    onStart?: (info: { reduced: boolean }) => void;
    onComplete?: (info: IntroInfo) => void;
  }): Promise<IntroInfo>;
  skip(): void;
};

declare global {
  interface Window {
    WellmixIntro?: IntroApi;
  }
}

/** Rede lenta ou script bloqueado: a página aparece mesmo assim. */
const LOAD_TIMEOUT_MS = 8000;
/** "Pouso" da página ao fim da animação (transição em globals.css). */
const LANDING_MS = 1000;

/**
 * Abertura do portal (docs/ARQUITETURA.md, seção 6). O script inline do
 * `<head>` (src/lib/intro.ts) já decidiu e cobriu a tela quando este
 * componente monta; aqui só se carrega a animação e se acompanha a fase em
 * `<html data-wm-intro>`. Sem o atributo, não faz nada (celular, aba que já
 * viu, navegador automatizado).
 */
export function IntroPlayer({ labels }: { labels: IntroLabels }) {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute(INTRO_ATTR) !== "pending") return;
    // Strict Mode ou nova renderização do layout: o script já está a caminho.
    if (document.querySelector(`script[src="${INTRO_SCRIPT_SRC}"]`)) return;

    const uncover = () => root.removeAttribute(INTRO_ATTR);
    const guard = window.setTimeout(uncover, LOAD_TIMEOUT_MS);
    const script = document.createElement("script");
    script.src = INTRO_SCRIPT_SRC;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(guard);
      uncover();
    };
    script.onload = () => {
      const api = window.WellmixIntro;
      if (!api) {
        window.clearTimeout(guard);
        uncover();
        return;
      }
      try {
        void api.play({
          once: false,
          skipLabel: labels.skip,
          ariaLabel: labels.title,
          labels: {
            brazil: labels.brazil,
            china: labels.china,
            caption: labels.caption,
          },
          // Fora do <body>: o "pouso" (globals.css) transforma o body, e uma
          // camada fixa dentro dele passaria a seguir a página, não a janela.
          container: root,
          onStart: () => {
            window.clearTimeout(guard);
            root.setAttribute(INTRO_ATTR, "playing");
          },
          onComplete: (info) => {
            window.clearTimeout(guard);
            if (!info.played) {
              uncover();
              return;
            }
            root.setAttribute(INTRO_ATTR, "done");
            window.setTimeout(uncover, LANDING_MS);
          },
        });
      } catch {
        window.clearTimeout(guard);
        uncover();
      }
    };
    document.body.appendChild(script);
    // Sem limpeza: a animação segue até o fim mesmo que o componente remonte.
  }, [labels]);
  return null;
}
