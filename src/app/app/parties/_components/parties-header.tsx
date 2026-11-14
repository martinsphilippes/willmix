import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { User } from "@/lib/db";
import { isAdmin } from "@/lib/auth/permissions";
import { cx } from "@/components/ui";

/*
 * Cadastros → Parceiros em três abas (dono, 14/11/2026): Cadastros (a lista
 * de sempre), Tipos de parceiro e Acessos externos (a antiga Gestão de
 * telas). Cada aba é o endereço de sempre: /app/parties, /app/parties/types e
 * /app/parties/access. Tipos: quem abre Cadastros lê; Acessos externos: só o
 * administrador (as páginas e as ações conferem de novo).
 */

export type PartiesTab = "registry" | "types" | "access";

const TABS: { key: PartiesTab; href: string; label: DictionaryKey }[] = [
  { key: "registry", href: "/app/parties", label: "parties.tab.registry" },
  { key: "types", href: "/app/parties/types", label: "parties.tab.types" },
  { key: "access", href: "/app/parties/access", label: "parties.tab.access" },
];

export function PartiesHeader({
  t,
  user,
  active,
  subtitle,
  actions,
}: {
  t: Translate;
  user: User;
  active: PartiesTab;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  const admin = isAdmin(user);
  return (
    <>
      {/* Título com as ações ao lado; embaixo, as abas e a explicação da aba. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="border-l-4 border-brand-600 pl-3 text-2xl font-bold tracking-tight text-zinc-900">
          {t("nav.parties")}
        </h1>
        {actions ? (
          <div className="flex flex-wrap gap-2" data-parties-actions>
            {actions}
          </div>
        ) : null}
      </div>
      <nav
        aria-label={t("parties.tabs")}
        className="mb-3 flex flex-wrap gap-2"
        data-parties-tabs
      >
        {TABS.filter((tab) => tab.key !== "access" || admin).map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? "page" : undefined}
            className={cx(
              "rounded-lg px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
              active === tab.key
                ? "bg-brand-600 text-white ring-brand-600 shadow-sm"
                : "bg-white text-zinc-700 ring-zinc-200 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200",
            )}
            data-parties-tab={tab.key}
          >
            {t(tab.label)}
          </Link>
        ))}
      </nav>
      {subtitle ? (
        <div className="mb-4 text-sm text-zinc-600">{subtitle}</div>
      ) : null}
    </>
  );
}
