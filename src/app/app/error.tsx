"use client";

import Link from "next/link";
import { useState } from "react";
import { isLocale, translator } from "@/i18n";

/**
 * Limite de erro da área autenticada: acesso negado (papel sem permissão) e
 * falhas inesperadas caem aqui em vez da tela padrão do Next. Componente
 * client não tem o dicionário do servidor: lê o idioma do <html lang>.
 */
function localeFromDocument() {
  if (typeof document === "undefined") return "pt" as const;
  const lang = document.documentElement.lang.slice(0, 2).toLowerCase();
  return isLocale(lang) ? lang : ("pt" as const);
}

export default function AppError({ reset }: { reset: () => void }) {
  const [t] = useState(() => translator(localeFromDocument()));
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-5xl font-bold tracking-tight text-brand-600">!</p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
        {t("error.page.title")}
      </h1>
      <p className="mt-3 leading-relaxed text-zinc-600">
        {t("error.page.body")}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/app"
          className="inline-flex items-center rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {t("nav.home")}
        </Link>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
        >
          {t("error.page.retry")}
        </button>
      </div>
    </div>
  );
}
