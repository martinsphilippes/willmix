import type { DictionaryKey } from "@/i18n/dictionaries";
import type { User } from "@/lib/db/schema";
import type { NavEntry } from "@/lib/nav";

/*
 * Gestão do projeto (dono, 25/11/2026; docs/PROJECT_MANAGEMENT.md): a
 * Plataforma Wellmix v2 (visão, quadro Kanban, mapa, roadmap…) dentro do
 * portal, só para os logins desta lista. Fora do controle de telas: nenhuma
 * função, cargo ou papel abre; nada mais do portal muda.
 */
export const PROJECT_MANAGEMENT_EMAILS: readonly string[] = [
  "well@wellmix.com.br",
];

export const PROJECT_MANAGEMENT_PATH = "/app/project-management";

/** Abas da plataforma, na ordem do menu dela (o id é o "#" da aba). */
export const PM_TABS = [
  "visao",
  "projeto",
  "mapa",
  "processo",
  "raci",
  "personas",
  "entregue",
  "telas",
  "roadmap",
  "custos",
  "pendencias",
] as const;
export type PmTab = (typeof PM_TABS)[number];

export const isPmTab = (value: unknown): value is PmTab =>
  typeof value === "string" && (PM_TABS as readonly string[]).includes(value);

/** Coleções do quadro (as mesmas do banco do artifact). */
export const PM_COLLECTIONS = ["atividades", "pessoas", "registros"] as const;
export type PmCollection = (typeof PM_COLLECTIONS)[number];

export function canSeeProjectManagement(
  user: Pick<User, "email"> | null | undefined,
): boolean {
  const email = (user?.email ?? "").trim().toLowerCase();
  return !!email && PROJECT_MANAGEMENT_EMAILS.includes(email);
}

/** Id da linha em project_docs: `<coleção>.<docId>`. */
export const projectDocRowId = (collection: PmCollection, docId: string) =>
  `${collection}.${docId}`;

/** O grupo do menu (vazio para quem não está na lista). */
export function projectManagementNav(
  user: Pick<User, "email"> | null | undefined,
): NavEntry[] {
  if (!canSeeProjectManagement(user)) return [];
  return [
    {
      key: "nav.group.projectManagement",
      icon: "chart",
      items: PM_TABS.map((tab) => ({
        href: `${PROJECT_MANAGEMENT_PATH}/${tab}`,
        key: `pm.tab.${tab}` as DictionaryKey,
      })),
    },
  ];
}
