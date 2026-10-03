import "server-only";

import {
  getStore,
  type Certification,
  type Document,
  type DocumentType,
  type ProductPhoto,
  type User,
  type Visibility,
} from "@/lib/db";
import {
  canViewOrder,
  canViewRequest,
  isWellmix,
} from "@/lib/auth/permissions";
import { audit } from "./audit";
import type { StoredFile } from "@/lib/db/store";
import { imageHashOf } from "./image-hash";

/** Teto por documento. Acima de ~4 MB o navegador envia direto ao armazenamento (`registerUploadedDocument`). */
export const MAX_DOCUMENT_BYTES = 50_000_000;
const MAX_BYTES = MAX_DOCUMENT_BYTES;
const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-excel",
  "text/csv",
  "application/zip",
  "application/octet-stream",
  "application/postscript",
  "image/svg+xml",
  // Arte da embalagem: Photoshop, Illustrator/EPS, CorelDRAW, TIFF.
  "image/vnd.adobe.photoshop",
  "application/x-photoshop",
  "application/illustrator",
  "application/cdr",
  "application/x-cdr",
  "image/x-cdr",
  "image/tiff",
];

export class DocumentError extends Error {}

export interface UploadInput {
  orderId?: string | null;
  requestId?: string | null;
  requirementId?: string | null;
  /** Fotos de produto e de sourcing (sem pedido nem solicitação). */
  productId?: string | null;
  sourcingItemId?: string | null;
  /** Arquivo de kit de marketing (prévia ou final). */
  kitId?: string | null;
  type: DocumentType;
  visibility?: Visibility;
}

/** Upload com versionamento: um novo arquivo para o mesmo requisito mantém o anterior. */
export async function uploadDocument(
  user: User,
  file: File,
  input: UploadInput,
): Promise<Document> {
  if (file.size === 0) throw new DocumentError("empty");
  if (file.size > MAX_BYTES) throw new DocumentError("too_large");
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.includes(mime)) throw new DocumentError("mime");

  const store = getStore();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await store.putFile(bytes, file.name, mime);
  return createDocumentRow(user, stored, input, bytes);
}

/**
 * Documento cujo arquivo o navegador já subiu direto ao armazenamento (token
 * de upload): o servidor só confere que existe, tamanho e tipo, e registra.
 * Assim arquivos grandes (arte da embalagem) não passam pelo limite do corpo
 * da requisição da Vercel.
 */
export async function registerUploadedDocument(
  user: User,
  fileKey: string,
  input: UploadInput,
): Promise<Document> {
  const store = getStore();
  const stored = await store.statFile(fileKey);
  if (!stored) throw new DocumentError("upload_missing");
  if (stored.size === 0) throw new DocumentError("empty");
  if (stored.size > MAX_BYTES) {
    await store.removeFile(fileKey);
    throw new DocumentError("too_large");
  }
  const mime = stored.mime || "application/octet-stream";
  if (!ALLOWED_MIME.includes(mime)) {
    await store.removeFile(fileKey);
    throw new DocumentError("mime");
  }
  const taken = await store.list("documents", {
    filter: { storageKey: fileKey },
    limit: 1,
  });
  if (taken.length) throw new DocumentError("upload_missing");
  return createDocumentRow(user, { ...stored, mime }, input, null);
}

async function createDocumentRow(
  user: User,
  stored: StoredFile,
  input: UploadInput,
  bytes: Uint8Array | null,
): Promise<Document> {
  const store = getStore();
  const { name, mime } = stored;
  let version = 1;
  let previousDocumentId: string | null = null;
  if (input.requirementId) {
    const previous = await store.list("documents", {
      filter: { requirementId: input.requirementId },
      orderBy: "version",
      direction: "desc",
      limit: 1,
    });
    if (previous[0]) {
      version = previous[0].version + 1;
      previousDocumentId = previous[0].id;
    }
  }
  const doc = await store.create("documents", {
    orderId: input.orderId ?? null,
    requestId: input.requestId ?? null,
    requirementId: input.requirementId ?? null,
    type: input.type,
    name,
    mime,
    size: stored.size,
    storageKey: stored.key,
    version,
    previousDocumentId,
    uploadedByUserId: user.id,
    visibility: input.visibility ?? defaultVisibility(input.type),
    productId: input.productId ?? null,
    sourcingItemId: input.sourcingItemId ?? null,
    kitId: input.kitId ?? null,
    // Fotos de catálogo já nascem com a impressão digital (busca por foto).
    imageHash:
      bytes &&
      mime.startsWith("image/") &&
      (input.productId || input.sourcingItemId)
        ? ((await imageHashOf(bytes)) ?? "-")
        : null,
  });
  await audit(
    user,
    "document.upload",
    "document",
    doc.id,
    `${doc.type}: ${doc.name} v${version}`,
  );
  return doc;
}

function defaultVisibility(type: DocumentType): Visibility {
  switch (type) {
    case "proof":
    case "customs":
      return "internal";
    case "bl":
    case "inspection":
    case "photo":
      return "all";
    case "manual":
    case "dieline":
    case "label":
    case "art":
      return "supplier";
    default:
      return "internal";
  }
}

/** Controle de acesso a arquivos: por pedido/solicitação e por visibilidade. */
export async function canAccessDocument(
  user: User,
  doc: Document,
): Promise<boolean> {
  if (isWellmix(user) || doc.uploadedByUserId === user.id) return true;
  const store = getStore();
  if (doc.kitId) {
    // Kit de marketing: prévia a partir da oferta, arquivo final só depois de liberado.
    const { canViewKitDocument } = await import("./marketing");
    const kit = await store.get("marketing_kits", doc.kitId);
    return !!kit && canViewKitDocument(user, kit, doc.id);
  }
  if (doc.orderId) {
    const order = await store.get("orders", doc.orderId);
    if (!order || !canViewOrder(user, order)) return false;
  } else if (doc.requestId) {
    const request = await store.get("requests", doc.requestId);
    if (!request || !canViewRequest(user, request)) return false;
  } else {
    // Certificado (compliance): o despachante abre qualquer um; o fornecedor, os
    // do próprio cadastro ou de produtos seus. Cliente não abre (isolamento).
    const [cert] = await store.list("certifications", {
      filter: { documentId: doc.id },
      limit: 1,
    });
    if (cert) return canViewCertificationDocument(user, cert);
    // Cliente: fotos do cadastro de um produto ativo do catálogo, as mesmas que a
    // nova solicitação mostra ao escolher o produto (ver catalogShowcasePhotos).
    if (
      doc.productId &&
      user.role === "customer" &&
      (await isCatalogShowcasePhoto(doc.productId, doc.id))
    )
      return true;
    // Foto de produto/sourcing: só a Wellmix, salvo quando marcada como pública ("all").
    if (doc.productId || doc.sourcingItemId)
      return doc.visibility === "all" && !!doc.productId;
    return false;
  }
  if (doc.visibility === "all") return true;
  if (doc.visibility === "internal") return false;
  if (doc.visibility === "customer") return user.role === "customer";
  if (doc.visibility === "supplier") return user.role !== "customer";
  return false;
}

/** Despachante: todos; fornecedor: só o próprio cadastro ou produtos dele. */
async function canViewCertificationDocument(
  user: User,
  cert: Certification,
): Promise<boolean> {
  if (user.role === "broker") return true;
  if (user.role !== "supplier" || !user.partyId) return false;
  if (cert.entity === "party") return cert.entityId === user.partyId;
  const product = await getStore().get("products", cert.entityId);
  return !!product && product.supplierId === user.partyId;
}

/** Máximo de fotos do cadastro mostradas por produto na solicitação. */
export const CATALOG_SHOWCASE_LIMIT = 8;
const SHOWCASE_ORDER: ProductPhoto["kind"][] = [
  "commercial",
  "original",
  "packaging",
  "other",
];

/**
 * Fotos do cadastro que acompanham um produto do catálogo na nova solicitação.
 * Principal primeiro, depois comercial, original, embalagem e o resto (medidas).
 * Uma original que ganhou versão comercial dá lugar a ela: assim a Wellmix
 * controla o que o cliente vê (ex.: esconder marca do fornecedor) sem apagar a
 * original, que segue como evidência.
 */
export async function catalogShowcasePhotos(
  productIds: string[],
): Promise<Map<string, ProductPhoto[]>> {
  const wanted = new Set(productIds);
  const result = new Map<string, ProductPhoto[]>();
  if (!wanted.size) return result;
  const photos = (await getStore().list("product_photos")).filter(
    (p) => p.productId && wanted.has(p.productId),
  );
  const replaced = new Set(
    photos
      .filter((p) => p.kind === "commercial" && p.derivedFromPhotoId)
      .map((p) => p.derivedFromPhotoId as string),
  );
  const rank = (p: ProductPhoto) => {
    const i = SHOWCASE_ORDER.indexOf(p.kind);
    return i === -1 ? SHOWCASE_ORDER.length : i;
  };
  for (const photo of photos) {
    if (replaced.has(photo.id)) continue;
    const list = result.get(photo.productId!) ?? [];
    list.push(photo);
    result.set(photo.productId!, list);
  }
  for (const [id, list] of result) {
    list.sort(
      (a, b) =>
        Number(b.isPrimary) - Number(a.isPrimary) ||
        rank(a) - rank(b) ||
        a.createdAt.localeCompare(b.createdAt),
    );
    result.set(id, list.slice(0, CATALOG_SHOWCASE_LIMIT));
  }
  return result;
}

/** O documento é uma das fotos mostradas de um produto ativo do catálogo? */
async function isCatalogShowcasePhoto(
  productId: string,
  documentId: string,
): Promise<boolean> {
  const product = await getStore().get("products", productId);
  if (!product?.active) return false;
  const photos = (await catalogShowcasePhotos([productId])).get(productId);
  return !!photos?.some((p) => p.documentId === documentId);
}
