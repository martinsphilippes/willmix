import "server-only";

import {
  getStore,
  type Order,
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
export const ALLOWED_MIME = [
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
  // XML da DI/DUIMP (embarque e desembaraço); baixa como anexo, nunca abre na página.
  "application/xml",
  "text/xml",
  "application/zip",
  // O mesmo .zip, como o Windows o identifica.
  "application/x-zip-compressed",
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

/**
 * Só no chat (anexo da conversa): Word, PowerPoint, texto, GIF e vídeo, que
 * fornecedores e clientes mandam no dia a dia. Os documentos do processo
 * (pedido, solicitação, cadastro) seguem só com os tipos de cima.
 */
export const CHAT_EXTRA_MIME = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
];

/** Tipos aceitos para o destino do arquivo (o chat aceita alguns a mais). */
function acceptsMime(
  mime: string,
  input?: Pick<UploadInput, "conversationTopicId" | "video">,
): boolean {
  const m = mime.toLowerCase();
  return (
    ALLOWED_MIME.includes(m) ||
    (!!input?.conversationTopicId && CHAT_EXTRA_MIME.includes(m)) ||
    (!!input?.video && m.startsWith("video/") && CHAT_EXTRA_MIME.includes(m))
  );
}

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
  /** Anexo do chat: o acesso segue o assunto da conversa. */
  conversationTopicId?: string | null;
  /** Arquivo da conversa de uma solicitação ao fornecedor: só a Wellmix e esse fornecedor. */
  supplierRequestId?: string | null;
  /** Aceita vídeo (amostragem da solicitação ao fornecedor). */
  video?: boolean;
  type: DocumentType;
  visibility?: Visibility;
}

/** Upload com versionamento: um novo arquivo para o mesmo requisito mantém o anterior. */
/** Mesma checagem do upload, sem gravar: para validar antes de criar o que o arquivo acompanha. */
export function assertUploadable(
  file: File,
  input?: Pick<UploadInput, "conversationTopicId" | "video">,
): void {
  if (file.size === 0) throw new DocumentError("empty");
  if (file.size > MAX_BYTES) throw new DocumentError("too_large");
  // Sem diferenciar maiúsculas: o navegador manda "macroEnabled" no .xlsm.
  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!acceptsMime(mime, input)) throw new DocumentError("mime");
}

export async function uploadDocument(
  user: User,
  file: File,
  input: UploadInput,
): Promise<Document> {
  assertUploadable(file, input);
  const mime = file.type || "application/octet-stream";

  const store = getStore();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await store.putFile(bytes, file.name, mime);
  return createDocumentRow(user, stored, input, bytes);
}

/** O arquivo (chave no armazenamento) já pertence a um documento registrado. */
export async function fileKeyTaken(fileKey: string): Promise<boolean> {
  const taken = await getStore().list("documents", {
    filter: { storageKey: fileKey },
    limit: 1,
  });
  return taken.length > 0;
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
  // Arquivo que já é de um documento: recusa antes de qualquer limpeza, para
  // nunca apagar o arquivo de um documento registrado.
  if (await fileKeyTaken(fileKey)) throw new DocumentError("upload_missing");
  if (stored.size === 0) throw new DocumentError("empty");
  if (stored.size > MAX_BYTES) {
    await store.removeFile(fileKey);
    throw new DocumentError("too_large");
  }
  const mime = stored.mime || "application/octet-stream";
  if (!acceptsMime(mime, input)) {
    await store.removeFile(fileKey);
    throw new DocumentError("mime");
  }
  return createDocumentRow(user, { ...stored, mime }, input, null);
}

/**
 * Foto que o navegador já subiu direto ao armazenamento (lote acima do teto
 * da requisição na Vercel): só imagem vira documento; o resto é apagado.
 */
export async function registerUploadedPhoto(
  user: User,
  fileKey: string,
  input: UploadInput,
): Promise<Document> {
  const stored = await getStore().statFile(fileKey);
  if (!stored) throw new DocumentError("upload_missing");
  if (await fileKeyTaken(fileKey)) throw new DocumentError("upload_missing");
  if (!(stored.mime ?? "").startsWith("image/")) {
    await getStore().removeFile(fileKey);
    throw new DocumentError("mime");
  }
  return registerUploadedDocument(user, fileKey, input);
}

/**
 * Arquivo que subiu para um requisito cujo envio foi recusado em seguida
 * (etapa fechada, pré-requisito pendente…): sai do pedido, para não ficar
 * como a versão mais nova do requisito. Só apaga o que este envio criou e se
 * o requisito não ficou apontando para ele.
 */
export async function discardRequirementUpload(
  requirementId: string,
  documentId: string,
): Promise<void> {
  const store = getStore();
  const [requirement, doc] = await Promise.all([
    store.get("requirements", requirementId),
    store.get("documents", documentId),
  ]);
  if (!doc || doc.requirementId !== requirementId) return;
  if (requirement?.documentId === documentId) return;
  await store.remove("documents", doc.id);
  // Arquivo só sai do armazenamento se nenhum outro documento aponta para ele.
  if (!(await fileKeyTaken(doc.storageKey)))
    await store.removeFile(doc.storageKey).catch((error: unknown) => {
      console.error("discardRequirementUpload: arquivo não apagado", error);
    });
}

/** Foto enviada no formulário (File) ou já subida direto (id no armazenamento). */
export type PhotoSource = File | string;

export async function storePhotoDocument(
  user: User,
  source: PhotoSource,
  input: UploadInput,
): Promise<Document> {
  return typeof source === "string"
    ? registerUploadedPhoto(user, source, input)
    : uploadDocument(user, source, input);
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
  // Cadeia de versões: por requisito do pedido.
  const chain = input.requirementId
    ? { requirementId: input.requirementId }
    : null;
  if (chain) {
    const previous = await store.list("documents", {
      filter: chain,
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
    ...(input.conversationTopicId
      ? { conversationTopicId: input.conversationTopicId }
      : {}),
    ...(input.supplierRequestId
      ? { supplierRequestId: input.supplierRequestId }
      : {}),
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
    case "print_ready":
    case "packaging_sample":
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
  if (doc.conversationTopicId) {
    // Anexo do chat: só quem vê o assunto (empresa da conversa e, no assunto
    // de solicitação/pedido, só quem vê a solicitação/o pedido).
    const { canOpenTopic } = await import("./messages");
    return canOpenTopic(user, doc.conversationTopicId);
  }
  if (doc.supplierRequestId) {
    // Arquivo da negociação de uma solicitação ao fornecedor: além da
    // Wellmix, só o fornecedor dela.
    const { canOpenRequestFile } =
      await import("./supplier-request-negotiation");
    return canOpenRequestFile(user, doc.supplierRequestId);
  }
  if (doc.kitId) {
    // Kit de marketing: prévia a partir da oferta, arquivo final só depois de liberado.
    const { canViewKitDocument } = await import("./marketing");
    const kit = await store.get("marketing_kits", doc.kitId);
    return !!kit && canViewKitDocument(user, kit, doc.id);
  }
  if (doc.type === "import_step") {
    // Embarque e desembaraço: só quem vê o passo (numerário e DI ficam com a
    // Wellmix e o comex; o fornecedor vê só a invoice e o BL, por exemplo).
    const { canAccessStepDocument } = await import("./import-flow");
    return canAccessStepDocument(user, doc.id);
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
    // Quem certifica (o despachante; a certificadora, papel sem uso): as
    // fotos de vitrine dos produtos dos pedidos em que está (precisa ver o
    // produto para gerar o selo de certificação; dono, 13/11/2026).
    if (
      doc.productId &&
      (user.role === "ocp" || user.role === "broker") &&
      !!user.partyId &&
      (await ocpHasOrderWithProduct(
        user.partyId,
        doc.productId,
        user.role === "broker" ? "brokerId" : "ocpId",
      )) &&
      (await isShowcaseDocument(doc.productId, doc.id))
    )
      return true;
    // Agência: as mesmas fotos de vitrine, só dos produtos de pedidos em que
    // ela é a agência (a arte precisa ver o produto).
    if (
      doc.productId &&
      user.role === "agency" &&
      !!user.partyId &&
      (await agencyHasOrderWithProduct(user.partyId, doc.productId)) &&
      (await isCatalogShowcasePhoto(doc.productId, doc.id))
    )
      return true;
    // Cartão do fabricante: além da Wellmix e de quem enviou, só o fornecedor
    // dono do cartão (o que veio na planilha do Booking foi guardado pela
    // Wellmix). Outro fornecedor e o cliente nunca.
    if (user.role === "supplier" && user.partyId) {
      const [ownCard] = await store.list("manufacturer_cards", {
        filter: { documentId: doc.id, supplierId: user.partyId },
        limit: 1,
      });
      if (ownCard) return true;
      // Foto do item de um booking numa solicitação a ele (docs/SUPPLIER_REQUESTS.md).
      const { supplierSeesRequestPhoto } = await import("./supplier-requests");
      if (await supplierSeesRequestPhoto(user, doc.id)) return true;
      // Convite para booking concorrente: o convidado vê a foto do item.
      const { partnerSeesInvitePhoto } = await import("./booking-invites");
      if (await partnerSeesInvitePhoto(user, doc.id)) return true;
    }
    // Foto de produto/sourcing: só a Wellmix, salvo quando marcada como pública ("all").
    if (doc.productId || doc.sourcingItemId) {
      if (doc.visibility !== "all" || !doc.productId) return false;
      // Produto ainda escondido pelo Booking (não aprovado): nem o arquivo
      // "público" abre para quem não é Wellmix. Só o fornecedor do próprio
      // produto continua abrindo, como antes.
      const { isHiddenByBooking } = await import("./booking-visibility");
      if (!(await isHiddenByBooking(doc.productId))) return true;
      return isSupplierOfProduct(user, doc.productId);
    }
    return false;
  }
  if (doc.visibility === "all") return true;
  if (doc.visibility === "internal") return false;
  if (doc.visibility === "customer") return user.role === "customer";
  if (doc.visibility === "supplier") return user.role !== "customer";
  return false;
}

/**
 * Despachante: todos; fornecedor: só o próprio cadastro ou produtos dele;
 * certificadora (OCP): os do produto e do fornecedor dos pedidos em que está.
 */
async function canViewCertificationDocument(
  user: User,
  cert: Certification,
): Promise<boolean> {
  if (user.role === "broker") return true;
  if (user.role === "ocp" && user.partyId) {
    if (cert.entity === "product")
      return ocpHasOrderWithProduct(user.partyId, cert.entityId);
    return (await ocpOrders(user.partyId)).some(
      (o) => o.supplierId === cert.entityId,
    );
  }
  if (user.role !== "supplier" || !user.partyId) return false;
  if (cert.entity === "party") return cert.entityId === user.partyId;
  const product = await getStore().get("products", cert.entityId);
  return !!product && product.supplierId === user.partyId;
}

/** Fornecedor do produto: o principal do cadastro ou um dos ligados a ele. */
async function isSupplierOfProduct(
  user: User,
  productId: string,
): Promise<boolean> {
  if (user.role !== "supplier" || !user.partyId) return false;
  const product = await getStore().get("products", productId);
  if (!product) return false;
  if (product.supplierId === user.partyId) return true;
  const { productSupplierLink } = await import("./product-suppliers");
  return !!(await productSupplierLink(productId, user.partyId));
}

/** Tipos de foto do cadastro que o cliente nunca vê no catálogo. */
const CATALOG_HIDDEN_KINDS: ProductPhoto["kind"][] = [
  "business_card",
  "prompt",
];

/**
 * Fotos reais (agência na China, aprovadas pelo marketing; docs/SAMPLE_FLOW.md):
 * quando o produto tem, a vitrine mostra só elas. As de referência (IA,
 * fornecedor, originais) ficam guardadas no cadastro, fora da vitrine.
 */
export function realFirst<T extends Pick<ProductPhoto, "kind">>(
  photos: T[],
): T[] {
  return photos.some((p) => p.kind === "real")
    ? photos.filter((p) => p.kind === "real")
    : photos;
}

/** Máximo de fotos do cadastro mostradas por produto na solicitação. */
export const CATALOG_SHOWCASE_LIMIT = 8;
const SHOWCASE_ORDER: ProductPhoto["kind"][] = [
  "commercial",
  "original",
  "supplier",
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
  // Cartão do fornecedor/fabricante e foto de referência (prompt) nunca vão
  // ao cliente: o cartão diz quem fabrica (o cliente iria direto à fábrica).
  const photos = (await getStore().list("product_photos")).filter(
    (p) =>
      p.productId &&
      wanted.has(p.productId) &&
      !CATALOG_HIDDEN_KINDS.includes(p.kind),
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
  for (const [id, all] of result) {
    const list = realFirst(all);
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

/**
 * O documento é uma foto do cadastro de um produto ativo do catálogo que o
 * cliente pode ver? Qualquer tipo que não seja escondido (cartão, prompt)
 * conta, mesmo além das 8 da vitrine (ex.: a foto de cada variação); a
 * original que ganhou versão comercial continua fechada (a comercial é o
 * que a Wellmix quer mostrar). Produto ainda escondido pelo Booking (não
 * aprovado) não tem foto de vitrine: fica fechado como o inativo.
 */
async function isCatalogShowcasePhoto(
  productId: string,
  documentId: string,
): Promise<boolean> {
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product?.active) return false;
  const { isHiddenByBooking } = await import("./booking-visibility");
  if (await isHiddenByBooking(productId)) return false;
  const photos = await store.list("product_photos", { filter: { productId } });
  const replaced = new Set(
    photos
      .filter((p) => p.kind === "commercial" && p.derivedFromPhotoId)
      .map((p) => p.derivedFromPhotoId as string),
  );
  return realFirst(
    photos.filter(
      (p) => !CATALOG_HIDDEN_KINDS.includes(p.kind) && !replaced.has(p.id),
    ),
  ).some((p) => p.documentId === documentId);
}

/** A agência é a do pedido de algum pedido com este produto? */
async function agencyHasOrderWithProduct(
  agencyId: string,
  productId: string,
): Promise<boolean> {
  const store = getStore();
  const orders = (await store.list("orders", { filter: { agencyId } })).filter(
    (o) => o.status !== "CANCELLED",
  );
  if (!orders.length) return false;
  const items = await store.list("order_items", {
    filter: { orderId: orders.map((o) => o.id), productId },
    limit: 1,
  });
  return items.length > 0;
}

/*
 * Certificadora (OCP): precisa do pedido completo para gerar o selo de
 * certificação (docs/CERTIFICATION.md). Abre as fotos de vitrine dos
 * produtos e os certificados do produto e do fornecedor dos pedidos em que
 * está. As regras ficam aqui embaixo, separadas das da vitrine do cliente.
 */

/**
 * Das fotos (do cadastro ou da ficha do pedido), as de vitrine: sem o cartão
 * do fornecedor/fabricante e a foto de referência, e sem a original que
 * ganhou versão comercial (a comercial é o que a Wellmix quer mostrar).
 */
export function showcaseOf(photos: ProductPhoto[]): ProductPhoto[] {
  const replaced = new Set(
    photos
      .filter((p) => p.kind === "commercial" && p.derivedFromPhotoId)
      .map((p) => p.derivedFromPhotoId as string),
  );
  return realFirst(
    photos.filter(
      (p) => !CATALOG_HIDDEN_KINDS.includes(p.kind) && !replaced.has(p.id),
    ),
  );
}

/** O documento é uma foto de vitrine deste produto (ativo ou não)? */
async function isShowcaseDocument(
  productId: string,
  documentId: string,
): Promise<boolean> {
  const photos = await getStore().list("product_photos", {
    filter: { productId },
  });
  return showcaseOf(photos).some((p) => p.documentId === documentId);
}

/** Pedidos (não cancelados) em que a empresa certifica (OCP ou despachante). */
async function ocpOrders(
  partyId: string,
  field: "ocpId" | "brokerId" = "ocpId",
): Promise<Order[]> {
  const orders = await getStore().list("orders", {
    filter: { [field]: partyId },
  });
  return orders.filter((o) => o.status !== "CANCELLED");
}

/** O produto está em algum pedido em que a empresa certifica? */
async function ocpHasOrderWithProduct(
  partyId: string,
  productId: string,
  field: "ocpId" | "brokerId" = "ocpId",
): Promise<boolean> {
  const orders = await ocpOrders(partyId, field);
  if (!orders.length) return false;
  const items = await getStore().list("order_items", {
    filter: { orderId: orders.map((o) => o.id), productId },
    limit: 1,
  });
  return items.length > 0;
}
