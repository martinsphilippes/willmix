import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { User } from "@/lib/db";
import { isAdmin } from "@/lib/auth/permissions";
import { cx } from "@/components/ui";
import { TeamAreaNav } from "@/components/team-area-nav";

/*
 * Parceiros em três abas (dono, 14/11/2026): Cadastros (a lista de sempre),
 * Tipos de parceiro e Acessos externos (a antiga Gestão de telas). Cada aba é
 * o endereço de sempre: /app/parties, /app/parties/types e
 * /app/parties/access. Tipos: quem abre Cadastros lê; Acessos externos: só o
 * administrador (as páginas e as ações conferem de novo).
 *
 * Desde 15/11/2026 (dono), Parceiros é uma seção da área Equipe Acessos e
 * Parceiros (antes, Cadastros → Parceiros): o título é o da área, embaixo as
 * seções da área (só as que o login abre) e, dentro de Parceiros, as três
 * abas. Os endereços, as telas e as permissões não mudaram.
 */

export type PartiesTab = "registry" | "types" | "access";

/*
 * Tipos e acessos (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md, etapa 3): as
 * antigas abas Tipos de parceiro e Acessos externos viraram uma só, com as
 * duas partes dentro: os tipos (o que a empresa é) e os perfis de login com
 * as telas (o que os logins abrem; os modos "Por tipo ou perfil" e "Por
 * tela"). Tipo e perfil aparecem como coisas diferentes. Os endereços são os
 * de sempre (/app/parties/types e /app/parties/access).
 */
const TABS: {
  key: "registry" | "types-access";
  href: string;
  label: DictionaryKey;
}[] = [
  { key: "registry", href: "/app/parties", label: "parties.tab.registry" },
  {
    key: "types-access",
    href: "/app/parties/types",
    label: "parties.tab.typesAccess",
  },
];

const SUBTABS: {
  key: "types" | "access";
  href: string;
  label: DictionaryKey;
}[] = [
  { key: "types", href: "/app/parties/types", label: "parties.subtab.types" },
  {
    key: "access",
    href: "/app/parties/access",
    label: "parties.subtab.access",
  },
];

const tabClass = (current: boolean) =>
  cx(
    "rounded-lg px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
    current
      ? "bg-brand-600 text-white ring-brand-600 shadow-sm"
      : "bg-white text-zinc-700 ring-zinc-200 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200",
  );

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
      {/* Título da área com as ações ao lado; embaixo, as seções da área, as
          abas de Parceiros e a explicação da aba. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="border-l-4 border-brand-600 pl-3 text-2xl font-bold tracking-tight text-zinc-900">
          {t("nav.teamAccess")}
        </h1>
        {actions ? (
          <div className="flex flex-wrap gap-2" data-parties-actions>
            {actions}
          </div>
        ) : null}
      </div>
      <TeamAreaNav t={t} user={user} active="partners" />
      <nav
        aria-label={t("parties.tabs")}
        className="mb-3 flex flex-wrap gap-2"
        data-parties-tabs
      >
        {TABS.map((tab) => {
          const current =
            tab.key === "registry"
              ? active === "registry"
              : active !== "registry";
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              className={tabClass(current)}
              data-parties-tab={tab.key}
            >
              {t(tab.label)}
            </Link>
          );
        })}
      </nav>
      {active !== "registry" ? (
        // Dentro de Tipos e acessos: os tipos e (só o administrador) os
        // perfis de login com as telas.
        <nav
          aria-label={t("parties.tab.typesAccess")}
          className="-mt-1 mb-3 flex flex-wrap gap-x-4 gap-y-1 border-b border-zinc-200 text-sm"
          data-parties-subtabs
        >
          {SUBTABS.filter((tab) => tab.key !== "access" || admin).map((tab) => (
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
              data-parties-subtab={tab.key}
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
