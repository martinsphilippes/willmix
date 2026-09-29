import "server-only";

import {
  getStore,
  PAYMENT_EXTRA_DEFAULTS,
  type Document,
  type MarketingKit,
  type MarketingKitStatus,
  type Payment,
  type Product,
  type User,
} from "@/lib/db";
import { assertWellmix, isWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import { uploadDocument } from "./documents";
import { notify, notifyWellmix } from "./notifications";

/**
 * Marketing studio e kit de marketing por produto.
 * Preview → Oferta → Compra → Pagamento → Liberação.
 * O produto cadastrado alimenta o kit (nome, categoria, material, cores,
 * Pantone, fotos); os textos podem vir de sugestão de IA, sempre confirmados.
 * Preço vem das configurações (marketingKitDefaultPrice), editável por kit.
 * Pagamento reutiliza `payments` (customer_in, kitId) em modo manual.
 */
export class MarketingError extends Error {}

/** Cliente vê o kit a partir da oferta; a Wellmix vê tudo. */
export function canViewKit(user: User, kit: MarketingKit) {
  if (isWellmix(user)) return true;
  if (user.role !== "customer" || !user.partyId) return false;
  return (
    kit.customerId === user.partyId &&
    !["draft", "preview", "cancelled"].includes(kit.status)
  );
}

/** Situações a partir das quais as prévias ficam visíveis ao cliente. */
const PREVIEW_VISIBLE: MarketingKitStatus[] = [
  "offered",
  "purchased",
  "paid",
  "released",
];

/** Documento de kit: Wellmix sempre; cliente dono conforme a situação (prévia ≥ oferta; final só liberado). */
export function canViewKitDocument(
  user: User,
  kit: MarketingKit,
  documentId: string,
) {
  if (isWellmix(user)) return true;
  if (user.role !== "customer" || kit.customerId !== user.partyId) return false;
  if (kit.releasedDocumentIds.includes(documentId))
    return kit.status === "released";
  if (kit.previewDocumentIds.includes(documentId))
    return PREVIEW_VISIBLE.includes(kit.status);
  return false;
}

async function ensureEnabled() {
  const settings = await getSettings();
  if (!settings.marketingEnabled)
    throw new MarketingError("marketing_disabled");
  return settings;
}

export async function createKit(
  user: User,
  productId: string,
  input: {
    customerId?: string | null;
    name?: string | null;
    price?: number | null;
    currency?: string | null;
  } = {},
): Promise<MarketingKit> {
  assertWellmix(user);
  const settings = await ensureEnabled();
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) throw new MarketingError("not_found");
  if (input.customerId) {
    const customer = await store.get("parties", input.customerId);
    if (!customer || customer.type !== "customer")
      throw new MarketingError("invalid_customer");
  }
  const price = input.price ?? settings.marketingKitDefaultPrice;
  if (!(price >= 0)) throw new MarketingError("invalid_price");
  const kit = await store.create("marketing_kits", {
    productId,
    customerId: input.customerId ?? null,
    name: input.name?.trim() || `Kit de marketing · ${product.name}`,
    price,
    currency: (input.currency ?? settings.marketingKitCurrency).toUpperCase(),
    status: "draft",
    concept: null,
    slogan: null,
    description: null,
    campaign: null,
    colors: product.color ? [product.color] : null,
    pantone: product.pantone,
    previewDocumentIds: [],
    releasedDocumentIds: [],
    paymentId: null,
    offeredAt: null,
    purchasedAt: null,
    paidAt: null,
    releasedAt: null,
    notes: null,
    createdByUserId: user.id,
  });
  await audit(user, "kit.create", "marketing_kit", kit.id, kit.name);
  return kit;
}

export interface KitPatch {
  name?: string;
  customerId?: string | null;
  price?: number;
  currency?: string;
  concept?: string | null;
  slogan?: string | null;
  description?: string | null;
  campaign?: string | null;
  colors?: string[] | null;
  pantone?: string | null;
  notes?: string | null;
}

/** Textos e preço (preço só até a compra; cliente só enquanto não ofertado). */
export async function updateKit(user: User, id: string, patch: KitPatch) {
  assertWellmix(user);
  const store = getStore();
  const kit = await store.get("marketing_kits", id);
  if (!kit) throw new MarketingError("not_found");
  if (kit.status === "cancelled") throw new MarketingError("kit_cancelled");
  const locked = ["purchased", "paid", "released"].includes(kit.status);
  const next: Partial<MarketingKit> = { ...patch };
  if (locked) {
    delete next.price;
    delete next.currency;
    delete next.customerId;
  }
  if (kit.status === "offered") delete next.customerId;
  if (next.price !== undefined && !(next.price >= 0))
    throw new MarketingError("invalid_price");
  if (next.currency) next.currency = next.currency.toUpperCase();
  if (next.customerId) {
    const customer = await store.get("parties", next.customerId);
    if (!customer || customer.type !== "customer")
      throw new MarketingError("invalid_customer");
  }
  const updated = await store.update("marketing_kits", id, next);
  await audit(
    user,
    "kit.update",
    "marketing_kit",
    id,
    Object.keys(next).join(", "),
    pick(kit, next),
    next,
  );
  return updated;
}

/** Prévia (visível ao cliente a partir da oferta) ou arquivo final (só depois da liberação). */
export async function addKitFile(
  user: User,
  id: string,
  file: File,
  stage: "preview" | "final",
) {
  assertWellmix(user);
  const store = getStore();
  const kit = await store.get("marketing_kits", id);
  if (!kit) throw new MarketingError("not_found");
  if (kit.status === "cancelled") throw new MarketingError("kit_cancelled");
  const doc = await uploadDocument(user, file, {
    type: "art",
    visibility: "customer",
    productId: kit.productId,
    kitId: kit.id,
  });
  const key =
    stage === "preview" ? "previewDocumentIds" : "releasedDocumentIds";
  const patch: Partial<MarketingKit> = { [key]: [...kit[key], doc.id] };
  if (stage === "preview" && kit.status === "draft") patch.status = "preview";
  await store.update("marketing_kits", id, patch);
  await audit(user, `kit.${stage}File`, "marketing_kit", id, doc.name);
  return doc;
}

/** Oferta ao cliente: precisa de cliente definido. */
export async function offerKit(user: User, id: string) {
  assertWellmix(user);
  const store = getStore();
  const kit = await store.get("marketing_kits", id);
  if (!kit) throw new MarketingError("not_found");
  if (!["draft", "preview"].includes(kit.status))
    throw new MarketingError("invalid_status");
  if (!kit.customerId) throw new MarketingError("customer_required");
  const updated = await store.update("marketing_kits", id, {
    status: "offered",
    offeredAt: new Date().toISOString(),
  });
  await audit(
    user,
    "kit.offer",
    "marketing_kit",
    id,
    `${kit.price} ${kit.currency}`,
  );
  await notify(
    { role: "customer", partyId: kit.customerId },
    {
      subject: `Kit de marketing disponível: ${kit.name}`,
      body: `Veja a prévia e, se quiser, compre por ${kit.price} ${kit.currency}.`,
      link: `/app/marketing/${kit.id}`,
    },
  );
  return updated;
}

/** Compra: o cliente (dono) aceita a oferta, ou a Wellmix registra a compra por ele. Cria o pagamento pendente. */
export async function purchaseKit(user: User, id: string) {
  const store = getStore();
  const kit = await store.get("marketing_kits", id);
  if (!kit) throw new MarketingError("not_found");
  if (!canViewKit(user, kit)) throw new MarketingError("forbidden");
  if (!(isWellmix(user) || user.role === "customer"))
    throw new MarketingError("forbidden");
  if (kit.status !== "offered") throw new MarketingError("invalid_status");
  const settings = await getSettings();
  const payment: Payment = await store.create("payments", {
    ...PAYMENT_EXTRA_DEFAULTS,
    orderId: null,
    requestId: null,
    direction: "customer_in",
    amount: kit.price,
    currency: kit.currency,
    fxRate: null,
    method: settings.paymentMode,
    status: "pending",
    proofDocumentId: null,
    registeredByUserId: user.id,
    confirmedByUserId: null,
    confirmedAt: null,
    note: `Kit de marketing: ${kit.name}`,
    kitId: kit.id,
  });
  const updated = await store.update("marketing_kits", id, {
    status: "purchased",
    purchasedAt: new Date().toISOString(),
    paymentId: payment.id,
  });
  await audit(
    user,
    "kit.purchase",
    "marketing_kit",
    id,
    `${kit.price} ${kit.currency}`,
  );
  await notifyWellmix({
    subject: `Kit de marketing comprado: ${kit.name}`,
    body: `Confirme o pagamento de ${kit.price} ${kit.currency} para liberar os arquivos.`,
    link: `/app/marketing/${kit.id}`,
  });
  return updated;
}

/** Wellmix confirma o recebimento (modo manual, com comprovante opcional). */
export async function confirmKitPayment(
  user: User,
  id: string,
  proof?: File | null,
) {
  assertWellmix(user);
  const store = getStore();
  const kit = await store.get("marketing_kits", id);
  if (!kit) throw new MarketingError("not_found");
  if (kit.status !== "purchased" || !kit.paymentId)
    throw new MarketingError("invalid_status");
  let proofDocumentId: string | null = null;
  if (proof && proof.size > 0) {
    const doc = await uploadDocument(user, proof, {
      type: "proof",
      visibility: "customer",
      kitId: kit.id,
    });
    proofDocumentId = doc.id;
  }
  const now = new Date().toISOString();
  await store.update("payments", kit.paymentId, {
    status: "received",
    confirmedByUserId: user.id,
    confirmedAt: now,
    ...(proofDocumentId ? { proofDocumentId } : {}),
  });
  const updated = await store.update("marketing_kits", id, {
    status: "paid",
    paidAt: now,
  });
  await audit(
    user,
    "kit.paid",
    "marketing_kit",
    id,
    `${kit.price} ${kit.currency}`,
  );
  return updated;
}

/** Liberação dos arquivos finais: só depois do pagamento e com ao menos um arquivo final. */
export async function releaseKit(user: User, id: string) {
  assertWellmix(user);
  const store = getStore();
  const kit = await store.get("marketing_kits", id);
  if (!kit) throw new MarketingError("not_found");
  if (kit.status !== "paid") throw new MarketingError("invalid_status");
  if (kit.releasedDocumentIds.length === 0)
    throw new MarketingError("no_final_files");
  const updated = await store.update("marketing_kits", id, {
    status: "released",
    releasedAt: new Date().toISOString(),
  });
  await audit(
    user,
    "kit.release",
    "marketing_kit",
    id,
    `${kit.releasedDocumentIds.length} arquivo(s)`,
  );
  if (kit.customerId)
    await notify(
      { role: "customer", partyId: kit.customerId },
      {
        subject: `Kit de marketing liberado: ${kit.name}`,
        body: "Os arquivos finais já estão disponíveis para download.",
        link: `/app/marketing/${kit.id}`,
      },
    );
  return updated;
}

/** Cancela (nada é apagado); não cancela kit pago ou liberado. */
export async function cancelKit(user: User, id: string, note?: string | null) {
  assertWellmix(user);
  const store = getStore();
  const kit = await store.get("marketing_kits", id);
  if (!kit) throw new MarketingError("not_found");
  if (["paid", "released"].includes(kit.status))
    throw new MarketingError("invalid_status");
  const updated = await store.update("marketing_kits", id, {
    status: "cancelled",
    notes: note ?? kit.notes,
  });
  await audit(user, "kit.cancel", "marketing_kit", id, note ?? "Cancelado");
  return updated;
}

export interface KitView {
  kit: MarketingKit;
  product: Product | null;
  customerName: string | null;
  previewDocs: Document[];
  releasedDocs: Document[];
  payment: Payment | null;
}

export async function loadKit(user: User, id: string): Promise<KitView | null> {
  const store = getStore();
  const kit = await store.get("marketing_kits", id);
  if (!kit || !canViewKit(user, kit)) return null;
  const ids = [...kit.previewDocumentIds, ...kit.releasedDocumentIds];
  const [product, customer, docs, payment] = await Promise.all([
    store.get("products", kit.productId),
    kit.customerId
      ? store.get("parties", kit.customerId)
      : Promise.resolve(null),
    ids.length
      ? store.list("documents", { filter: { id: ids } })
      : Promise.resolve([] as Document[]),
    kit.paymentId
      ? store.get("payments", kit.paymentId)
      : Promise.resolve(null),
  ]);
  const visible = (docId: string) => canViewKitDocument(user, kit, docId);
  return {
    kit,
    product,
    customerName: customer?.name ?? null,
    previewDocs: docs.filter(
      (d) => kit.previewDocumentIds.includes(d.id) && visible(d.id),
    ),
    releasedDocs: docs.filter(
      (d) => kit.releasedDocumentIds.includes(d.id) && visible(d.id),
    ),
    payment,
  };
}

/** Wellmix: todos (com filtros); cliente: os seus a partir da oferta. */
export async function listKits(
  user: User,
  filter: {
    productId?: string;
    customerId?: string;
    status?: MarketingKitStatus;
  } = {},
) {
  const store = getStore();
  const where: Record<string, string> = {};
  if (filter.productId) where.productId = filter.productId;
  if (filter.status) where.status = filter.status;
  if (isWellmix(user)) {
    if (filter.customerId) where.customerId = filter.customerId;
  } else if (user.role === "customer" && user.partyId) {
    where.customerId = user.partyId;
  } else {
    return [];
  }
  const kits = await store.list("marketing_kits", {
    filter: where,
    orderBy: "createdAt",
    direction: "desc",
  });
  return kits.filter((k) => canViewKit(user, k));
}

function pick<T extends object>(row: T, patch: Partial<T>) {
  const out: Partial<T> = {};
  for (const key of Object.keys(patch) as Array<keyof T>) out[key] = row[key];
  return out;
}
