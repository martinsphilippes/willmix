/*
 * Tarefas de Certificação e Artes sem dono certo (src/lib/services/
 * cert-art-routing.ts): o que falta designar no pedido e onde designar.
 */

/** O que falta designar para a tarefa ter dono certo. */
export type MissingAssignment = "ocp" | "certifier" | "designer" | "analyst";

/** Onde designar cada responsável que falta (âncora do pedido ou tela). */
export const ASSIGN_HREF: Record<
  MissingAssignment,
  (orderId: string) => string
> = {
  // Quem certifica (o despachante; a chave "ocp" ficou do nome antigo):
  // Parceiros do pedido.
  ocp: (orderId) => `/app/orders/${orderId}#order-partners`,
  // Certificadora (OCP) do pedido, dona do certificado das raias do pedido de
  // compra (dono, 14/11/2026): Parceiros do pedido.
  certifier: (orderId) => `/app/orders/${orderId}#order-partners`,
  // Designer do pedido: cartão Artes.
  designer: (orderId) => `/app/orders/${orderId}#artwork`,
  // Analista do pedido: sai da divisão da linha (Equipe Interna → Linhas e
  // divisões → "Distribuir agora"; antes, "/app/team#distribute" abria a aba
  // Equipe, sem a distribuição). O link só aparece para quem abre a Equipe
  // (src/components/distribute-link.tsx).
  analyst: () => "/app/team?tab=lines#distribute",
};
