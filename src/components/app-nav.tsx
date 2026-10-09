"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isActiveHref } from "@/lib/nav";

/*
 * Menu principal. No computador: uma linha com as telas do dia a dia e os
 * grupos (Operação, Cadastros, Gestão) abrindo uma lista. No celular: botão
 * "Menu" que abre um painel com tudo (grupos como títulos) e, no fim, idioma,
 * conta de demonstração e Sair. O item da tela atual fica destacado; um grupo
 * fica destacado quando a tela atual está dentro dele. Listas e painel fecham
 * ao escolher um item, ao navegar, ao clicar fora e com Esc (foco volta ao
 * botão que abriu).
 */

export interface NavItemView {
  href: string;
  label: string;
}
export interface NavEntryView {
  label: string;
  href?: string;
  items?: NavItemView[];
}

/** Fecha quando a rota muda (voltar/avançar, navegação por código). */
function useCloseOnNavigate(close: () => void) {
  const pathname = usePathname();
  const last = useRef(pathname);
  useEffect(() => {
    if (last.current !== pathname) {
      last.current = pathname;
      close();
    }
  }, [pathname, close]);
}

const linkBase =
  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-white";
const linkIdle = "text-white/80 hover:bg-white/10 hover:text-white";
const linkActive = "bg-white/15 text-white";
const popover =
  "absolute top-full z-30 mt-1 min-w-48 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-800 shadow-lg shadow-zinc-900/10";
const popoverLink = (current: boolean) =>
  `block rounded-lg px-3 py-2 text-sm transition ${
    current ? "bg-brand-50 font-semibold text-brand-700" : "hover:bg-zinc-100"
  }`;

function GroupMenu({
  entry,
  active,
}: {
  entry: NavEntryView & { items: NavItemView[] };
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Lista perto da borda direita abre alinhada à direita (não sai da tela).
  const [alignEnd, setAlignEnd] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const pathname = usePathname();
  const close = useCallback(() => setOpen(false), []);
  useCloseOnNavigate(close);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  function toggle() {
    if (!open && button.current) {
      const rect = button.current.getBoundingClientRect();
      setAlignEnd(rect.left + 224 > window.innerWidth);
    }
    setOpen((v) => !v);
  }
  return (
    <div
      ref={root}
      className="relative"
      onBlur={(e) => {
        // Foco saiu da lista (Tab): fecha.
        if (open && !root.current?.contains(e.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-current={active ? "true" : undefined}
        onClick={toggle}
        data-nav-group={entry.label}
        className={`${linkBase} inline-flex items-center gap-1 ${active ? linkActive : linkIdle}`}
      >
        {entry.label}
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className={`h-3.5 w-3.5 opacity-80 transition ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open ? (
        <div
          id={id}
          data-nav-panel
          className={`${popover} ${alignEnd ? "right-0" : "left-0"}`}
        >
          {entry.items.map((item) => {
            const current = isActiveHref(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                onClick={close}
                className={popoverLink(current)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Linha do menu no computador. */
export function AppNav({
  entries,
  label,
}: {
  entries: NavEntryView[];
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center gap-0.5 py-1.5"
    >
      {entries.map((entry) =>
        entry.items ? (
          <GroupMenu
            key={entry.label}
            entry={entry as NavEntryView & { items: NavItemView[] }}
            active={entry.items.some((i) => isActiveHref(i.href, pathname))}
          />
        ) : (
          <Link
            key={entry.href}
            href={entry.href!}
            aria-current={
              isActiveHref(entry.href!, pathname) ? "page" : undefined
            }
            className={`${linkBase} ${isActiveHref(entry.href!, pathname) ? linkActive : linkIdle}`}
          >
            {entry.label}
          </Link>
        ),
      )}
    </nav>
  );
}

/** Celular: botão que abre o painel com todo o menu e, no fim, os "extras" (idioma, demo, Sair). */
export function MobileNav({
  entries,
  labels,
  extras,
}: {
  entries: NavEntryView[];
  labels: { open: string; close: string; main: string };
  extras?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useCloseOnNavigate(close);
  useEffect(() => {
    if (!open) return;
    // Painel modal: Esc fecha, o resto da página fica inerte, foco entra no
    // painel e volta ao botão ao fechar; crescer a tela (tablet girado) fecha.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const mq = window.matchMedia("(min-width: 768px)");
    const onMedia = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMedia);
    document.body.style.overflow = "hidden";
    const outside = Array.from(
      document.querySelectorAll<HTMLElement>("main, footer"),
    );
    for (const el of outside) el.setAttribute("inert", "");
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const trigger = button.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMedia);
      document.body.style.overflow = "";
      for (const el of outside) el.removeAttribute("inert");
      trigger?.focus();
    };
  }, [open]);
  const item = (link: NavItemView) => {
    const current = isActiveHref(link.href, pathname);
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={current ? "page" : undefined}
        onClick={close}
        className={`block rounded-lg px-3 py-2.5 text-base transition ${
          current
            ? "bg-brand-50 font-semibold text-brand-700"
            : "text-zinc-800 hover:bg-zinc-100"
        }`}
      >
        {link.label}
      </Link>
    );
  };
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((v) => !v)}
        data-mobile-menu
        className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/10 focus-visible:outline-white"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
          className="h-6 w-6"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>
      {open ? (
        <div
          id={id}
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={labels.main}
          data-mobile-panel
          className="fixed inset-x-0 bottom-0 top-14 z-40 overflow-y-auto bg-white text-zinc-900"
        >
          <nav aria-label={labels.main} className="space-y-1 px-3 py-3">
            {entries.map((entry, i) =>
              entry.items ? (
                <div
                  key={entry.label}
                  role="group"
                  aria-labelledby={`${id}-g${i}`}
                  className="pt-2"
                >
                  <h2
                    id={`${id}-g${i}`}
                    className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {entry.label}
                  </h2>
                  {entry.items.map(item)}
                </div>
              ) : (
                item({ href: entry.href!, label: entry.label })
              ),
            )}
          </nav>
          {extras ? (
            <div className="space-y-4 border-t border-zinc-200 px-3 py-4">
              {extras}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
