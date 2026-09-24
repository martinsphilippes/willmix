import "server-only";

import {
  getStore,
  type Document,
  type DocumentType,
  type User,
  type Visibility,
} from "@/lib/db";
import {
  canViewOrder,
  canViewRequest,
  isWillmix,
} from "@/lib/auth/permissions";
import { audit } from "./audit";

const MAX_BYTES = 30 * 1024 * 1024;
const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/zip",
  "application/octet-stream",
  "application/postscript",
  "image/svg+xml",
];

export class DocumentError extends Error {}

export interface UploadInput {
  orderId?: string | null;
  requestId?: string | null;
  requirementId?: string | null;
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
    name: file.name,
    mime,
    size: file.size,
    storageKey: stored.key,
    version,
    previousDocumentId,
    uploadedByUserId: user.id,
    visibility: input.visibility ?? defaultVisibility(input.type),
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
  if (isWillmix(user) || doc.uploadedByUserId === user.id) return true;
  const store = getStore();
  if (doc.orderId) {
    const order = await store.get("orders", doc.orderId);
    if (!order || !canViewOrder(user, order)) return false;
  } else if (doc.requestId) {
    const request = await store.get("requests", doc.requestId);
    if (!request || !canViewRequest(user, request)) return false;
  } else {
    return false;
  }
  if (doc.visibility === "all") return true;
  if (doc.visibility === "internal") return false;
  if (doc.visibility === "customer") return user.role === "customer";
  if (doc.visibility === "supplier") return user.role !== "customer";
  return false;
}
