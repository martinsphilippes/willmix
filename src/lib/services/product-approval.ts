import "server-only";

import {
  getStore,
  PRODUCT_EXTRA_DEFAULTS,
  type Product,
  type User,
} from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { assertWellmix, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { assertScreen, canOpen, screensFor } from "@/lib/auth/screens";
import { accessFromFunctions } from "@/lib/auth/function-access";
import {
  awaitingApproval,
  canDecideApproval,
  pendingApproval,
  superiorsOf,
} from "@/lib/product-approval";
import { audit } from "./audit";
import { notify } from "./notifications";

/*
 * Aprovação do produto novo (dono, 17/11/2026; docs/NEW_PRODUCT.md). A tela
 * "Novo produto" cria o produto inativo e "aguardando aprovação"; a
 * pendência vai para o administrador e para os superiores de quem pediu (o
 * "Responde a"). Aprovado, o produto fica ativo e segue para o Sankhya;
 * recusado (com o motivo), continua inativo até alguém corrigir e reenviar.
 * Nada é apagado: as decisões ficam no histórico (audit_log).
 */

export class ProductApprovalError extends Error {
  constructor(
    readonly code:
      | "product_not_found"
      | "line_not_found"
      | "supplier_not_found"
      | "approval_not_pending"
      | "approval_not_rejected"
      | "approval_forbidden"
      | "approval_reject_note",
  ) {
    super(code);
  }
}

/** Campos do produto que a tela "Novo produto" grava (o resto vem do padrão). */
export type NewProductInput = Partial<
  Omit<
    Product,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "active"
    | "approvalStatus"
    | "approvalRequestedByUserId"
    | "approvalRequestedAt"
    | "approvalDecidedByUserId"
    | "approvalDecidedAt"
    | "approvalNote"
  >
> &
  Pick<Product, "name" | "lineId">;

/**
 * Equipe da Wellmix para a conta da aprovação: também quem saiu (a cadeia
 * do "Responde a" passa por ele até o próximo superior).
 */
async function approvalTeam(): Promise<User[]> {
  return getStore().list("users", {
    filter: { role: ["admin", "operator"] },
  });
}

/** Quem da equipe abre a tela Produtos (onde a aprovação é feita). */
async function opensProducts(): Promise<(u: User) => boolean> {
  const { loadFunctionDefs } = await import("./team-functions");
  const defs = await loadFunctionDefs();
  return (u) =>
    isAdmin(u) ||
    screensFor(u, accessFromFunctions(u.functions, defs)).has("products");
}

/**
 * Quem recebe o aviso e é o dono da pendência no Painel de SLA: o primeiro
 * superior de quem pediu que abre a tela Produtos. Sem ele, os
 * administradores (que veem todas as aprovações em Pendências).
 */
function approverTargets(
  requesterId: string | null | undefined,
  team: User[],
  opens: (u: User) => boolean,
): { superior: User | null; notifyIds: string[] } {
  const superior = superiorsOf(requesterId, team).find((u) => opens(u)) ?? null;
  const admins = team.filter(
    (u) => isAdmin(u) && u.active && !u.loginSuspended,
  );
  return {
    superior,
    notifyIds: (superior ? [superior] : admins)
      .map((u) => u.id)
      .filter((id) => id !== requesterId),
  };
}

async function notifyApprovers(
  requester: User,
  product: Product,
  resubmitted: boolean,
) {
  const team = await approvalTeam();
  const { notifyIds } = approverTargets(
    requester.id,
    team,
    await opensProducts(),
  );
  if (!notifyIds.length) return;
  await notify(
    { userIds: notifyIds },
    {
      kind: "action",
      link: `/app/products/${product.id}#approval`,
      text: (t) => ({
        subject: t(
          resubmitted
            ? "productApproval.notify.resubmitted"
            : "productApproval.notify.subject",
          { name: product.name },
        ),
        body: t("productApproval.notify.body", {
          requester: requester.name,
          sku: product.sku ?? "—",
        }),
      }),
    },
  );
}

async function assertLineAndSupplier(input: {
  lineId: string;
  supplierId?: string | null;
}) {
  const store = getStore();
  if (!(await store.get("product_lines", input.lineId)))
    throw new ProductApprovalError("line_not_found");
  if (input.supplierId) {
    const supplier = await store.get("parties", input.supplierId);
    if (!supplier || supplier.type !== "supplier")
      throw new ProductApprovalError("supplier_not_found");
  }
}

/**
 * Cria o produto da tela "Novo produto": inativo, origem manual e
 * aguardando aprovação. Não vai para o Sankhya agora (só depois de
 * aprovado).
 */
export async function createProductForApproval(
  user: User,
  input: NewProductInput,
): Promise<Product> {
  assertWellmix(user);
  assertScreen(user, "products");
  await assertLineAndSupplier(input);
  const now = new Date().toISOString();
  const product = await getStore().create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    sku: null,
    specification: null,
    source: "manual",
    ...input,
    active: false,
    approvalStatus: "pending",
    approvalRequestedByUserId: user.id,
    approvalRequestedAt: now,
    approvalDecidedByUserId: null,
    approvalDecidedAt: null,
    approvalNote: null,
  });
  if (product.supplierId) {
    // Fornecedor escolhido: entra na lista de fornecedores do produto.
    const { syncMainSupplierLink } = await import("./product-suppliers");
    await syncMainSupplierLink(
      user,
      { supplierId: null, supplierSku: null },
      product,
      product.id,
    );
  }
  await audit(
    user,
    "product.create",
    "product",
    product.id,
    `Produto novo (aguarda aprovação): ${product.name}`,
    null,
    { ...input, active: false, approvalStatus: "pending" },
  );
  await notifyApprovers(user, product, false);
  return product;
}

/**
 * Aprova (ativa e manda para o Sankhya) ou recusa (com o motivo; continua
 * inativo). Só o administrador ou um superior de quem pediu, com a tela
 * Produtos.
 */
export async function decideProductApproval(
  user: User,
  productId: string,
  input: { approve: boolean; note: string | null },
): Promise<Product> {
  assertWellmix(user);
  assertScreen(user, "products");
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) throw new ProductApprovalError("product_not_found");
  if (!pendingApproval(product))
    throw new ProductApprovalError("approval_not_pending");
  const team = await approvalTeam();
  if (!canDecideApproval(user, product.approvalRequestedByUserId, team))
    throw new ProductApprovalError("approval_forbidden");
  const note = input.note?.trim() ? input.note.trim().slice(0, 1000) : null;
  if (!input.approve && !note)
    throw new ProductApprovalError("approval_reject_note");
  const decided = {
    active: input.approve,
    approvalStatus: input.approve
      ? ("approved" as const)
      : ("rejected" as const),
    approvalDecidedByUserId: user.id,
    approvalDecidedAt: new Date().toISOString(),
    approvalNote: note,
  };
  const saved = await store.update("products", productId, decided);
  await audit(
    user,
    input.approve ? "product.approve" : "product.reject",
    "product",
    productId,
    input.approve
      ? `Produto novo aprovado: ${product.name}`
      : `Produto novo recusado: ${product.name} (${note})`,
    { active: product.active, approvalStatus: product.approvalStatus },
    decided,
  );
  const requesterId = product.approvalRequestedByUserId;
  if (requesterId && requesterId !== user.id)
    await notify(
      { userIds: [requesterId] },
      {
        kind: input.approve ? "done" : "action",
        link: `/app/products/${productId}${input.approve ? "" : "#approval"}`,
        text: (t) =>
          input.approve
            ? {
                subject: t("productApproval.notify.approved", {
                  name: product.name,
                }),
                body: t("productApproval.notify.approvedBody", {
                  by: user.name,
                }),
              }
            : {
                subject: t("productApproval.notify.rejected", {
                  name: product.name,
                }),
                body: t("productApproval.notify.rejectedBody", {
                  by: user.name,
                  note: note ?? "",
                }),
              },
      },
    );
  // Aprovado: o produto novo vai para o Sankhya (fase 3), como antes.
  if (input.approve) {
    const { syncSoon } = await import("@/lib/integrations/sankhya-sync");
    await syncSoon(user, "product", productId);
  }
  return saved;
}

/**
 * Recusado e corrigido: volta para a aprovação. Quem reenvia passa a ser
 * quem pediu (o superior dele aprova). A recusa anterior fica (quem decide
 * vê o motivo dela).
 */
export async function resubmitProductApproval(
  user: User,
  productId: string,
): Promise<Product> {
  assertWellmix(user);
  assertScreen(user, "products");
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) throw new ProductApprovalError("product_not_found");
  if (!awaitingApproval(product) || product.approvalStatus !== "rejected")
    throw new ProductApprovalError("approval_not_rejected");
  const saved = await store.update("products", productId, {
    approvalStatus: "pending",
    approvalRequestedByUserId: user.id,
    approvalRequestedAt: new Date().toISOString(),
  });
  await audit(
    user,
    "product.approval.resubmit",
    "product",
    productId,
    `Produto novo reenviado para aprovação: ${product.name}`,
    { approvalStatus: product.approvalStatus },
    { approvalStatus: "pending" },
  );
  await notifyApprovers(user, saved, true);
  return saved;
}

/**
 * Quem recebe a aprovação de um produto que este login criar: o primeiro
 * superior dele que abre a tela Produtos (nulo: os administradores). É o
 * aviso da tela "Novo produto".
 */
export async function productApproverFor(
  requesterId: string,
): Promise<{ id: string; name: string } | null> {
  const team = await approvalTeam();
  const { superior } = approverTargets(
    requesterId,
    team,
    await opensProducts(),
  );
  return superior ? { id: superior.id, name: superior.name } : null;
}

/** Quadro da aprovação na tela do produto. */
export interface ProductApprovalView {
  status: "pending" | "rejected";
  requesterName: string | null;
  requestedAt: string | null;
  deciderName: string | null;
  decidedAt: string | null;
  note: string | null;
  /** Quem vê pode aprovar ou recusar agora. */
  canDecide: boolean;
  /** Quem vê pode reenviar (recusado). */
  canResubmit: boolean;
  /** Quem recebe a pendência: o superior de quem pediu (nulo: administradores). */
  superiorName: string | null;
}

export async function productApprovalView(
  user: User,
  product: Product,
): Promise<ProductApprovalView | null> {
  if (!isWellmix(user) || !awaitingApproval(product)) return null;
  const team = await approvalTeam();
  const name = (id: string | null | undefined) =>
    id ? (team.find((u) => u.id === id)?.name ?? null) : null;
  const pending = product.approvalStatus === "pending";
  const { superior } = approverTargets(
    product.approvalRequestedByUserId,
    team,
    await opensProducts(),
  );
  return {
    status: pending ? "pending" : "rejected",
    requesterName: name(product.approvalRequestedByUserId),
    requestedAt: product.approvalRequestedAt ?? null,
    deciderName: name(product.approvalDecidedByUserId),
    decidedAt: product.approvalDecidedAt ?? null,
    note: product.approvalNote ?? null,
    canDecide:
      pending &&
      canOpen(user, "products") &&
      canDecideApproval(user, product.approvalRequestedByUserId, team),
    canResubmit: !pending && canOpen(user, "products"),
    superiorName: superior?.name ?? null,
  };
}

/** Rascunho de pendência (Pendências completa prazo e grupo). */
export interface ApprovalTaskDraft {
  kind: "product_approve";
  title: string;
  detail: string;
  text: {
    title: "productApproval.task.title";
    detail: "productApproval.task.detail";
    values: Record<string, string>;
  };
  link: string;
  dueAt: null;
  sinceAt: string | null;
  loadedAt: string | null;
  ownerUserId: string | null;
}

/**
 * Pendências de aprovação de quem vê: o administrador vê todas; o superior,
 * as de quem está abaixo dele no "Responde a". Só quem abre a tela Produtos.
 * Antes de o esquema ser publicado (coluna ainda inexistente), nenhuma.
 */
export async function approvalTaskDrafts(
  user: User,
): Promise<ApprovalTaskDraft[]> {
  if (!isWellmix(user) || !canOpen(user, "products")) return [];
  const store = getStore();
  const pending = (
    await store
      .list("products", { filter: { approvalStatus: "pending" } })
      .catch(() => [] as Product[])
  ).filter((p) => pendingApproval(p));
  if (!pending.length) return [];
  const team = await approvalTeam();
  const mine = pending.filter((p) =>
    canDecideApproval(user, p.approvalRequestedByUserId, team),
  );
  if (!mine.length) return [];
  const lines = await listByIds(store, "product_lines", [
    ...new Set(mine.map((p) => p.lineId)),
  ]);
  const lineName = new Map(lines.map((l) => [l.id, l.name]));
  const opens = await opensProducts();
  const drafts: ApprovalTaskDraft[] = [];
  for (const p of mine) {
    const requester =
      team.find((u) => u.id === p.approvalRequestedByUserId)?.name ?? "—";
    const { superior } = approverTargets(
      p.approvalRequestedByUserId,
      team,
      opens,
    );
    const values = {
      name: p.name,
      sku: p.sku ?? "—",
      line: lineName.get(p.lineId) ?? "—",
      requester,
    };
    drafts.push({
      kind: "product_approve",
      title: `Aprovar produto novo: ${p.name}`,
      detail: `${values.sku} · ${values.line} · pedido por ${requester}`,
      text: {
        title: "productApproval.task.title",
        detail: "productApproval.task.detail",
        values,
      },
      link: `/app/products/${p.id}#approval`,
      dueAt: null,
      sinceAt: p.approvalRequestedAt ?? p.createdAt,
      loadedAt: p.createdAt,
      ownerUserId: superior?.id ?? null,
    });
  }
  return drafts;
}
