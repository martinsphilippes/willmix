import Link from "next/link";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { canOpen } from "@/lib/auth/screens";
import type { User } from "@/lib/db";
import { cx } from "@/components/ui";

/*
 * Área Equipe Acessos e Parceiros em duas telas (dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md, etapa 5): **Equipe Interna** (/app/team, quem abre
 * Equipe: o administrador) e **Equipe Externa** (/app/parties, quem abre
 * Parceiros). Dentro da Equipe Interna ficam as seções de sempre (Equipe;
 * Cargos, áreas e funções; Linhas e divisões), na barra de abas da própria
 * tela (src/app/app/team/_components/team-header.tsx). Cada login vê só as
 * telas que já abria; as páginas e as ações conferem de novo. Os endereços
 * não mudaram: /app/team?tab=… e /app/parties.
 */

/** Seções da área (as de dentro da Equipe Interna acendem a Equipe Interna). */
export type TeamAreaSection =
  "team" | "areas" | "positions" | "functions" | "lines" | "partners";

const SECTIONS: {
  key: "team" | "partners";
  href: string;
  label: DictionaryKey;
  screen: "team" | "parties";
}[] = [
  {
    key: "team",
    href: "/app/team",
    label: "internalTeam.nav",
    screen: "team",
  },
  {
    // Equipe Externa (dono, 17/11/2026): os parceiros com acesso ao
    // portal, a antiga seção Parceiros.
    key: "partners",
    href: "/app/parties",
    label: "externalTeam.nav",
    screen: "parties",
  },
];

/** As telas da área que o login abre, na ordem da área. */
export function teamAreaSections(user: User): ("team" | "partners")[] {
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
  const current = active === "partners" ? "partners" : "team";
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
          aria-current={current === s.key ? "page" : undefined}
          className={cx(
            "rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold transition",
            current === s.key
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-zinc-500 hover:text-zinc-800",
          )}
          data-team-area={s.key}
        >
          {t(s.label)}
        </Link>
      ))}
    </nav>
  );
}
