import "server-only";

import {
  getStore,
  type AiSource,
  type LookupField,
  type LookupMatch,
  type LookupOption,
  type Product,
  type ProductLookup,
  type User,
} from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import {
  aiErrorCode,
  getAiAdapter,
  type AiAdapter,
  type AiImage,
} from "@/lib/integrations/ai";
import {
  fetchLinkPreview,
  type LinkPreview,
} from "@/lib/integrations/link-preview";
import { buildPrompt } from "@/lib/ai/prompts";
import { keywordMatches, NCM_HINTS } from "./taxes";
import { audit } from "./audit";
import { uploadDocument } from "./documents";
import {
  hashDistance,
  imageHashOf,
  SAME_PHOTO_MAX_DISTANCE,
  usableHash,
} from "./image-hash";

/**
 * Busca de produto por foto ou link (nova solicitação).
 * 1) Catálogo: a mesma foto (impressão digital visual), a imagem do link, o
 *    nome do link parecido com o nome/SKU do produto e, com IA, o produto
 *    reconhecido pela IA na lista do catálogo.
 * 2) Sem produto (ou além dele): várias sugestões por campo, cada uma com a
 *    origem (link, catálogo, IA). Nenhuma é aplicada sozinha: a pessoa escolhe
 *    uma, edita ou não escolhe nenhuma.
 * Sem chave de IA, a busca por foto só reconhece fotos iguais ou muito
 * parecidas às cadastradas (dito na tela).
 */
export class LookupError extends Error {}

const MAX_OPTIONS = 5;
const MAX_MATCHES = 10;
/** Motivos de "é o mesmo produto"; os demais (categoria, palavra) são só relacionados. */
export const STRONG_REASONS = new Set(["photo", "link_photo", "name", "ai"]);
const MAX_HASH_BACKFILL = 200;
/** Produtos com foto enviados à IA para comparação visual (até 2 fotos cada). */
const MAX_VISUAL_PRODUCTS = 20;
/** Fotos que mostram o produto (as de medida/balança costumam mostrar só um detalhe). */
const VISUAL_KINDS = new Set(["original", "commercial", "packaging", "other"]);

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const STOPWORDS = new Set(
  "de da do das dos com para por sem em no na nos nas um uma e o a os as the and for with of in on to new novo nova original kit pcs pecas peca unid unidade un und frete gratis promocao oferta atacado".split(
    " ",
  ),
);

/** Palavras significativas (≥3 letras ou com número). */
export function tokens(text: string | null | undefined): string[] {
  if (!text) return [];
  return [
    ...new Set(
      fold(text)
        .split(/[^a-z0-9]+/)
        .filter((w) => (w.length >= 3 || /\d/.test(w)) && !STOPWORDS.has(w)),
    ),
  ];
}

/** Palavras que não dizem o que o produto é (cores, tamanhos, genéricas de anúncio). */
const WEAK_WORDS = new Set(
  "preto preta branco branca azul vermelho vermelha verde amarelo amarela rosa cinza prata dourado dourada marrom bege roxo laranja black white blue red green pink gray grey silver gold pequeno pequena medio media grande mini maxi pro max plus ultra lite premium qualidade envio imediato pronta entrega lancamento barato promocao unidade unidades pecas modelo teste".split(
    " ",
  ),
);

/** Palavras significativas em comum entre o produto e o link (nome, categoria, material). */
export function commonWords(product: Product, text: string): string[] {
  // Singular simples: "panelas" = "panela", "celulares" = "celular".
  const stem = (w: string) => (w.length > 4 ? w.replace(/(es|s)$/, "") : w);
  const link = new Set(
    tokens(text)
      .filter((w) => !WEAK_WORDS.has(w))
      .map(stem),
  );
  return tokens(
    `${product.name} ${product.category ?? ""} ${product.material ?? ""}`,
  ).filter((w) => w.length >= 4 && !WEAK_WORDS.has(w) && link.has(stem(w)));
}

/**
 * Famílias de produto (posições da tabela de NCM) que o texto menciona. Dois
 * textos na mesma família são relacionados: "iPhone 15" e "Celular" caem em
 * smartphones; "capa MagSafe" e "capinha" em capas.
 */
export function productFamilies(text: string): Set<string> {
  const folded = fold(text);
  const out = new Set<string>();
  for (const hint of NCM_HINTS)
    if (hint.keywords.some((k) => keywordMatches(folded, k))) out.add(hint.ncm);
  return out;
}

/** Quanto do nome do produto aparece no texto do link (0–1). SKU exato vale 1. */
export function nameScore(product: Product, text: string): number {
  const linkTokens = new Set(tokens(text));
  if (linkTokens.size === 0) return 0;
  for (const sku of [product.sku, product.supplierSku])
    if (
      sku &&
      tokens(sku).length &&
      tokens(sku).every((t) => linkTokens.has(t))
    )
      return 1;
  const own = tokens(`${product.name} ${product.category ?? ""}`);
  if (own.length === 0) return 0;
  const common = own.filter((t) => linkTokens.has(t)).length;
  if (common < 2 && !(common === 1 && own.length === 1)) return 0;
  return common / own.length;
}

/** Hash das fotos do catálogo (calcula e guarda as que faltam). */
async function catalogPhotoHashes(products: Product[]) {
  const store = getStore();
  const active = new Set(products.map((p) => p.id));
  const photos = (await store.list("product_photos")).filter(
    (p) => p.productId && active.has(p.productId),
  );
  const byDoc = new Map<string, string>();
  for (const p of photos) byDoc.set(p.documentId, p.productId!);
  for (const p of products)
    if (p.primaryPhotoDocumentId) byDoc.set(p.primaryPhotoDocumentId, p.id);
  const ids = [...byDoc.keys()];
  const docs = [];
  for (let i = 0; i < ids.length; i += 100)
    docs.push(
      ...(await store.list("documents", {
        filter: { id: ids.slice(i, i + 100) },
      })),
    );
  const out: Array<{ productId: string; hash: string }> = [];
  let computed = 0;
  for (const doc of docs) {
    let hash = doc.imageHash;
    if (
      !hash &&
      doc.mime.startsWith("image/") &&
      computed < MAX_HASH_BACKFILL
    ) {
      computed++;
      const file = await store.getFile(doc.storageKey);
      hash = (file ? await imageHashOf(file.bytes) : null) ?? "-";
      await store.update("documents", doc.id, { imageHash: hash });
    }
    if (usableHash(hash)) out.push({ productId: byDoc.get(doc.id)!, hash });
  }
  return out;
}

function addMatch(
  matches: Map<string, LookupMatch>,
  productId: string,
  score: number,
  reason: LookupMatch["reasons"][number],
) {
  const m = matches.get(productId) ?? { productId, score: 0, reasons: [] };
  m.score = Math.max(m.score, score);
  if (!m.reasons.includes(reason)) m.reasons.push(reason);
  matches.set(productId, m);
}

function photoMatches(
  matches: Map<string, LookupMatch>,
  hash: string | null,
  catalog: Array<{ productId: string; hash: string }>,
  reason: "photo" | "link_photo",
) {
  if (!usableHash(hash)) return;
  for (const c of catalog) {
    const d = hashDistance(hash, c.hash);
    if (d <= SAME_PHOTO_MAX_DISTANCE)
      addMatch(matches, c.productId, 1 - d / 64, reason);
  }
}

/** Especificação legível a partir de um produto do catálogo (sem preço nem fornecedor). */
function productSpec(p: Product): string | null {
  const dims =
    p.lengthCm !== null && p.widthCm !== null && p.heightCm !== null
      ? `${p.lengthCm} × ${p.widthCm} × ${p.heightCm} cm`
      : null;
  const parts = [
    p.material ? `Material: ${p.material}` : null,
    p.color ? `Cor: ${p.color}` : null,
    p.pantone ? `Pantone: ${p.pantone}` : null,
    dims ? `Dimensões: ${dims}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join("; ") : null;
}

/** Título do link sem o nome da loja ("Produto X | Loja" → "Produto X"). */
function stripSite(title: string) {
  const first = title.split(/\s+[|–—]\s+|\s+-\s+(?=[^-]+$)/)[0]?.trim();
  return first && first.length >= 3 ? first : title;
}

function pushOption(
  list: LookupOption[],
  value: string | null | undefined,
  source: LookupOption["source"],
  max = 400,
) {
  const v = value?.replace(/\s+/g, " ").trim().slice(0, max);
  if (!v || v.length < 2) return;
  if (list.some((o) => fold(o.value) === fold(v))) return;
  if (list.length < MAX_OPTIONS) list.push({ value: v, source });
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Reduz a imagem para enviar à IA (menos dados, mesma informação visual). */
async function thumbnail(
  bytes: Uint8Array,
  size: number,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(Buffer.from(bytes))
      .rotate()
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
    return { bytes: new Uint8Array(out), mime: "image/jpeg" };
  } catch {
    return null;
  }
}

/**
 * Fotos do catálogo para a IA comparar com a do cliente: por produto, a foto
 * principal e mais uma que mostre o produto, rotuladas com o id. Produtos já
 * indicados (nome/foto igual) entram primeiro; depois os mais recentes.
 */
async function catalogImagesForAi(
  products: Product[],
  first: Set<string>,
): Promise<AiImage[]> {
  const store = getStore();
  const photos = await store.list("product_photos");
  const perProduct = new Map<string, string[]>();
  for (const p of products) {
    const ids: string[] = [];
    if (p.primaryPhotoDocumentId) ids.push(p.primaryPhotoDocumentId);
    for (const ph of photos
      .filter((ph) => ph.productId === p.id && VISUAL_KINDS.has(ph.kind))
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)))
      if (!ids.includes(ph.documentId)) ids.push(ph.documentId);
    if (ids.length) perProduct.set(p.id, ids.slice(0, 2));
  }
  const ordered = products
    .filter((p) => perProduct.has(p.id))
    .sort(
      (a, b) =>
        Number(first.has(b.id)) - Number(first.has(a.id)) ||
        b.updatedAt.localeCompare(a.updatedAt),
    )
    .slice(0, MAX_VISUAL_PRODUCTS);
  const images: AiImage[] = [];
  for (const p of ordered) {
    for (const docId of perProduct.get(p.id)!) {
      const doc = await store.get("documents", docId);
      if (!doc || !doc.mime.startsWith("image/")) continue;
      const file = await store.getFile(doc.storageKey);
      const small = file ? await thumbnail(file.bytes, 384) : null;
      if (small)
        images.push({
          ...small,
          label: `CATÁLOGO id=${p.id} · ${p.name}${p.category ? ` (${p.category})` : ""}`,
        });
    }
  }
  return images;
}

export interface LookupInput {
  file?: File | null;
  url?: string | null;
  customerId?: string | null;
}

export async function runProductLookup(
  user: User,
  input: LookupInput,
  deps: {
    fetchPreview?: (url: string) => Promise<LinkPreview>;
    aiAdapter?: AiAdapter;
  } = {},
): Promise<ProductLookup> {
  if (!(isWellmix(user) || user.role === "customer"))
    throw new LookupError("forbidden");
  // Recurso pausado nas configurações (tokens externos aguardam cartão).
  if ((await getSettings()).lookupPaused)
    throw new LookupError("lookup_paused");
  const file = input.file && input.file.size > 0 ? input.file : null;
  const url = input.url?.trim() || null;
  if (!file && !url) throw new LookupError("lookup_empty");
  if (url && url.length > 2000) throw new LookupError("lookup_invalid_url");
  if (file && !file.type.startsWith("image/"))
    throw new LookupError("lookup_not_image");
  const store = getStore();
  const customerId =
    user.role === "customer" ? user.partyId : (input.customerId ?? null);

  // Foto enviada: guardada (vira anexo da solicitação) e com impressão digital.
  let imageDocumentId: string | null = null;
  let imageHash: string | null = null;
  let aiImage: AiImage | null = null;
  if (file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await uploadDocument(user, file, {
      type: "attachment",
      visibility: "internal",
    });
    imageDocumentId = doc.id;
    imageHash = await imageHashOf(bytes);
    await store.update("documents", doc.id, { imageHash: imageHash ?? "-" });
    aiImage = { bytes, mime: file.type };
  }

  const preview = url
    ? await (deps.fetchPreview ?? fetchLinkPreview)(url)
    : null;
  const linkImageHash = preview?.image
    ? await imageHashOf(preview.image.bytes)
    : null;
  if (!aiImage && preview?.image)
    aiImage = { bytes: preview.image.bytes, mime: preview.image.mime };

  // 1) Catálogo.
  const products = await store.list("products", { filter: { active: true } });
  const catalog = await catalogPhotoHashes(products);
  const matches = new Map<string, LookupMatch>();
  photoMatches(matches, imageHash, catalog, "photo");
  photoMatches(matches, linkImageHash, catalog, "link_photo");
  const linkText = [
    preview?.title,
    preview?.product.name,
    preview?.product.sku,
    preview?.product.model,
  ]
    .filter(Boolean)
    .join(" ");
  if (linkText)
    for (const p of products) {
      const score = nameScore(p, linkText);
      if (score >= 0.5) addMatch(matches, p.id, 0.4 + score * 0.4, "name");
    }
  // Relacionados: mesma família de produto (ex.: iPhone ↔ Celular) ou palavra significativa em comum.
  const familyText = [
    linkText,
    preview?.category,
    preview?.product.brand,
    preview?.product.material,
    preview?.description,
  ]
    .filter(Boolean)
    .join(" ");
  if (familyText) {
    const linkFamilies = productFamilies(familyText);
    for (const p of products) {
      const own = productFamilies(
        [p.name, p.category, p.material, p.specification]
          .filter(Boolean)
          .join(" "),
      );
      if ([...own].some((f) => linkFamilies.has(f)))
        addMatch(matches, p.id, 0.35, "category");
      const words = commonWords(p, familyText);
      if (words.length)
        addMatch(
          matches,
          p.id,
          Math.min(0.3, 0.15 + words.length * 0.05),
          "word",
        );
    }
  }

  // 2) IA (API ou mock rotulado; manual = sem IA).
  const suggestions: Record<LookupField, LookupOption[]> = {
    productName: [],
    description: [],
    specification: [],
  };
  let aiSource: AiSource | null = null;
  let aiError: string | null = null;
  const adapter = deps.aiAdapter ?? getAiAdapter(await getSettings());
  let ai: Record<string, unknown> | null = null;
  if (adapter.mode !== "manual" && (aiImage || preview?.status === "ok")) {
    const context = [
      preview?.status === "ok"
        ? `LINK: ${[preview.title, preview.category, preview.description, preview.product.brand, preview.product.model, preview.product.material, preview.product.color, preview.product.size].filter(Boolean).join(" · ")}`
        : null,
      `CATÁLOGO (id | nome):\n${products
        .slice(0, 150)
        .map(
          (p) => `${p.id} | ${p.name}${p.category ? ` (${p.category})` : ""}`,
        )
        .join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      // Comparação visual de verdade: a foto do cliente + as fotos do catálogo.
      const query = aiImage ? await thumbnail(aiImage.bytes, 768) : null;
      const images: AiImage[] = [];
      if (query) images.push({ ...query, label: "FOTO DO CLIENTE:" });
      if (query && adapter.mode === "api")
        images.push(
          ...(await catalogImagesForAi(products, new Set(matches.keys()))),
        );
      const result = await adapter.complete(
        buildPrompt("lookup", { context }),
        images,
      );
      ai = result?.json ?? null;
      aiSource = adapter.mode;
    } catch (error) {
      aiError = aiErrorCode(error);
      console.error("lookup ai failed", aiError, error);
      ai = null;
    }
  }
  const aiTag = adapter.mode === "mock" ? "mock" : "ai";
  if (ai) {
    const ids = new Set(products.map((p) => p.id));
    for (const m of Array.isArray(ai.catalogMatches) ? ai.catalogMatches : []) {
      const { id, confidence } = (m ?? {}) as {
        id?: unknown;
        confidence?: unknown;
      };
      // "low" = só a categoria parece: não vira correspondência.
      if (typeof id !== "string" || !ids.has(id) || confidence === "low")
        continue;
      addMatch(matches, id, confidence === "high" ? 0.9 : 0.75, "ai");
    }
  }

  const ranked = [...matches.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES)
    .map((m) => ({ ...m, score: Math.round(m.score * 100) / 100 }));
  // Sugestões de preenchimento só dos que parecem ser o mesmo produto (não dos relacionados).
  const matchedProducts = ranked
    .filter((m) => m.reasons.some((r) => STRONG_REASONS.has(r)))
    .map((m) => products.find((p) => p.id === m.productId))
    .filter((p): p is Product => !!p);

  // 3) Sugestões por campo: link → catálogo → IA.
  if (preview?.status === "ok") {
    pushOption(suggestions.productName, preview.product.name, "link", 160);
    if (preview.title) {
      pushOption(
        suggestions.productName,
        stripSite(preview.title),
        "link",
        160,
      );
      pushOption(suggestions.productName, preview.title, "link", 160);
    }
    pushOption(suggestions.description, preview.product.description, "link");
    pushOption(suggestions.description, preview.description, "link");
    const spec = [
      preview.product.material ? `Material: ${preview.product.material}` : null,
      preview.product.color ? `Cor: ${preview.product.color}` : null,
      preview.product.size ? `Tamanho: ${preview.product.size}` : null,
      preview.product.brand ? `Marca: ${preview.product.brand}` : null,
      preview.product.model ? `Modelo: ${preview.product.model}` : null,
    ]
      .filter(Boolean)
      .join("; ");
    pushOption(suggestions.specification, spec, "link");
  }
  for (const p of matchedProducts) {
    pushOption(suggestions.productName, p.name, "catalog", 160);
    pushOption(suggestions.specification, productSpec(p), "catalog");
    pushOption(suggestions.description, p.specification, "catalog");
  }
  if (ai) {
    for (const v of strings(ai.productName))
      pushOption(suggestions.productName, v, aiTag, 160);
    for (const v of strings(ai.description))
      pushOption(suggestions.description, v, aiTag);
    for (const v of strings(ai.specification))
      pushOption(suggestions.specification, v, aiTag);
  }

  const row = await store.create("product_lookups", {
    userId: user.id,
    customerId,
    imageDocumentId,
    url,
    linkStatus: preview?.status ?? null,
    linkTitle: preview?.title?.slice(0, 500) ?? null,
    linkSiteName: preview?.siteName ?? null,
    linkImageUrl: preview?.imageUrl ?? null,
    linkPrice: preview?.price ?? null,
    imageHash,
    linkImageHash,
    matches: ranked,
    suggestions,
    aiSource,
    aiError,
    requestId: null,
  });
  await audit(
    user,
    "lookup.run",
    "product_lookup",
    row.id,
    `${file ? "foto" : ""}${file && url ? " + " : ""}${url ? "link" : ""}: ${ranked.length} produto(s) do catálogo`,
  );
  return row;
}

/** Só quem fez a busca (ou a Wellmix) a vê. */
export async function getLookup(user: User, id: string) {
  const row = await getStore().get("product_lookups", id);
  if (!row) return null;
  return row.userId === user.id || isWellmix(user) ? row : null;
}

/** Ao criar a solicitação: a foto vira anexo dela e a busca fica ligada. */
export async function attachLookupToRequest(
  user: User,
  lookupId: string,
  requestId: string,
) {
  const store = getStore();
  const row = await getLookup(user, lookupId);
  if (!row || row.requestId) return;
  if (row.imageDocumentId)
    await store.update("documents", row.imageDocumentId, { requestId });
  await store.update("product_lookups", row.id, { requestId });
}
