import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Screen } from "./screens";
import type { ActionKey } from "./function-access";

/*
 * Módulos do portal nas telas de permissão (Equipe e acessos → Funções e
 * acessos e o painel Editar acessos; docs/ACCESS.md): as seções seguem os
 * blocos do menu lateral (src/lib/nav.ts, docs/FLOW_MENU.md). Cada tela e
 * cada ação fica num módulo só. Sem import de servidor: o navegador usa a
 * mesma lista.
 */

export interface PermissionModule {
  key: string;
  label: DictionaryKey;
  screens: readonly Screen[];
  actions: readonly ActionKey[];
}

export const PERMISSION_MODULES: readonly PermissionModule[] = [
  {
    // As telas do Início: livres por função e no Personalizado do login.
    key: "home",
    label: "nav.group.home",
    screens: ["home", "tasks", "sla", "messages", "notifications"],
    actions: [],
  },
  {
    // Produto novo (o Book do mapa): Book e Seleção de itens, Convites e
    // Solicitações ao fornecedor.
    key: "newProduct",
    label: "nav.group.newProduct",
    screens: ["booking", "quotes", "sourcing"],
    actions: ["supplierRequest.decide", "sampling.validate"],
  },
  {
    key: "order",
    label: "nav.group.order",
    screens: ["orders", "reviews"],
    actions: [
      "purchaseOrder.generate",
      "art.validate",
      "art.design",
      "contract.sign",
      "order.cancel",
    ],
  },
  {
    key: "production",
    label: "nav.production",
    screens: ["production"],
    actions: ["container.tracking", "realMedia.approve"],
  },
  {
    key: "delivery",
    label: "nav.group.arrival",
    screens: ["containers", "freight", "freightTariff"],
    actions: ["receiving.follow"],
  },
  {
    key: "sales",
    label: "nav.group.sales",
    screens: ["requests", "afterSales"],
    actions: ["purchaseOrder.salesNotice"],
  },
  {
    key: "finance",
    label: "nav.group.finance",
    screens: ["finance", "payables", "penalties", "account"],
    actions: ["numerario.manage", "values.view"],
  },
  {
    key: "panels",
    label: "nav.group.panels",
    screens: ["dashboards", "history", "marketing"],
    actions: [],
  },
  {
    key: "registry",
    label: "nav.group.registry",
    screens: ["parties", "products", "lines", "explore", "import"],
    actions: [],
  },
  {
    // Fixos embaixo do menu (Configurações, com o Superplan; Equipe e
    // acessos; Auditoria).
    key: "management",
    label: "nav.group.management",
    screens: ["settings", "superplan", "team", "audit"],
    actions: [],
  },
];

/**
 * Ações que não valem mais: a aprovação do pré-custo e a liberação de dumping
 * saíram do portal (dono, 11/11/2026; docs/QUOTE_FLOW.md). Nada as confere.
 * Continuam gravadas na função como estavam, mas não aparecem para marcar.
 */
export const RETIRED_ACTIONS: readonly ActionKey[] = [
  "dumping.release",
  "approval.planner",
  "approval.purchasing_director",
  "approval.executive_director",
];

export const isRetiredAction = (action: string) =>
  (RETIRED_ACTIONS as readonly string[]).includes(action);
