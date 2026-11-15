import "server-only";
import { getStore, type User } from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import {
  cleanContacts,
  contactIssues,
  readContacts,
  type ContactIssue,
  type CustomerContacts,
  type SellerContact,
} from "@/lib/order-terms";
import { isStockCustomer } from "./stock-party";
import { audit } from "./audit";

/*
 * Contatos do cliente na Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md): sócio, comprador, financeiro e fiscal, logística,
 * cada um com telefone e e-mail. Na primeira vez pelo portal o vendedor
 * preenche às cegas (a tela não mostra o que já estiver no cadastro); depois
 * de atualizados pelo portal, a próxima venda mostra os dados com "Editar".
 */

export class CustomerContactsError extends Error {
  constructor(
    code: string,
    readonly issues: ContactIssue[] = [],
  ) {
    super(code);
  }
}

/** Quem preenche: a Wellmix que abre Solicitações (o representante ou vendedor). */
const canFill = (user: User) => isWellmix(user) && canOpen(user, "requests");

export type ContactsView =
  | { state: "blind" }
  | {
      state: "known";
      contacts: CustomerContacts;
      updatedAt: string | null;
      updatedByName: string | null;
    };

/**
 * O que a tela mostra do cliente: "blind" (nunca atualizados pelo portal:
 * nada do cadastro vai para a tela) ou os contatos gravados pelo portal.
 */
export async function customerContactsView(
  user: User,
  customerId: string,
): Promise<ContactsView | null> {
  if (!canFill(user)) throw new ForbiddenError();
  const store = getStore();
  const party = await store.get("parties", customerId);
  if (!party || party.type !== "customer" || isStockCustomer(party.id))
    return null;
  const contacts = party.customerContactsUpdatedAt
    ? readContacts(party.customerContacts)
    : null;
  if (!contacts) return { state: "blind" };
  const by = party.customerContactsUpdatedByUserId
    ? await store.get("users", party.customerContactsUpdatedByUserId)
    : null;
  return {
    state: "known",
    contacts,
    updatedAt: party.customerContactsUpdatedAt ?? null,
    updatedByName: by?.name ?? null,
  };
}

/** O cliente já tem os contatos atualizados pelo portal? */
export async function hasPortalContacts(customerId: string): Promise<boolean> {
  const party = await getStore().get("parties", customerId);
  return (
    !!party?.customerContactsUpdatedAt && !!readContacts(party.customerContacts)
  );
}

/**
 * Contatos que não podem ser os do cliente: o de quem preenche (o
 * representante ou vendedor) e os logins da Wellmix (vendedores e
 * operadores), para o vendedor não pôr o próprio contato ou o de um colega.
 * O login do portal só tem e-mail (sem telefone): a comparação de telefone
 * vale quando houver um. Ver docs/ORDER_TERMS.md.
 */
export async function sellerContacts(user: User): Promise<SellerContact[]> {
  const internal = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  return [{ email: user.email }, ...internal.map((u) => ({ email: u.email }))];
}

/**
 * Grava os contatos do cliente (todos obrigatórios, nenhum igual ao do
 * vendedor). Devolve se mudou algo.
 */
export async function saveCustomerContacts(
  user: User,
  customerId: string,
  contacts: CustomerContacts,
): Promise<boolean> {
  if (!canFill(user)) throw new ForbiddenError();
  const store = getStore();
  const party = await store.get("parties", customerId);
  if (!party || party.type !== "customer" || isStockCustomer(party.id))
    throw new CustomerContactsError("contacts_not_customer");
  const issues = contactIssues(contacts, await sellerContacts(user));
  if (issues.length)
    throw new CustomerContactsError(
      issues.some((i) => i.code === "same_as_seller")
        ? "contacts_same_as_seller"
        : "contacts_invalid",
      issues,
    );
  const next = cleanContacts(contacts);
  const before = party.customerContactsUpdatedAt
    ? readContacts(party.customerContacts)
    : null;
  const now = new Date().toISOString();
  const changed = JSON.stringify(before) !== JSON.stringify(next);
  await store.update("parties", customerId, {
    customerContacts: next,
    customerContactsUpdatedAt: now,
    customerContactsUpdatedByUserId: user.id,
  });
  await audit(
    user,
    "party.contacts",
    "party",
    customerId,
    before
      ? changed
        ? "Contatos do cliente editados na Nova solicitação"
        : "Contatos do cliente confirmados na Nova solicitação"
      : "Contatos do cliente atualizados pela primeira vez no portal",
    before ? { customerContacts: before } : undefined,
    { customerContacts: next },
  );
  return changed;
}
