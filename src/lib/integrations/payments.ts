/**
 * PaymentProvider: abstração mínima para cobrança do cliente.
 * MANUAL: o operador Willmix confirma o pagamento e anexa comprovante.
 * EXTERNAL DEPENDENCY PENDING: boleto/PIX via API (banco ou gateway).
 */
export interface PaymentProvider {
  readonly mode: "MANUAL";
  /** Cria a cobrança. Em modo manual, apenas devolve instruções. */
  createCharge(input: {
    amount: number;
    currency: string;
    reference: string;
  }): Promise<{
    instructions: string;
    externalId: string | null;
  }>;
}

export class ManualPaymentProvider implements PaymentProvider {
  readonly mode = "MANUAL" as const;
  async createCharge(input: {
    amount: number;
    currency: string;
    reference: string;
  }) {
    return {
      instructions: `Pagamento manual de ${input.currency} ${input.amount.toFixed(2)} (ref. ${input.reference}). O operador Willmix confirma o recebimento no portal.`,
      externalId: null,
    };
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new ManualPaymentProvider();
}
