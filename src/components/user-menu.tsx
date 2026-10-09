"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Avatar no canto do cabeçalho: abre um cartão com nome, papel, e-mail e os
 * controles passados em `children` (ex.: Sair). Fecha ao clicar fora ou com Esc.
 */
export function UserMenu({
  name,
  role,
  email,
  label,
  children,
}: {
  name: string;
  role: string;
  email: string;
  label: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const initial = name.trim().charAt(0).toUpperCase();
  const first = name.trim().split(/\s+/)[0] ?? name;
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}: ${name}`}
        onClick={() => setOpen((v) => !v)}
        data-user-menu
        className="inline-flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2.5 text-sm transition hover:bg-white/10 focus-visible:outline-white"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-brand-700"
        >
          {initial}
        </span>
        <span className="hidden max-w-32 truncate font-medium lg:block">
          {first}
        </span>
      </button>
      {open ? (
        <div
          id={id}
          className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-zinc-200 bg-white p-2 text-zinc-800 shadow-lg shadow-zinc-900/10"
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-semibold text-zinc-900">
              {name}
            </p>
            <p className="text-xs text-zinc-500">{role}</p>
            <p className="truncate text-xs text-zinc-500">{email}</p>
          </div>
          {children ? (
            <div className="mt-1 border-t border-zinc-100 pt-2">{children}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
