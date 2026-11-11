import "server-only";

import { z } from "zod";
import { getStore, type ManufacturerCard, type User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";

/*
 * CARTÃO DO FABRICANTE: diz quem fabrica o produto. Fica no produto (vários
 * por produto, um por fornecedor e ao longo do tempo). Isolamento: o
 * fornecedor só corrige os próprios cartões; a Wellmix vê todos; o cliente
 * nunca vê nenhum. A cotação, onde o fornecedor enviava e confirmava o
 * cartão, saiu em 11/11/2026: os cartões já enviados continuam no produto.
 */

export class ManufacturerCardError extends Error {}

const clip = (v: string | null | undefined, max: number) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

const editSchema = z.object({
  companyName: z.string().max(160).nullable(),
  contactName: z.string().max(120).nullable(),
  phone: z.string().max(60).nullable(),
  email: z.string().max(160).nullable(),
  storeAddress: z.string().max(2000).nullable(),
  factoryAddress: z.string().max(2000).nullable(),
  isFactory: z.boolean().nullable(),
});

/** Corrige o que foi lido do cartão: quem enviou (o fornecedor) ou a Wellmix. */
export async function updateCardInfo(
  user: User,
  cardId: string,
  input: z.infer<typeof editSchema>,
): Promise<void> {
  const store = getStore();
  const card = await store.get("manufacturer_cards", cardId);
  if (!card) throw new ManufacturerCardError("not_found");
  // Só a Wellmix e o login de fornecedor da própria empresa do cartão.
  if (
    !isWellmix(user) &&
    (user.role !== "supplier" || user.partyId !== card.supplierId)
  )
    throw new ManufacturerCardError("forbidden");
  const data = editSchema.parse(input);
  const patch = {
    companyName: clip(data.companyName, 160),
    contactName: clip(data.contactName, 120),
    phone: clip(data.phone, 60),
    email: clip(data.email, 160),
    storeAddress: clip(data.storeAddress, 2000),
    factoryAddress: clip(data.factoryAddress, 2000),
    isFactory: data.isFactory,
  };
  await store.update("manufacturer_cards", card.id, patch);
  await audit(
    user,
    "card.update",
    "manufacturer_card",
    card.id,
    `Dados do cartão do fabricante corrigidos${patch.companyName ? `: ${patch.companyName}` : ""}`,
    {
      companyName: card.companyName,
      factoryAddress: card.factoryAddress,
      isFactory: card.isFactory,
    },
    patch,
  );
}

export interface ProductCardRow {
  card: ManufacturerCard;
  supplierName: string;
}

/** Todos os cartões do produto (só a Wellmix). */
export async function productCards(
  user: User,
  productId: string,
): Promise<ProductCardRow[]> {
  if (!isWellmix(user)) throw new ManufacturerCardError("forbidden");
  const store = getStore();
  const cards = await store.list("manufacturer_cards", {
    filter: { productId },
    orderBy: "createdAt",
    direction: "desc",
  });
  if (!cards.length) return [];
  const parties = new Map(
    (await store.list("parties", {})).map((p) => [p.id, p.name]),
  );
  return cards.map((card) => ({
    card,
    supplierName: parties.get(card.supplierId) ?? "—",
  }));
}
