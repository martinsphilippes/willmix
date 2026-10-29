import "server-only";

import {
  getStore,
  type ArtIssue,
  type Document,
  type Order,
  type OrderItem,
  type User,
} from "@/lib/db";
import {
  ForbiddenError,
  canViewOrder,
  isAdmin,
  isWellmix,
} from "@/lib/auth/permissions";
import { audit } from "./audit";
import { canAccessDocument } from "./documents";
import { notify, type NotifyTarget } from "./notifications";
import { isSchemaMissing } from "./packaging-brief";

/*
 * Marketing das artes do pedido (Fase F, docs/ARTWORK.md):
 * - designer do pedido: alguém da Wellmix com a função "designer" ou um
 *   login da agência do pedido;
 * - não conformidade da arte por SKU: a Wellmix aponta (com motivo e,
 *   se quiser, arquivo), o designer corrige, a Wellmix aceita ou reabre;
 * - baixar todas as artes do pedido de uma vez (zip), só o que o usuário
 *   pode abrir.
 */

export class ArtworkError extends Error {}

/** Tipos de documento que são arte/embalagem. */
export const ART_DOC_TYPES = [
  "art",
  "print_ready",
  "dieline",
  "label",
  "packaging_sample",
] as const;

/** Quem pode ser designer do pedido. */
export async function designerCandidates(order: Order): Promise<User[]> {
  const store = getStore();
  const [team, agency] = await Promise.all([
    store.list("users", {
      filter: { role: ["admin", "operator"], active: true },
    }),
    order.agencyId
      ? store.list("users", {
          filter: { role: "agency", partyId: order.agencyId, active: true },
        })
      : Promise.resolve([] as User[]),
  ]);
  return [
    ...team.filter((u) => (u.functions ?? []).includes("designer")),
    ...agency,
  ];
}

/** Designer (ou a agência do pedido, ou a Wellmix) corrige a arte. */
export function canFixArt(user: User, order: Order): boolean {
  if (isWellmix(user)) return true;
  if (order.designerUserId && order.designerUserId === user.id) return true;
  return (
    user.role === "agency" && !!user.partyId && order.agencyId === user.partyId
  );
}

async function loadOrder(orderId: string) {
  const order = await getStore().get("orders", orderId);
  if (!order) throw new ArtworkError("order_not_found");
  if (order.status === "CANCELLED") throw new ArtworkError("order_cancelled");
  return order;
}

/** Wellmix escolhe o designer do pedido (ou tira). */
export async function assignDesigner(
  user: User,
  orderId: string,
  designerUserId: string | null,
) {
  if (!isWellmix(user)) throw new ForbiddenError();
  const order = await loadOrder(orderId);
  if (designerUserId) {
    const ok = (await designerCandidates(order)).some(
      (u) => u.id === designerUserId,
    );
    if (!ok) throw new ArtworkError("invalid_designer");
  }
  const updated = await getStore().update("orders", orderId, {
    designerUserId,
  });
  const designer = designerUserId
    ? await getStore().get("users", designerUserId)
    : null;
  await audit(
    user,
    "artwork.designer",
    "order",
    orderId,
    designer ? `Designer: ${designer.name}` : "Designer removido",
  );
  if (designer)
    await notify(
      { userIds: [designer.id] },
      {
        link: `/app/orders/${orderId}#artwork`,
        kind: "action",
        text: (t) => ({
          subject: t("artwork.notify.assigned.subject", {
            n: String(order.number),
          }),
          body: t("artwork.notify.assigned.body"),
        }),
      },
    );
  return updated;
}

/** Para quem vão os avisos ao designer. */
async function designerTarget(order: Order): Promise<NotifyTarget> {
  if (order.designerUserId) return { userIds: [order.designerUserId] };
  if (order.agencyId) return { role: "agency", partyId: order.agencyId };
  const team = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const designers = team.filter((u) =>
    (u.functions ?? []).includes("designer"),
  );
  return {
    userIds: (designers.length ? designers : team.filter(isAdmin)).map(
      (u) => u.id,
    ),
  };
}

async function issuesOf(orderId: string): Promise<ArtIssue[]> {
  try {
    return await getStore().list("art_issues", { filter: { orderId } });
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

/** Wellmix aponta uma não conformidade na arte de um SKU. */
export async function reportArtIssue(
  user: User,
  orderId: string,
  input: { orderItemId: string; note: string; documentId?: string | null },
) {
  if (!isWellmix(user)) throw new ForbiddenError();
  const order = await loadOrder(orderId);
  const store = getStore();
  const item = await store.get("order_items", input.orderItemId);
  if (!item || item.orderId !== orderId)
    throw new ArtworkError("item_not_found");
  const note = input.note.trim();
  if (!note) throw new ArtworkError("note_required");
  const issue = await store.create("art_issues", {
    orderId,
    orderItemId: item.id,
    status: "open",
    note,
    documentId: input.documentId ?? null,
    reportedByUserId: user.id,
    fixNote: null,
    fixDocumentId: null,
    fixedByUserId: null,
    fixedAt: null,
    acceptedByUserId: null,
    acceptedAt: null,
  });
  await audit(
    user,
    "artwork.issue",
    "order",
    orderId,
    `Não conformidade na arte de ${item.name}: ${note}`,
  );
  await notify(await designerTarget(order), {
    link: `/app/orders/${orderId}#artwork`,
    kind: "action",
    text: (t) => ({
      subject: t("artwork.notify.issue.subject", {
        n: String(order.number),
        item: item.name,
      }),
      body: note,
    }),
  });
  return issue;
}

/** Designer corrige (nota e, se quiser, a arte nova). */
export async function fixArtIssue(
  user: User,
  issueId: string,
  input: { fixNote: string; documentId?: string | null },
) {
  const store = getStore();
  const issue = await store.get("art_issues", issueId);
  if (!issue) throw new ArtworkError("not_found");
  const order = await loadOrder(issue.orderId);
  if (!canFixArt(user, order)) throw new ForbiddenError();
  if (issue.status !== "open") throw new ArtworkError("invalid_status");
  const fixNote = input.fixNote.trim();
  if (!fixNote) throw new ArtworkError("note_required");
  const updated = await store.update("art_issues", issue.id, {
    status: "fixed",
    fixNote,
    fixDocumentId: input.documentId ?? null,
    fixedByUserId: user.id,
    fixedAt: new Date().toISOString(),
  });
  await audit(
    user,
    "artwork.fixed",
    "order",
    order.id,
    `Arte corrigida: ${fixNote}`,
  );
  await notify(
    { userIds: [issue.reportedByUserId] },
    {
      link: `/app/orders/${order.id}#artwork`,
      kind: "action",
      text: (t) => ({
        subject: t("artwork.notify.fixed.subject", {
          n: String(order.number),
        }),
        body: fixNote,
      }),
    },
  );
  return updated;
}

/** Wellmix aceita a correção ou reabre com o motivo. */
export async function reviewArtFix(
  user: User,
  issueId: string,
  accept: boolean,
  note: string | null,
) {
  if (!isWellmix(user)) throw new ForbiddenError();
  const store = getStore();
  const issue = await store.get("art_issues", issueId);
  if (!issue) throw new ArtworkError("not_found");
  const order = await loadOrder(issue.orderId);
  if (issue.status !== "fixed") throw new ArtworkError("invalid_status");
  if (!accept && !note?.trim()) throw new ArtworkError("note_required");
  const updated = await store.update(
    "art_issues",
    issue.id,
    accept
      ? {
          status: "accepted",
          acceptedByUserId: user.id,
          acceptedAt: new Date().toISOString(),
        }
      : {
          status: "open",
          note: `${issue.note}\n— ${note!.trim()}`.slice(0, 4000),
        },
  );
  await audit(
    user,
    accept ? "artwork.accepted" : "artwork.reopened",
    "order",
    order.id,
    accept ? "Correção da arte aceita" : `Arte reaberta: ${note}`,
  );
  if (!accept)
    await notify(await designerTarget(order), {
      link: `/app/orders/${order.id}#artwork`,
      kind: "action",
      text: (t) => ({
        subject: t("artwork.notify.reopened.subject", {
          n: String(order.number),
        }),
        body: note ?? "",
      }),
    });
  return updated;
}

export interface ArtworkView {
  designer: User | null;
  candidates: User[];
  items: { item: OrderItem; issues: ArtIssue[] }[];
  open: number;
  canFix: boolean;
}

export async function artworkView(
  user: User,
  order: Order,
): Promise<ArtworkView> {
  const store = getStore();
  const [items, issues, designer, candidates] = await Promise.all([
    store.list("order_items", { filter: { orderId: order.id } }),
    issuesOf(order.id),
    order.designerUserId
      ? store.get("users", order.designerUserId)
      : Promise.resolve(null),
    isWellmix(user) ? designerCandidates(order) : Promise.resolve([]),
  ]);
  return {
    designer: designer ?? null,
    candidates,
    items: items.map((item) => ({
      item,
      issues: issues
        .filter((i) => i.orderItemId === item.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    })),
    open: issues.filter((i) => i.status !== "accepted").length,
    canFix: canFixArt(user, order),
  };
}

/** Artes do pedido que o usuário pode abrir (para o zip). */
export async function artworkDocuments(
  user: User,
  order: Order,
): Promise<Document[]> {
  if (!canViewOrder(user, order)) throw new ForbiddenError();
  const store = getStore();
  const types = [...ART_DOC_TYPES] as string[];
  const [byOrder, briefs] = await Promise.all([
    store.list("documents", { filter: { orderId: order.id } }),
    store.list("packaging_briefs", { filter: { orderId: order.id } }),
  ]);
  const byBrief = briefs.length
    ? await store.list("documents", {
        filter: { packagingBriefId: briefs.map((b) => b.id) },
      })
    : [];
  const all = [...byOrder, ...byBrief];
  // Só a versão mais nova de cada arquivo.
  const superseded = new Set(
    all.map((d) => d.previousDocumentId).filter((id): id is string => !!id),
  );
  const seen = new Set<string>();
  const out: Document[] = [];
  for (const doc of all) {
    if (seen.has(doc.id) || superseded.has(doc.id)) continue;
    if (!types.includes(doc.type)) continue;
    seen.add(doc.id);
    if (await canAccessDocument(user, doc)) out.push(doc);
  }
  return out;
}
