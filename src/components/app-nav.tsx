"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Menu principal com o item da tela atual destacado.
 * "/app" só é ativo na própria página; os demais também nas subpáginas.
 */
export function AppNav({ items }: { items: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto text-sm [scrollbar-width:none]">
      {items.map((item) => {
        const active =
          item.href === "/app"
            ? pathname === "/app"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 font-medium transition ${
              active
                ? "border-white text-white"
                : "border-transparent text-white/75 hover:border-white/40 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
