import Link from "next/link";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { canOpen } from "@/lib/auth/screens";
import type { User } from "@/lib/db";
import { cx } from "@/components/ui";

/*
 * Seções da área Equipe Acessos e Parceiros (dono, 15/11/2026): Equipe,
 * Funções e acessos e Linha de produto e divisão (a tela Equipe, só de quem
 * abre Equipe: o administrador) e Parceiros (as três abas de sempre, de quem
 * abre Parceiros). Cada login vê só as seções que já abria; as telas e as
 * ações conferem de novo. Os endereços não mudaram: /app/team?tab=… e
 * /app/parties.
 */

export type TeamAreaSection = "team" | "functions" | "lines" | "partners";

const SECTIONS: {
  key: TeamAreaSection;
  href: string;
  label: DictionaryKey;
  screen: "team" | "parties";
}[] = [
  {
    key: "team",
    href: "/app/team?tab=team",
    label: "team.tab.team",
    screen: "team",
  },
  {
    key: "functions",
    href: "/app/team?tab=functions",
    label: "team.tab.functions",
    screen: "team",
  },
  {
    key: "lines",
    href: "/app/team?tab=lines",
    label: "team.tab.lines",
    screen: "team",
  },
  {
    key: "partners",
    href: "/app/parties",
    label: "nav.parties",
    screen: "parties",
  },
];

/** As seções que o login abre, na ordem da área. */
export function teamAreaSections(user: User): TeamAreaSection[] {
  return SECTIONS.filter((s) => canOpen(user, s.screen)).map((s) => s.key);
}

export function TeamAreaNav({
  t,
  user,
  active,
}: {
  t: Translate;
  user: User;
  active: TeamAreaSection;
}) {
  const allowed = new Set(teamAreaSections(user));
  return (
    <nav
      aria-label={t("nav.teamAccess")}
      className="mb-4 flex flex-wrap gap-1 border-b border-zinc-200"
      data-team-area-nav
    >
      {SECTIONS.filter((s) => allowed.has(s.key)).map((s) => (
        <Link
          key={s.key}
          href={s.href}
          aria-current={active === s.key ? "page" : undefined}
          className={cx(
            "rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold transition",
            active === s.key
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-zinc-500 hover:text-zinc-800",
          )}
          data-team-tab={s.key}
        >
          {t(s.label)}
        </Link>
      ))}
    </nav>
  );
}
