import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { User } from "@/lib/db";
import { cx } from "@/components/ui";
import { TeamAreaNav } from "@/components/team-area-nav";

/*
 * Cabeçalho da Equipe Interna (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md,
 * etapa 5), no modelo da Equipe Externa: o título da área com as ações ao
 * lado; embaixo, as duas telas da área (Equipe Interna e Equipe Externa), as
 * seções da Equipe Interna (Equipe; Cargos, áreas e funções; Linhas e
 * divisões) e, dentro de "Cargos, áreas e funções", Cargos, Áreas e Funções e
 * acessos. Cada seção é o endereço de sempre (/app/team?tab=…).
 */

export type TeamTab = "team" | "areas" | "positions" | "functions" | "lines";

const TABS: {
  key: "team" | "structure" | "lines";
  href: string;
  label: DictionaryKey;
}[] = [
  { key: "team", href: "/app/team", label: "internalTeam.tab.team" },
  {
    key: "structure",
    href: "/app/team?tab=positions",
    label: "internalTeam.tab.structure",
  },
  {
    key: "lines",
    href: "/app/team?tab=lines",
    label: "internalTeam.tab.lines",
  },
];

const SUBTABS: {
  key: "positions" | "areas" | "functions";
  href: string;
  label: DictionaryKey;
}[] = [
  {
    key: "positions",
    href: "/app/team?tab=positions",
    label: "internalTeam.subtab.positions",
  },
  {
    key: "areas",
    href: "/app/team?tab=areas",
    label: "internalTeam.subtab.areas",
  },
  {
    key: "functions",
    href: "/app/team?tab=functions",
    label: "internalTeam.subtab.functions",
  },
];

const tabClass = (current: boolean) =>
  cx(
    "rounded-lg px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
    current
      ? "bg-brand-600 text-white ring-brand-600 shadow-sm"
      : "bg-white text-zinc-700 ring-zinc-200 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200",
  );

const sectionOf = (tab: TeamTab) =>
  tab === "team" ? "team" : tab === "lines" ? "lines" : "structure";

export function TeamHeader({
  t,
  user,
  active,
  subtitle,
  actions,
}: {
  t: Translate;
  user: User;
  active: TeamTab;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  const section = sectionOf(active);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="border-l-4 border-brand-600 pl-3 text-2xl font-bold tracking-tight text-zinc-900">
          {t("nav.teamAccess")}
        </h1>
        {actions ? (
          <div className="flex flex-wrap gap-2" data-team-actions>
            {actions}
          </div>
        ) : null}
      </div>
      <TeamAreaNav t={t} user={user} active={active} />
      <nav
        aria-label={t("internalTeam.tabs")}
        className="mb-3 flex flex-wrap gap-2"
        data-team-tabs
      >
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={section === tab.key ? "page" : undefined}
            className={tabClass(section === tab.key)}
            data-team-section={tab.key}
          >
            {t(tab.label)}
          </Link>
        ))}
      </nav>
      {section === "structure" ? (
        <nav
          aria-label={t("internalTeam.tab.structure")}
          className="-mt-1 mb-3 flex flex-wrap gap-x-4 gap-y-1 border-b border-zinc-200 text-sm"
          data-team-subtabs
        >
          {SUBTABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active === tab.key ? "page" : undefined}
              className={cx(
                "-mb-px border-b-2 px-1 pb-1.5 font-semibold transition",
                active === tab.key
                  ? "border-brand-600 text-brand-800"
                  : "border-transparent text-zinc-600 hover:text-zinc-900",
              )}
              data-team-tab={tab.key}
            >
              {t(tab.label)}
            </Link>
          ))}
        </nav>
      ) : null}
      {subtitle ? (
        <div className="mb-4 text-sm text-zinc-600">{subtitle}</div>
      ) : null}
    </>
  );
}
