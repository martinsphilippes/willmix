import type { Product } from "@/lib/db/schema";
import { managerChain, type HierarchyNode } from "@/lib/team-hierarchy";

/*
 * Aprovação do produto novo (dono, 17/11/2026; docs/NEW_PRODUCT.md): regras
 * puras. O produto criado pela tela "Novo produto" nasce inativo e aguarda a
 * aprovação do administrador ou do superior de quem pediu (a cadeia do
 * "Responde a", users.managerUserId). Enquanto aguarda (ou foi recusado e
 * não foi corrigido), fica fora do catálogo e do Sankhya.
 */

type ApprovalFields = Pick<Product, "active"> &
  Partial<Pick<Product, "approvalStatus">>;

/**
 * Aguarda a aprovação: pendente ou recusado, ainda inativo. Produto que outra
 * rotina ativou (ex.: a carga do Sankhya ligou pelo SKU um produto que já
 * existia lá) deixa de aguardar.
 */
export function awaitingApproval(product: ApprovalFields): boolean {
  return (
    !product.active &&
    (product.approvalStatus === "pending" ||
      product.approvalStatus === "rejected")
  );
}

/** Pendente de decisão (o que vira pendência de quem aprova). */
export function pendingApproval(product: ApprovalFields): boolean {
  return !product.active && product.approvalStatus === "pending";
}

/** Login da equipe na conta da aprovação (ativo e com login liberado). */
export interface ApproverNode extends HierarchyNode {
  role: string;
  active: boolean;
  loginSuspended?: boolean | null;
}

const canSignIn = (u: ApproverNode) => u.active && !u.loginSuspended;

/**
 * Superiores de quem pediu a aprovação, do direto ao topo (a mesma árvore do
 * Painel de SLA). Quem saiu da equipe ou está com o login suspenso não
 * aprova, mas a cadeia continua acima dele. Quem pediu nunca está na lista
 * (ciclo no cadastro).
 */
export function superiorsOf<N extends ApproverNode>(
  requesterId: string | null | undefined,
  team: readonly N[],
): N[] {
  if (!requesterId) return [];
  return managerChain(requesterId, team).chain.filter(
    (n) => n.id !== requesterId && canSignIn(n),
  );
}

/**
 * Pode aprovar ou recusar: o administrador (sempre) ou um superior de quem
 * pediu. Quem pediu não decide o próprio produto (só se for administrador).
 */
export function canDecideApproval(
  user: Pick<ApproverNode, "id" | "role">,
  requesterId: string | null | undefined,
  team: readonly ApproverNode[],
): boolean {
  if (user.role === "admin") return true;
  if (!requesterId || user.id === requesterId) return false;
  return superiorsOf(requesterId, team).some((n) => n.id === user.id);
}
