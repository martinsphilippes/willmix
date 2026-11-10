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

/**
 * Os números que a tela do Superplan tinha quando a viabilidade foi aprovada.
 * Os parâmetros do sistema (fatores de preço, impostos da venda, tributos da
 * importação) não vêm daqui: o servidor usa os dele e refaz a conta.
 */
export interface SuperplanSimulation {
  unitPrice: number | null;
  currency: "RMB" | "USD";
  pcsPerCarton: number | null;
  grossWeightPcKg: number | null;
  cbmPerCarton: number | null;
  container: string | null;
  containerCbm: number | null;
  containerMaxKg: number | null;
  iiPct: number;
  ipiPct: number;
  freightUsd: number | null;
  roadFreightBrl: number;
  deliveryFreightBrl: number;
  officialRate: number | null;
  futureRate: number | null;
  rmbPerUsd: number | null;
  tradingCommissionPct: number;
  chinaChargesRmb: number;
  /** Despesas por container (R$), pela chave da despesa. */
  expenses: Record<string, number>;
  businessType: string | null;
  markup: number;
  commissionPct: number;
  adminExpensesPct: number;
  targetProfitPct: number;
  wdPct: number;
  salePrice: number | null;
}
