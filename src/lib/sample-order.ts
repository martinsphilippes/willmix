import { createHash } from "node:crypto";

/*
 * Pedido de amostras (contrato secundário do pedido de compra; mapa do
 * processo, passos P10 e P17; docs/SAMPLE_ORDER.md). Regras puras.
 *
 * Decisão do dono (13/11/2026): a quantidade de amostras de cada produto do
 * pedido é 5 × 3 × Nm, onde Nm é o número de variantes do produto (sem
 * variantes cadastradas, conta 1). Documento à parte do contrato, aceito pelo
 * fornecedor. Antes de assinar o contrato a Wellmix sempre decide: gera o
 * pedido de amostras ou marca "sem amostras".
 */

/** 5 × 3 peças por variante. */
export const SAMPLES_PER_VARIANT = 5 * 3;

export interface SampleLine {
  /** Item do pedido de compra. */
  itemId: string;
  productId: string | null;
  name: string;
  /** Variantes ativas do produto (mínimo 1). */
  variants: number;
  /** Peças de amostra: 5 × 3 × variantes. */
  quantity: number;
}

export interface SampleOrderDoc {
  /** "ordered": pedido de amostras gerado; "none": a Wellmix decidiu sem amostras. */
  status: "ordered" | "none";
  lines: SampleLine[];
  /** Motivo de "sem amostras" (opcional). */
  note: string | null;
  at: string;
  userId: string;
  userName: string;
  /** Versão do documento (o fornecedor aceita esta). */
  hash: string;
}

export interface SampleAcceptance {
  name: string;
  userId: string;
  userName: string;
  at: string;
  hash: string;
}

/** Peças de amostra de um produto com `variants` variantes. */
export function sampleQuantity(variants: number): number {
  const n = Number.isFinite(variants) ? Math.max(1, Math.floor(variants)) : 1;
  return SAMPLES_PER_VARIANT * n;
}

/** Linhas do pedido de amostras, na ordem dos itens do pedido. */
export function sampleLines(
  items: Array<{
    id: string;
    productId: string | null;
    name: string;
    variants: number;
  }>,
): SampleLine[] {
  return items.map((i) => {
    const variants = Math.max(1, Math.floor(i.variants || 0));
    return {
      itemId: i.id,
      productId: i.productId,
      name: i.name,
      variants,
      quantity: sampleQuantity(variants),
    };
  });
}

/** Versão do documento: muda quando muda o que foi pedido. */
export function sampleOrderHash(
  orderId: string,
  status: SampleOrderDoc["status"],
  lines: SampleLine[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        orderId,
        status,
        lines: lines.map((l) => [l.itemId, l.variants, l.quantity]),
      }),
    )
    .digest("hex");
}

export const sampleTotal = (lines: SampleLine[]) =>
  lines.reduce((sum, l) => sum + l.quantity, 0);

function parse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export const parseSampleOrder = (value: string | null | undefined) =>
  parse<SampleOrderDoc>(value);
export const parseSampleAcceptance = (value: string | null | undefined) =>
  parse<SampleAcceptance>(value);

/*
 * Divisão das amostras depois da inspeção (mapa R13/R14; dono, 14/11/2026):
 * de cada 5, 4 vão ao show room no Brasil e 1 à agência de marketing na
 * China (4 × 3 × Nm e 1 × 3 × Nm).
 */
export const SAMPLES_TO_BRAZIL_PER_VARIANT = 4 * 3;
export const SAMPLES_TO_CHINA_PER_VARIANT = 1 * 3;

export interface SampleSplit {
  itemId: string;
  productId: string | null;
  name: string;
  variants: number;
  brazil: number;
  china: number;
  total: number;
}

export const sampleSplit = (line: SampleLine): SampleSplit => {
  const variants = Math.max(1, line.variants);
  return {
    itemId: line.itemId,
    productId: line.productId,
    name: line.name,
    variants,
    brazil: SAMPLES_TO_BRAZIL_PER_VARIANT * variants,
    china: SAMPLES_TO_CHINA_PER_VARIANT * variants,
    total: line.quantity,
  };
};
