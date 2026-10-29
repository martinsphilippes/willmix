"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/*
 * "Voltar" no topo de todas as telas do portal: leva à tela anterior que a
 * pessoa de fato visitou (com os filtros que estavam nela), sem precisar ir
 * ao início e procurar de novo. Salvar um formulário recarrega a mesma tela
 * (?saved=, ?error=…): isso não conta como tela nova, então "Voltar" pula
 * essas recargas. Sem tela anterior nesta aba (link aberto direto), vai para
 * a tela "mãe" do menu (ex.: pedido → lista de Pedidos). O caminho fica só
 * nesta aba (sessionStorage) e sai no logout.
 */

export const NAV_HISTORY_KEY = "wellmix:nav-history";
const MAX = 50;

/** Parâmetros de aviso da própria tela (não mudam qual tela é). */
const TRANSIENT = [
  "error",
  "fields",
  "at",
  "saved",
  "created",
  "added",
  "deleted",
  "restored",
  "purged",
  "skipped",
  "rfq",
  "done",
  "photos",
  "photoRemoved",
  "adopted",
  "card",
  "board",
  "fromCart",
];

/** Endereço da tela sem os avisos (?saved=, ?error=…). */
export function screenUrl(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  for (const key of TRANSIENT) params.delete(key);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

const pathOf = (url: string) => url.split("?")[0];

/**
 * Atualiza o caminho com a tela atual: mesma tela (só filtros ou avisos
 * mudaram) troca a última entrada; a tela anterior (voltar do navegador)
 * tira a última; tela nova entra no fim.
 */
export function recordVisit(stack: string[], url: string): string[] {
  const last = stack.at(-1);
  if (last === url) return stack;
  if (last && pathOf(last) === pathOf(url)) return [...stack.slice(0, -1), url];
  if (stack.at(-2) === url) return stack.slice(0, -1);
  return [...stack, url].slice(-MAX);
}

/** Tela "mãe" pelo menu: o item mais específico que contém o endereço. */
export function parentFor(pathname: string, menu: string[]): string {
  const candidates = menu
    .filter(
      (href) =>
        href !== pathname &&
        (href === "/app" || pathname.startsWith(`${href}/`)),
    )
    .sort((a, b) => b.length - a.length);
  return candidates[0] ?? "/app";
}

function readStack(): string[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(NAV_HISTORY_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  try {
    sessionStorage.setItem(NAV_HISTORY_KEY, JSON.stringify(stack));
  } catch {
    // Sem armazenamento (aba privada): "Voltar" usa a tela mãe do menu.
  }
}

export function BackButton({
  label,
  menu,
}: {
  label: string;
  /** Endereços do menu do papel (tela mãe quando não há tela anterior). */
  menu: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = screenUrl(pathname, search);

  useEffect(() => {
    writeStack(recordVisit(readStack(), current));
  }, [current]);

  // No início não há para onde voltar.
  if (pathname === "/app") return null;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => {
          // A última entrada é esta tela; a anterior é para onde voltar.
          const stack = recordVisit(readStack(), current);
          const previous = stack.length > 1 ? stack[stack.length - 2] : null;
          // Tira esta tela do caminho antes de ir (não volta para ela).
          if (previous) writeStack(stack.slice(0, -1));
          router.push(previous ?? parentFor(pathname, menu));
        }}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600"
        data-back-button
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className="h-4 w-4"
        >
          <path d="M12.8 4.5a.75.75 0 0 1 0 1.06L8.33 10l4.47 4.44a.75.75 0 1 1-1.06 1.06l-5-5a.75.75 0 0 1 0-1.06l5-5a.75.75 0 0 1 1.06 0Z" />
        </svg>
        {label}
      </button>
    </div>
  );
}
