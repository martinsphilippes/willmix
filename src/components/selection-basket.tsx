"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/*
 * Seleção de itens (aba Itens): a cesta dos itens marcados para agrupar.
 * Cada linha tem uma caixa `input[data-basket-item]`; a do cabeçalho
 * (`input[data-basket-all]`) marca ou desmarca todas as da tela (o que o
 * filtro e a busca mostram). A cesta fica guardada nesta aba do navegador:
 * dá para buscar outra coisa e continuar marcando. "Agrupar" abre a aba
 * Seleção com os itens marcados, de vários fornecedores, para comparar.
 */

const KEY = "wm.selection.basket";
const MAX = 60;

function read(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function write(ids: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Sem armazenamento (aba privada): a cesta vale só até recarregar.
  }
}

export function SelectionBasket({
  labels,
  pageKey,
}: {
  /** Muda quando a lista muda (busca, filtro): as caixas novas são marcadas de novo. */
  pageKey: string;
  labels: {
    /** "{n} itens marcados" */
    count: string;
    group: string;
    clear: string;
    /** "Até {max} itens por grupo" */
    limit: string;
  };
}) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const idsRef = useRef<string[]>([]);

  useEffect(() => {
    const boxes = () => [
      ...document.querySelectorAll<HTMLInputElement>("input[data-basket-item]"),
    ];
    const all = () =>
      document.querySelector<HTMLInputElement>("input[data-basket-all]");
    const sync = (next: string[]) => {
      idsRef.current = next;
      setIds(next);
      write(next);
      const set = new Set(next);
      const list = boxes();
      for (const b of list) b.checked = set.has(b.value);
      const head = all();
      if (head) {
        const on = list.filter((b) => b.checked).length;
        head.checked = list.length > 0 && on === list.length;
        head.indeterminate = on > 0 && on < list.length;
      }
    };
    sync(read());
    const onChange = (e: Event) => {
      const el = e.target as HTMLInputElement | null;
      if (!el) return;
      if (el.matches("input[data-basket-all]")) {
        const visible = boxes().map((b) => b.value);
        const current = new Set(idsRef.current);
        if (el.checked) for (const v of visible) current.add(v);
        else for (const v of visible) current.delete(v);
        sync([...current].slice(0, MAX));
      } else if (el.matches("input[data-basket-item]")) {
        const current = idsRef.current.filter((v) => v !== el.value);
        if (el.checked) current.push(el.value);
        sync(current.slice(0, MAX));
      }
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, [pageKey]);

  if (!ids.length) return null;
  return (
    <div
      className="sticky bottom-3 z-20 mx-auto flex w-fit flex-wrap items-center gap-3 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm shadow-lg"
      data-selection-basket={ids.length}
    >
      <span className="font-medium text-zinc-800">
        {labels.count.replace("{n}", String(ids.length))}
      </span>
      {ids.length >= MAX ? (
        <span className="text-xs text-amber-700">
          {labels.limit.replace("{max}", String(MAX))}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() =>
          router.push(
            `/app/booking/selection?tab=selection&ids=${encodeURIComponent(ids.join(","))}`,
          )
        }
        className="rounded-full bg-brand-600 px-4 py-1.5 font-semibold text-white hover:bg-brand-700"
        data-selection-group
      >
        {labels.group}
      </button>
      <button
        type="button"
        onClick={() => {
          write([]);
          idsRef.current = [];
          setIds([]);
          for (const b of document.querySelectorAll<HTMLInputElement>(
            "input[data-basket-item], input[data-basket-all]",
          )) {
            b.checked = false;
            b.indeterminate = false;
          }
        }}
        className="rounded-full px-3 py-1.5 font-medium text-zinc-600 hover:bg-zinc-100"
        data-selection-basket-clear
      >
        {labels.clear}
      </button>
    </div>
  );
}
