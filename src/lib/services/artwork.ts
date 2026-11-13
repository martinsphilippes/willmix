import "server-only";
import { realName } from "@/lib/placeholder-name";
import { can, holdersOf } from "@/lib/auth/function-access";
import { loadFunctionDefs } from "./team-functions";

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
  isWellmix,
} from "@/lib/auth/permissions";
import { audit } from "./audit";
import { canAccessDocument } from "./documents";
import { notify } from "./notifications";
import { isSchemaMissing } from "@/lib/db/errors";
import {
  artMakerRoute,
  artReviewRoute,
  canValidateArt,
  loadRoutingContext,
  notifyTargetOf,
  reaches,
  routeLabel,
  routeOwnerUserId,
  type MissingAssignment,
  type Route,
  type RouteVia,
} from "./cert-art-routing";

/*
 * Marketing das artes do pedido (Fase F, docs/ARTWORK.md):
 * - designer do pedido: alguém da Wellmix com a função "designer" ou um
 *   login da agência do pedido;
 * - não conformidade da arte por SKU: a Wellmix aponta (com motivo e,
 *   se quiser, arquivo), o designer corrige, a Wellmix aceita ou reabre
 *   (quem pode validar arte). Cada lado ganha a pendência (quem faz a arte
 *   corrige; quem apontou confere), pelo encaminhamento de
 *   cert-art-routing.ts;
 * - baixar todas as artes do pedido de uma vez (zip), só o que o usuário
 *   pode abrir.
 */

export class ArtworkError extends Error {}

/** Link direto para a não conformidade no cartão Artes do pedido. */
export const issueLink = (orderId: string, issueId: string) =>
  `/app/orders/${orderId}#artwork-issue-${issueId}`;

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
    ...holdersOf(team, "art.design", await loadFunctionDefs()),
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

/**
 * Para quem vão os avisos ao designer: quem faz a arte do pedido (o designer
 * do pedido; sem ele, a agência quando é ela quem faz a arte; senão a
 * Wellmix), o mesmo destino da pendência de corrigir.
 */
async function designerTarget(order: Order) {
  return notifyTargetOf(artMakerRoute(order, await loadRoutingContext()));
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
    link: issueLink(orderId, issue.id),
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
  // Quem confere: quem apontou (se pode validar arte); senão quem valida.
  await notify(
    notifyTargetOf(artReviewRoute(order, updated, await loadRoutingContext())),
    {
      link: issueLink(order.id, issue.id),
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
  // Conferir a correção é validar a arte: quem tem a ação "Validar a arte"
  // (Equipe → Funções e acessos; o administrador sempre).
  if (!isWellmix(user) || !can(user, "art.validate"))
    throw new ForbiddenError();
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
      link: issueLink(order.id, issue.id),
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
  /** Conferir a correção (aceitar ou reabrir): quem pode validar arte. */
  canReview: boolean;
  /**
   * Visão interna da Wellmix: quem faz a arte do pedido agora (recebe as
   * correções e a aplicação do selo) e o que falta designar.
   */
  maker: {
    via: RouteVia;
    label: string | null;
    missing: MissingAssignment | null;
  } | null;
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
  const wellmix = isWellmix(user);
  const ctx = wellmix ? await loadRoutingContext() : null;
  const route = ctx ? artMakerRoute(order, ctx) : null;
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
    canReview: wellmix && can(user, "art.validate"),
    maker:
      ctx && route
        ? {
            via: route.via,
            label: await routeLabel(route, ctx),
            missing: route.missing ?? null,
          }
        : null,
  };
}

export interface ArtTaskDraft {
  /** Corrigir a não conformidade (quem faz a arte) ou conferir a correção. */
  kind: "art_fix" | "art_review";
  order: Order;
  issue: ArtIssue;
  itemName: string;
  link: string;
  missing: MissingAssignment | null;
  /** Dono no painel de SLA: o login da Wellmix que recebeu. */
  ownerUserId: string | null;
  sinceAt: string | null;
}

/**
 * Pendências do cartão Artes: a não conformidade aberta vai para quem faz a
 * arte (o designer do pedido; sem ele, a agência quando é ela quem faz a
 * arte; senão a Wellmix) e a corrigida, para quem confere (quem apontou, se
 * pode validar arte; senão quem valida). `team`: painel de SLA, as de
 * qualquer login da Wellmix.
 */
export async function artIssueTasks(
  user: User,
  options: { team?: boolean } = {},
): Promise<ArtTaskDraft[]> {
  const wellmix = isWellmix(user);
  const agency = user.role === "agency" && !!user.partyId;
  if (!wellmix && !agency) return [];
  const store = getStore();
  let issues: ArtIssue[] = [];
  try {
    let orderIds: string[] | null = null;
    if (agency) {
      const { listColumns } = await import("@/lib/db/lookup");
      orderIds = (
        await listColumns(store, "orders", ["agencyId"], {
          filter: { agencyId: user.partyId! },
        })
      ).map((o) => o.id);
      if (!orderIds.length) return [];
    }
    issues = await store.list("art_issues", {
      filter: {
        status: ["open", "fixed"],
        ...(orderIds ? { orderId: orderIds } : {}),
      },
    });
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  if (!issues.length) return [];
  const [orders, items] = await Promise.all([
    store.list("orders", {
      filter: { id: [...new Set(issues.map((i) => i.orderId))] },
    }),
    store.list("order_items", {
      filter: { id: [...new Set(issues.map((i) => i.orderItemId))] },
    }),
  ]);
  const ctx = await loadRoutingContext();
  const teamIds = new Set(ctx.team.map((u) => u.id));
  const teamView = wellmix && !!options.team;
  const mine = (route: Route) =>
    teamView
      ? !!route.team || (route.userIds ?? []).some((id) => teamIds.has(id))
      : reaches(user, route);
  const out: ArtTaskDraft[] = [];
  for (const issue of issues) {
    const order = orders.find((o) => o.id === issue.orderId);
    if (!order || order.status === "CANCELLED" || order.status === "CLOSED")
      continue;
    const fix = issue.status === "open";
    const route = fix
      ? artMakerRoute(order, ctx)
      : artReviewRoute(order, issue, ctx);
    if (!mine(route)) continue;
    // Conferir é validar a arte: só quem pode (a equipe toda no painel).
    if (!fix && !teamView && !canValidateArt(user, ctx)) continue;
    out.push({
      kind: fix ? "art_fix" : "art_review",
      order,
      issue,
      // Nome de exemplo ("Produto novo XPTO") vale como ausente.
      itemName:
        realName(items.find((i) => i.id === issue.orderItemId)?.name) ?? "—",
      link: issueLink(order.id, issue.id),
      missing: route.missing ?? null,
      ownerUserId: routeOwnerUserId(route, order, ctx),
      // Aberta: desde que foi apontada (ou reaberta); corrigida, desde a correção.
      sinceAt: fix ? issue.updatedAt : issue.fixedAt,
    });
  }
  return out;
}

/** Artes do pedido que o usuário pode abrir (para o zip). */
export async function artworkDocuments(
  user: User,
  order: Order,
): Promise<Document[]> {
  if (!canViewOrder(user, order)) throw new ForbiddenError();
  const store = getStore();
  const types = [...ART_DOC_TYPES] as string[];
  const all = await store.list("documents", {
    filter: { orderId: order.id },
  });
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
  // Selo de certificação (o arquivo atual do passo): vai junto com as artes
  // para quem vê o passo (a Wellmix, a agência e a certificadora).
  const { sealDocumentId } = await import("./import-flow");
  const sealId = await sealDocumentId(order.id);
  const seal = sealId ? all.find((d) => d.id === sealId) : null;
  if (seal && !seen.has(seal.id) && (await canAccessDocument(user, seal)))
    out.push(seal);
  return out;
}
