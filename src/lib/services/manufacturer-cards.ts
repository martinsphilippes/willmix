import "server-only";

import { z } from "zod";
import {
  getStore,
  type ManufacturerCard,
  type Quote,
  type User,
} from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { getAiAdapter } from "@/lib/integrations/ai";
import { buildPrompt } from "@/lib/ai/prompts";
import { audit } from "./audit";
import { storePhotoDocument, type PhotoSource } from "./documents";

/*
 * CARTÃO DO FABRICANTE: diz quem fabrica o produto. Fica no produto (vários
 * por produto, um por fornecedor e ao longo do tempo) e, a cada negociação
 * (cotação), o fornecedor confirma qual cartão vale. Sem cartão confirmado a
 * cotação não é enviada. Isolamento: o fornecedor só vê os próprios cartões;
 * a Wellmix vê todos; o cliente nunca vê nenhum.
 */

export class ManufacturerCardError extends Error {}

const cardSchema = z.object({
  cardFields: z.object({
    companyName: z.string().max(400).nullable().optional(),
    contactName: z.string().max(200).nullable().optional(),
    phone: z.string().max(200).nullable().optional(),
    email: z.string().max(300).nullable().optional(),
    storeAddress: z.string().max(2000).nullable().optional(),
    factoryAddress: z.string().max(2000).nullable().optional(),
    isFactory: z.boolean().nullable().optional(),
  }),
  notes: z.string().max(2000).nullable().optional(),
});

const clip = (v: string | null | undefined, max: number) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

/** Cotação + quem pode mexer no cartão dela (quem edita a parte do fornecedor). */
async function quoteFor(user: User, quoteId: string) {
  const store = getStore();
  const quote = await store.get("quotes", quoteId);
  if (!quote) throw new ManufacturerCardError("not_found");
  const { quoteSheetAccess } = await import("./quote-sheet");
  const access = quoteSheetAccess(user, quote);
  const request = await store.get("requests", quote.requestId);
  if (!request) throw new ManufacturerCardError("not_found");
  return { quote, request, canEdit: access.editSupplier, canView: access.view };
}

/** Cartões que valem para a cotação: do fornecedor dela e do produto (ou da própria cotação, se ainda não há produto). */
async function cardsForQuote(quote: Quote, productId: string | null) {
  const cards = await getStore().list("manufacturer_cards", {
    filter: { supplierId: quote.supplierId },
    orderBy: "createdAt",
    direction: "desc",
  });
  return cards.filter((c) =>
    productId ? c.productId === productId : c.quoteId === quote.id,
  );
}

export interface QuoteCardsView {
  cards: ManufacturerCard[];
  selectedId: string | null;
  confirmedAt: string | null;
  canEdit: boolean;
}

/** Cartões da cotação para a tela (fornecedor dela ou Wellmix). */
export async function quoteCardsView(
  user: User,
  quoteId: string,
): Promise<QuoteCardsView | null> {
  const { quote, request, canEdit, canView } = await quoteFor(user, quoteId);
  if (!canView || (!isWellmix(user) && user.partyId !== quote.supplierId))
    return null;
  return {
    cards: await cardsForQuote(quote, request.productId),
    selectedId: quote.manufacturerCardId ?? null,
    confirmedAt: quote.manufacturerCardConfirmedAt ?? null,
    canEdit,
  };
}

async function confirm(user: User, quote: Quote, cardId: string) {
  await getStore().update("quotes", quote.id, {
    manufacturerCardId: cardId,
    manufacturerCardConfirmedAt: new Date().toISOString(),
    manufacturerCardConfirmedByUserId: user.id,
  });
}

/**
 * Novo cartão apresentado na cotação: guarda a foto, a IA lê (se estiver
 * ligada; sem IA o cartão fica guardado sem os dados) e ele já vira o
 * cartão confirmado desta negociação.
 */
export async function addCardToQuote(
  user: User,
  quoteId: string,
  photo: PhotoSource,
): Promise<ManufacturerCard> {
  const { quote, request, canEdit } = await quoteFor(user, quoteId);
  if (!canEdit) throw new ManufacturerCardError("forbidden");
  const store = getStore();
  // Sem ligação a pedido/produto: só quem enviou e a Wellmix abrem.
  const doc = await storePhotoDocument(user, photo, {
    type: "photo",
    visibility: "internal",
  });
  let fields: z.infer<typeof cardSchema>["cardFields"] = {};
  let notes: string | null = null;
  let source: string | null = null;
  const adapter = getAiAdapter(await getSettings());
  const file = doc.mime.startsWith("image/")
    ? await store.getFile(doc.storageKey)
    : null;
  if (adapter.mode !== "manual" && file) {
    try {
      const result = await adapter.complete(buildPrompt("card"), {
        bytes: file.bytes,
        mime: doc.mime,
      });
      const parsed = cardSchema.safeParse(result?.json ?? {});
      if (parsed.success) {
        fields = parsed.data.cardFields;
        notes = parsed.data.notes ?? null;
        source = adapter.mode;
      }
    } catch {
      // A leitura é ajuda: o cartão (a prova) fica guardado mesmo sem ela.
      notes = null;
    }
  }
  const card = await store.create("manufacturer_cards", {
    productId: request.productId,
    supplierId: quote.supplierId,
    documentId: doc.id,
    companyName: clip(fields.companyName, 160),
    contactName: clip(fields.contactName, 120),
    phone: clip(fields.phone, 60),
    email: clip(fields.email, 160),
    storeAddress: clip(fields.storeAddress, 2000),
    factoryAddress: clip(fields.factoryAddress, 2000),
    isFactory: fields.isFactory ?? null,
    notes: clip(notes, 2000),
    source,
    quoteId: quote.id,
    createdByUserId: user.id,
  });
  await confirm(user, quote, card.id);
  await audit(
    user,
    "card.add",
    "quote",
    quote.id,
    `Cartão do fabricante enviado e confirmado na cotação${card.companyName ? `: ${card.companyName}` : ""}${card.isFactory === false ? " (sem endereço de fábrica)" : ""}`,
    null,
    { cardId: card.id, productId: card.productId },
  );
  return card;
}

/** Confirma, nesta negociação, um cartão já apresentado antes para o produto. */
export async function confirmCardForQuote(
  user: User,
  quoteId: string,
  cardId: string,
): Promise<void> {
  const { quote, request, canEdit } = await quoteFor(user, quoteId);
  if (!canEdit) throw new ManufacturerCardError("forbidden");
  const allowed = await cardsForQuote(quote, request.productId);
  const card = allowed.find((c) => c.id === cardId);
  // Cartão de outro fornecedor ou de outro produto nunca vale aqui.
  if (!card) throw new ManufacturerCardError("forbidden");
  await confirm(user, quote, card.id);
  await audit(
    user,
    "card.confirm",
    "quote",
    quote.id,
    `Cartão do fabricante confirmado na cotação${card.companyName ? `: ${card.companyName}` : ""}`,
    { cardId: quote.manufacturerCardId ?? null },
    { cardId: card.id },
  );
}

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
  if (!isWellmix(user) && user.partyId !== card.supplierId)
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
  /** Cotações em que este cartão foi o confirmado. */
  quoteIds: string[];
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
  const quotes = await store.list("quotes", {});
  const parties = new Map(
    (await store.list("parties", {})).map((p) => [p.id, p.name]),
  );
  return cards.map((card) => ({
    card,
    supplierName: parties.get(card.supplierId) ?? "—",
    quoteIds: quotes
      .filter((q) => q.manufacturerCardId === card.id)
      .map((q) => q.id),
  }));
}

/** A cotação pode ser enviada? (cartão confirmado nesta negociação). */
export function hasConfirmedCard(quote: Quote): boolean {
  return !!quote.manufacturerCardId;
}
