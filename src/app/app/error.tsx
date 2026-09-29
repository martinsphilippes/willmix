"use client";

import Link from "next/link";

/**
 * Limite de erro da área autenticada: acesso negado (papel sem permissão) e
 * falhas inesperadas caem aqui em vez da tela padrão do Next. O texto é
 * multilíngue de propósito: componentes client não têm o dicionário do servidor.
 */
export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-5xl font-bold tracking-tight text-brand-600">!</p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
        Não foi possível abrir esta página
      </h1>
      <p className="mt-3 leading-relaxed text-zinc-600">
        Seu perfil não tem acesso a ela ou ocorreu um erro. Volte ao início ou
        tente de novo.
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        This page is not available to your profile or failed to load. ·
        您的账号无权访问该页面或加载失败。
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/app"
          className="inline-flex items-center rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Início · Home · 首页
        </Link>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
        >
          Tentar de novo · Retry · 重试
        </button>
      </div>
    </div>
  );
}
