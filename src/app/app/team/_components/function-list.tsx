"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createFunctionAction } from "@/app/app/actions/team";
import { Input, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { fold } from "./permission-list";

/*
 * Coluna das funções em Funções e acessos (dono, 14/11/2026): busca pelo
 * nome, a lista (a escolhida em destaque) e "+ Nova função" no pé, que abre o
 * campo do nome só quando escolhido.
 */

export interface FunctionListItem {
  key: string;
  label: string;
  meta: string;
  href: string;
  active: boolean;
  archived: boolean;
}

export function FunctionList({
  items,
  texts,
}: {
  items: FunctionListItem[];
  texts: {
    title: string;
    search: string;
    none: string;
    add: string;
    name: string;
    create: string;
    cancel: string;
  };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const q = fold(query.trim());
  const shown = q ? items.filter((i) => fold(i.label).includes(q)) : items;
  return (
    <aside
      className="flex min-w-0 flex-col rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm shadow-zinc-900/[0.03]"
      data-fn-list
    >
      <h2 className="mb-2 text-base font-semibold tracking-tight text-zinc-900">
        {texts.title}
      </h2>
      {/* iPad em pé e celular: um seletor compacto, para o editor da função
          ficar logo abaixo (a lista completa aparece em telas largas). */}
      <label className="mb-1 block lg:hidden">
        <span className="sr-only">{texts.title}</span>
        <select
          value={items.find((i) => i.active)?.href ?? ""}
          onChange={(e) => router.push(e.target.value)}
          className="block min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          data-fn-select
        >
          {items.map((i) => (
            <option key={i.key} value={i.href}>
              {i.label} · {i.meta}
            </option>
          ))}
        </select>
      </label>
      <label className="relative mb-2 hidden lg:block">
        <span className="sr-only">{texts.search}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={texts.search}
          className="block min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          data-fn-list-search
        />
      </label>
      <ul className="hidden space-y-1.5 lg:block">
        {shown.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.active ? "true" : undefined}
              className={cx(
                "block rounded-lg border px-3 py-2 text-sm transition",
                item.active
                  ? "border-brand-600 bg-brand-50 font-semibold text-brand-800"
                  : "border-zinc-200/80 bg-white text-zinc-800 hover:border-zinc-300",
                item.archived && "opacity-60",
              )}
              data-fn-item={item.key}
            >
              <span className="block leading-tight">{item.label}</span>
              <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
                {item.meta}
              </span>
            </Link>
          </li>
        ))}
        {!shown.length ? (
          <li className="px-1 py-2 text-xs text-zinc-500">{texts.none}</li>
        ) : null}
      </ul>
      <div className="mt-3 border-t border-zinc-100 pt-3">
        {adding ? (
          <form action={createFunctionAction} className="space-y-2" data-fn-new>
            <Input
              name="name"
              required
              minLength={2}
              maxLength={60}
              placeholder={texts.name}
              aria-label={texts.name}
              autoFocus
              dense
            />
            <div className="flex gap-2">
              <SubmitButton className="flex-1 text-xs">
                {texts.create}
              </SubmitButton>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
              >
                {texts.cancel}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            data-fn-new-open
          >
            <span aria-hidden className="text-lg leading-none">
              +
            </span>
            {texts.add}
          </button>
        )}
      </div>
    </aside>
  );
}
