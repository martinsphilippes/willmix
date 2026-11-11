import "server-only";

import { getStore, type User } from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";

/*
 * Compra para estoque (origem interna, sem cliente): a solicitação é feita
 * para a empresa "Estoque Wellmix" (id fixo). Não tem sinal: escolhido o
 * fornecedor (e aprovado), o pedido nasce na hora.
 */
export const STOCK_PARTY_ID = "wellmix-estoque";
export const STOCK_OPTION = "__stock";

export function isStockCustomer(customerId: string | null | undefined) {
  return customerId === STOCK_PARTY_ID;
}

/** Garante a empresa interna de estoque (só a Wellmix cria). */
export async function ensureStockParty(user: User) {
  if (!isWellmix(user)) throw new ForbiddenError();
  const store = getStore();
  const existing = await store.get("parties", STOCK_PARTY_ID);
  if (existing) return existing;
  const { PARTY_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
  const party = await store.create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    id: STOCK_PARTY_ID,
    type: "customer",
    name: "Estoque Wellmix",
    country: "BR",
    email: null,
    phone: null,
    taxId: null,
    notes: "Compra para estoque (sem cliente). Criada pelo portal.",
    active: true,
    city: null,
    contactName: null,
    wechat: null,
    operationMode: null,
    radar: null,
  });
  await audit(
    user,
    "party.stock_created",
    "party",
    party.id,
    "Empresa interna de estoque criada",
  );
  return party;
}
