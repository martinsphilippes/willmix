import "server-only";

import { getStore, type PartnerFamily, type User } from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { receivesQuote } from "@/lib/purchase-recipients";
import { audit } from "./audit";
import { familyCatalog } from "./product-origin";

/*
 * Famílias atendidas por parceiro (cadastro do parceiro → "Famílias
 * atendidas"; dono, 18/11/2026; docs/PURCHASE_DEMAND.md): Fornecedor,
 * Trading, Supplier e Factory marcados numa família aparecem na Estratégia
 * de Compra para cotar os produtos dela. A família é o 1º nível da árvore de
 * grupos do Sankhya (services/product-origin.ts, chave "fm:<NOME>").
 */

export class PartnerFamilyError extends Error {}

async function safeList(filter: Record<string, unknown>) {
  try {
    return await getStore().list("partner_families", { filter });
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return [] as PartnerFamily[];
    throw error;
  }
}

/** As famílias que o parceiro atende, pelo nome. */
export async function partnerFamilies(
  partyId: string,
): Promise<PartnerFamily[]> {
  return (await safeList({ partyId })).sort((a, b) =>
    a.familyName.localeCompare(b.familyName, "pt"),
  );
}

/** Os parceiros vinculados a cada família (chave → ids). */
export async function partnersByFamily(
  keys: readonly string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const wanted = [...new Set(keys.filter(Boolean))];
  if (!wanted.length) return out;
  for (const row of await safeList({ familyKey: wanted }))
    out.set(row.familyKey, [...(out.get(row.familyKey) ?? []), row.partyId]);
  return out;
}

/**
 * Grava as famílias que o parceiro atende (troca a lista inteira). Só a
 * equipe da Wellmix que abre os cadastros; só os tipos que cotam. Uma
 * família que sumiu da lista do Sankhya continua marcada até alguém tirar.
 */
export async function setPartnerFamilies(
  user: User,
  partyId: string,
  keys: readonly string[],
): Promise<{ added: string[]; removed: string[] }> {
  if (!isWellmix(user)) throw new ForbiddenError();
  assertScreen(user, "parties");
  const store = getStore();
  const party = await store.get("parties", partyId);
  if (!party) throw new PartnerFamilyError("not_found");
  if (!receivesQuote(party.type))
    throw new PartnerFamilyError("family_type_not_allowed");
  const current = await partnerFamilies(partyId);
  const catalog = new Map((await familyCatalog()).map((f) => [f.key, f]));
  const wanted = new Set(
    keys.filter(
      (k) => catalog.has(k) || current.some((c) => c.familyKey === k),
    ),
  );
  const removed: string[] = [];
  for (const row of current)
    if (!wanted.has(row.familyKey)) {
      await store.remove("partner_families", row.id);
      removed.push(row.familyName);
    }
  const have = new Set(current.map((c) => c.familyKey));
  const added: string[] = [];
  for (const key of wanted) {
    if (have.has(key)) continue;
    const name = catalog.get(key)?.name ?? key;
    await store.create("partner_families", {
      partyId,
      familyKey: key,
      familyName: name.slice(0, 200),
      createdByUserId: user.id,
    });
    added.push(name);
  }
  if (added.length || removed.length)
    await audit(
      user,
      "partner.families",
      "party",
      partyId,
      `Famílias atendidas por ${party.name}: ${
        [
          added.length ? `+ ${added.join(", ")}` : "",
          removed.length ? `− ${removed.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("; ") || "sem mudança"
      }`,
      { families: current.map((c) => c.familyKey) },
      { families: [...wanted] },
    );
  return { added, removed };
}
