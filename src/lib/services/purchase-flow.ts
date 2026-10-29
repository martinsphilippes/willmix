import "server-only";

import { getStore, type PurchaseSheet, type User } from "@/lib/db";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";
import { notify } from "./notifications";

/*
 * Fluxo de compras, Fase B (docs/PURCHASE_FLOW.md): regras do despachante na
 * ficha da cotação.
 * - Dumping: com "Sim", a escolha do fornecedor (envio para aprovação e
 *   seleção) espera a liberação do gerente de produto ou do comprador
 *   (situação "Liberação DUMPING"). Marcar avisa os dois.
 * - Média: mudou em relação à ficha mestre do produto (recompra) → aviso à
 *   diretoria de compras para o despachante esclarecer.
 */

export class PurchaseFlowError extends Error {}

/** A escolha desta cotação está segurada por dumping sem liberação? */
export async function dumpingHold(quoteId: string): Promise<boolean> {
  const [sheet] = await getStore().list("purchase_sheets", {
    filter: { orderId: quoteId },
    limit: 1,
  });
  return !!sheet && sheet.dumping === "yes" && !sheet.dumpingReleasedAt;
}

/** Quem libera o dumping: gerente de produto, comprador ou admin. */
export function canReleaseDumping(user: User): boolean {
  if (!isWellmix(user)) return false;
  if (isAdmin(user)) return true;
  const fns = user.functions ?? [];
  return fns.includes("product_manager") || fns.includes("buyer");
}

/** Libera o dumping da ficha da cotação (registra quem e quando). */
export async function releaseDumping(user: User, quoteId: string) {
  if (!canReleaseDumping(user)) throw new ForbiddenError();
  const store = getStore();
  const [sheet] = await store.list("purchase_sheets", {
    filter: { orderId: quoteId },
    limit: 1,
  });
  if (!sheet || sheet.dumping !== "yes")
    throw new PurchaseFlowError("no_dumping");
  if (sheet.dumpingReleasedAt) return sheet;
  const updated = await store.update("purchase_sheets", sheet.id, {
    dumpingReleasedByUserId: user.id,
    dumpingReleasedAt: new Date().toISOString(),
  });
  await audit(
    user,
    "dumping.release",
    "quote",
    quoteId,
    "Dumping liberado para seguir com a escolha do fornecedor",
  );
  return updated;
}

/** Logins da Wellmix com alguma das funções (ninguém: os admins). */
async function withFunctions(fns: string[]): Promise<User[]> {
  const team = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const found = team.filter((u) =>
    (u.functions ?? []).some((f) => fns.includes(f)),
  );
  return found.length ? found : team.filter(isAdmin);
}

/**
 * Depois de salvar a ficha da cotação (despachante/Wellmix): avisa quando o
 * dumping passou a "Sim" e quando a média mudou em relação à ficha mestre.
 */
export async function customsSaved(
  user: User,
  quoteId: string,
  before: Partial<PurchaseSheet> | null,
  after: PurchaseSheet,
) {
  const store = getStore();
  const quote = await store.get("quotes", quoteId);
  const request = quote ? await store.get("requests", quote.requestId) : null;
  if (!request) return;
  const link = `/app/quotes/${quoteId}#dumping`;
  if (after.dumping === "yes" && before?.dumping !== "yes") {
    // Marcado de novo: a liberação anterior não vale mais.
    if (after.dumpingReleasedAt)
      await store.update("purchase_sheets", after.id, {
        dumpingReleasedByUserId: null,
        dumpingReleasedAt: null,
      });
    const to = await withFunctions(["product_manager", "buyer"]);
    await notify(
      { userIds: to.map((u) => u.id) },
      {
        link,
        kind: "action",
        actor: null,
        text: (t) => ({
          subject: t("purchaseFlow.notify.dumping.subject", {
            product: request.productName,
          }),
          body: t("purchaseFlow.notify.dumping.body", {
            note: after.dumpingNote ?? "—",
          }),
        }),
      },
    );
    await audit(
      user,
      "dumping.flag",
      "quote",
      quoteId,
      "Despachante marcou dumping: escolha do fornecedor aguarda liberação",
    );
  }
  // Recompra: a média mudou em relação à ficha mestre do produto.
  if (
    request.productId &&
    after.averagePrice != null &&
    before?.averagePrice !== after.averagePrice
  ) {
    const [master] = await store.list("purchase_sheets", {
      filter: { orderId: request.productId },
      limit: 1,
    });
    const previous = master?.averagePrice ?? null;
    if (previous != null && previous !== after.averagePrice) {
      const to = await withFunctions(["purchasing_director"]);
      await notify(
        { userIds: to.map((u) => u.id) },
        {
          link: `/app/quotes/${quoteId}`,
          kind: "alert",
          actor: null,
          text: (t) => ({
            subject: t("purchaseFlow.notify.average.subject", {
              product: request.productName,
            }),
            body: t("purchaseFlow.notify.average.body", {
              before: String(previous),
              after: String(after.averagePrice),
            }),
          }),
        },
      );
      await audit(
        user,
        "average.changed",
        "quote",
        quoteId,
        `Média alterada na recompra: ${previous} → ${after.averagePrice}`,
      );
    }
  }
}

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
