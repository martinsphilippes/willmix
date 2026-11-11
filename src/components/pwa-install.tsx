"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/*
 * Aplicativo (PWA): registra o service worker (tela "sem conexão" e arquivos
 * do aplicativo guardados no aparelho) e convida a instalar o portal.
 *
 * O convite aparece só na tela de início (depois de entrar), nunca no login
 * nem no meio de um formulário, e some de vez quando o portal já está instalado ou a pessoa
 * escolhe "Agora não" (volta a aparecer depois de 30 dias).
 *  - Chrome/Edge (notebook, Galaxy): botão "Instalar" (o navegador pergunta).
 *  - Safari no iPhone/iPad: não há botão; mostramos o caminho pelo Compartilhar.
 *  - Safari no Mac: o caminho pelo menu Arquivo.
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "wm-pwa-dismissed";
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

/** Já roda como aplicativo (janela própria, sem a barra do navegador). */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

type Mode = "prompt" | "ios" | "mac" | null;

export function PwaInstall({
  labels,
}: {
  labels: {
    title: string;
    body: string;
    button: string;
    ios: string;
    mac: string;
    dismiss: string;
  };
}) {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode>(null);
  const [event, setEvent] = useState<InstallEvent | null>(null);

  // Service worker: só em produção (em desenvolvimento ele guardaria arquivos
  // que mudam a cada alteração).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sem service worker o portal funciona igual; só não há tela offline.
    });
  }, []);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;
    const onPrompt = (e: Event) => {
      // O navegador não mostra o convite dele; mostramos o nosso.
      e.preventDefault();
      setEvent(e as InstallEvent);
      setMode("prompt");
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Safari não tem o evento: mostramos o caminho manual.
    const ua = navigator.userAgent;
    const safari =
      /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Edg\//.test(ua);
    const iosDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      // iPadOS se apresenta como Mac; o toque denuncia.
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (iosDevice && safari) timer = setTimeout(() => setMode("ios"), 0);
    else if (/Macintosh/.test(ua) && safari)
      timer = setTimeout(() => setMode("mac"), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Só na tela de início, depois de entrar: no login o convite cobriria o
  // botão "Entrar" no celular.
  if (!mode || pathname !== "/app") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Sem armazenamento: some só nesta visita.
    }
    setMode(null);
  };
  const install = async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => null);
    setEvent(null);
    setMode(null);
  };

  return (
    <div
      role="dialog"
      aria-label={labels.title}
      data-pwa-install={mode}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl print:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/icon-192.png"
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-xl"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">{labels.title}</p>
          <p className="mt-0.5 text-sm text-zinc-600">
            {mode === "ios"
              ? labels.ios
              : mode === "mac"
                ? labels.mac
                : labels.body}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          data-pwa-dismiss
        >
          {labels.dismiss}
        </button>
        {mode === "prompt" ? (
          <button
            type="button"
            onClick={install}
            className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            data-pwa-install-button
          >
            {labels.button}
          </button>
        ) : null}
      </div>
    </div>
  );
}
