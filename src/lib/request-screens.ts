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
