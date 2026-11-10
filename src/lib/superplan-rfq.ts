/*
 * Do Superplan à faca e à RFQ (docs/SUPERPLAN.md, seção 11): regras puras,
 * usadas pela tela, pelo serviço e pelos testes.
 */

/** O que o fornecedor ganho envia na cotação aberta do Superplan, na ordem da tela. */
export const SUPERPLAN_ITEMS = ["dieline", "moq", "leadTime", "hd"] as const;
export type SuperplanItem = (typeof SUPERPLAN_ITEMS)[number];

/** O que ainda falta dos quatro itens (vazio = pode seguir para a proposta). */
export function superplanMissing(s: {
  dieline: boolean;
  moq: number | null | undefined;
  leadTimeDays: number | null | undefined;
  hd: boolean;
}): SuperplanItem[] {
  const ok: Record<SuperplanItem, boolean> = {
    dieline: s.dieline,
    moq: typeof s.moq === "number" && s.moq > 0,
    leadTime: typeof s.leadTimeDays === "number" && s.leadTimeDays > 0,
    hd: s.hd,
  };
  return SUPERPLAN_ITEMS.filter((key) => !ok[key]);
}
