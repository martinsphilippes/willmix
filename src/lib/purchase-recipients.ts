import type { PartyType } from "@/lib/db/schema";
import { FAMILY_PARTY_TYPES, servesFamilies } from "@/lib/party-families";

/*
 * Quem recebe a cotação de compra na Estratégia de Compra (dono, 18/11/2026;
 * docs/PURCHASE_DEMAND.md, "Estratégia de Compra por produto"). Regras puras,
 * usadas pelo servidor, pela tela e pelos testes.
 */

/**
 * Tipos de parceiro que recebem a cotação: Fornecedor, Trading, Supplier
 * ("supplier_partner") e Factory, os mesmos do "Grupo de produto (família)"
 * do cadastro (docs/PARTNER_FAMILIES.md). GP e os outros parceiros não cotam.
 * Quem vence vira o fornecedor da solicitação e do pedido, de qualquer
 * desses tipos (dono, 18/11/2026).
 */
export const QUOTE_PARTY_TYPES: readonly PartyType[] = FAMILY_PARTY_TYPES;

export const receivesQuote = servesFamilies;

/**
 * Pendências que impedem o parceiro de receber ou responder a cotação no
 * portal, na ordem em que aparecem na tela.
 */
export const RECIPIENT_ISSUES = [
  "not_quote_type",
  "inactive",
  "type_inactive",
  "no_login",
  "no_quotes_screen",
] as const;
export type RecipientIssue = (typeof RECIPIENT_ISSUES)[number];

/** Avisos que não impedem (o aviso só não sai por e-mail). */
export const RECIPIENT_WARNINGS = ["no_email"] as const;
export type RecipientWarning = (typeof RECIPIENT_WARNINGS)[number];

/** O que a tela mostra de cada parceiro candidato. */
export interface RecipientCheck {
  partyId: string;
  name: string;
  type: PartyType;
  /** Nome do tipo no idioma de quem lê (Trading, Factory...). */
  typeLabel: string;
  country: string | null;
  /** Logins ativos que recebem o aviso no portal. */
  logins: number;
  issues: RecipientIssue[];
  warnings: RecipientWarning[];
  /** Recebe e responde (sem pendência). */
  ok: boolean;
}

/** Junta as pendências e diz se o parceiro está apto. */
export function recipientVerdict(input: {
  type: string;
  active: boolean;
  typeActive: boolean;
  logins: number;
  quotesScreen: boolean;
  loginsWithEmail: number;
}): {
  issues: RecipientIssue[];
  warnings: RecipientWarning[];
  ok: boolean;
} {
  const issues: RecipientIssue[] = [];
  if (!receivesQuote(input.type)) issues.push("not_quote_type");
  if (!input.active) issues.push("inactive");
  if (!input.typeActive) issues.push("type_inactive");
  if (input.logins === 0) issues.push("no_login");
  else if (!input.quotesScreen) issues.push("no_quotes_screen");
  const warnings: RecipientWarning[] =
    input.logins > 0 && input.loginsWithEmail === 0 ? ["no_email"] : [];
  return { issues, warnings, ok: issues.length === 0 };
}

/** A escolha de cada produto na Estratégia de Compra. */
export const STRATEGY_LINE_CHOICES = [
  "quote_last",
  "quote",
  "last_supplier",
] as const;
export type StrategyLineChoice = (typeof STRATEGY_LINE_CHOICES)[number];

/** A escolha cota (abre a Cotação de compra) ou é o pedido direto? */
export const choiceQuotes = (choice: string) =>
  choice === "quote" || choice === "quote_last";
