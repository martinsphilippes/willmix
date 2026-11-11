"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatIcon } from "./chat-open-button";

/*
 * Faixa "Nova mensagem da Wellmix" embaixo do cabeçalho, em toda tela de quem
 * é de fora (fornecedor, cliente, parceiros), enquanto houver mensagem não
 * lida: quem escreveu, o assunto, o começo da mensagem (já no idioma de quem
 * lê) e "Abrir e responder", que leva direto ao assunto. Some ao ler (a
 * conversa marca como lida) e na própria tela de Mensagens.
 */
export function UnreadMessagesBar({
  count,
  title,
  meta,
  text,
  href,
  openLabel,
  allLabel,
}: {
  count: number;
  /** "Nova mensagem da Wellmix" / "3 mensagens novas". */
  title: string;
  /** "Ana Admin · Pedido #1 · Jarra de vidro 1,5 L · 09/11 11:29". */
  meta: string;
  /** Começo da mensagem mais recente. */
  text: string;
  /** Assunto da mensagem mais recente. */
  href: string;
  openLabel: string;
  /** "Ver todas" (mais de um assunto com novidade); null = sem o link. */
  allLabel: string | null;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith("/app/messages")) return null;
  return (
    <div
      className="border-b border-amber-200 bg-amber-50"
      role="status"
      data-unread-bar={count}
    >
      <div className="mx-auto flex w-full portal-wide items-center gap-3 px-4 py-2.5">
        <span
          aria-hidden
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"
        >
          <ChatIcon className="h-4.5 w-4.5" />
          <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold leading-none text-brand-700 ring-2 ring-amber-50">
            {count > 99 ? "99+" : count}
          </span>
        </span>
        <Link href={href} className="group min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-bold text-zinc-900">{title}</span>
            <span className="truncate text-xs text-zinc-600">{meta}</span>
          </span>
          <span
            className="block truncate text-sm text-zinc-800 group-hover:underline"
            data-unread-bar-text
          >
            “{text}”
          </span>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
          <Link
            href={href}
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            data-unread-bar-open
          >
            {openLabel}
          </Link>
          {allLabel ? (
            <Link
              href="/app/messages"
              className="text-xs font-semibold text-brand-700 underline underline-offset-2"
            >
              {allLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
