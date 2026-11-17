import type { OperationType } from "@/lib/order-terms";

/*
 * Telas de nova solicitação por tipo de operação (dono, 16/11/2026;
 * docs/REQUEST_SCREENS.md): "TS - Trading Sales" e "Venda - Encomenda", no
 * menu Produto novo, logo abaixo do Overview. São a mesma Nova solicitação da
 * Wellmix (o mesmo formulário e as mesmas regras), com o tipo de operação
 * fixo pela tela: quem abre a tela de TS só cria TS, e a de Venda só Venda.
 * A Nova solicitação de Encomendas (/app/requests/new) continua como está.
 * Regras puras, usadas no menu, nas páginas e no servidor.
 */

export const REQUEST_SCREEN_MODES = ["ts", "sale"] as const;
export type RequestScreenMode = (typeof REQUEST_SCREEN_MODES)[number];

export interface RequestScreenDef {
  /** Rota própria da tela. */
  path: string;
  /** Chave da tela no controle de acesso (src/lib/auth/screens.ts). */
  screen: "requestTs" | "requestSale";
  /** Tipo de operação que a tela grava (o servidor ignora o do formulário). */
  operation: OperationType;
}

export const REQUEST_SCREEN: Record<RequestScreenMode, RequestScreenDef> = {
  ts: { path: "/app/new-request/ts", screen: "requestTs", operation: "ts" },
  sale: {
    path: "/app/new-request/sale",
    screen: "requestSale",
    operation: "sale",
  },
};

export const isRequestScreenMode = (v: unknown): v is RequestScreenMode =>
  typeof v === "string" &&
  (REQUEST_SCREEN_MODES as readonly string[]).includes(v);

/**
 * Campo do formulário que diz de qual tela ele veio (rascunho). O servidor
 * confere a tela de quem envia; o campo só escolhe qual conferir.
 */
export const REQUEST_SCREEN_FIELD = "requestScreen";

/** A tela de onde veio o rascunho; sem o campo, a Nova solicitação de Encomendas. */
export function draftScreenOf(
  payload: ReadonlyArray<readonly [string, string]> | null | undefined,
): RequestScreenMode | null {
  const value = (payload ?? []).find(([k]) => k === REQUEST_SCREEN_FIELD)?.[1];
  return isRequestScreenMode(value) ? value : null;
}

/**
 * Reposição (dono, 16/11/2026; docs/REQUEST_SCREENS.md seção 7): o botão
 * "+ Adicionar" de Reposição abre a tela Venda - Encomenda com
 * `?from=replenishment`. Nessa entrada a tela aceita a compra para estoque
 * (sem cliente) e grava a solicitação com a origem "reposição", que cai na
 * fila de Reposição. Com um cliente escolhido, segue sendo a Venda de sempre.
 */
export const REPLENISHMENT_FROM = "from";
export const REPLENISHMENT_VALUE = "replenishment";
export const REPLENISHMENT_QUERY = `${REPLENISHMENT_FROM}=${REPLENISHMENT_VALUE}`;

/** O valor de `from` (URL ou campo do formulário) é a entrada da Reposição? */
export const isReplenishmentEntry = (v: unknown): boolean =>
  v === REPLENISHMENT_VALUE;

/**
 * O rascunho é da entrada da Reposição (dono, 17/11/2026)? O formulário
 * dessa entrada leva o campo `from=replenishment`, que fica no rascunho; a
 * Reposição (/app/replenishment) lista esses, Encomendas os demais.
 */
export function draftIsReplenishment(
  payload: ReadonlyArray<readonly [string, string]> | null | undefined,
): boolean {
  return (payload ?? []).some(
    ([k, v]) => k === REPLENISHMENT_FROM && isReplenishmentEntry(v),
  );
}

/** Endereço para continuar o rascunho na tela de onde ele veio. */
export function draftResumeHref(
  draftId: string,
  payload: ReadonlyArray<readonly [string, string]> | null | undefined,
): string {
  const screen = draftScreenOf(payload);
  const id = encodeURIComponent(draftId);
  if (screen === "sale" && draftIsReplenishment(payload))
    return `${REQUEST_SCREEN.sale.path}?${REPLENISHMENT_QUERY}&draft=${id}`;
  return `${screen ? REQUEST_SCREEN[screen].path : "/app/requests/new"}?draft=${id}`;
}
