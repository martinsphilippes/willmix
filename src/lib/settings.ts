import "server-only";

import { getStore } from "@/lib/db";

/**
 * Decisões em aberto parametrizadas (docs/OPEN_DECISIONS.md).
 * Valores padrão aqui; sobrescritos pela tabela `settings` (tela de configurações).
 */
export const DEFAULT_SETTINGS = {
  customerCanCreateRequest: true,
  wellmixCanCreateRequest: true,
  /** CUSTOMER | WELLMIX | BOTH: quem confirma o recebimento da entrega. */
  deliveryConfirmationMode: "BOTH" as "CUSTOMER" | "WELLMIX" | "BOTH",
  agencyValidationEnabled: true,
  /** Tolerância de divergência de peso entre preparação e inspeção (%). */
  weightTolerancePercent: 3,
  paymentMode: "MANUAL" as const,
  sankhyaMode: "MOCK" as "MOCK" | "MANUAL",
  whatsappMode: "MOCK" as const,
  emailMode: "MOCK" as const,
  quotationExpirationDays: 15,
  /** SLA de resposta da cotação: dias úteis para a Wellmix responder uma solicitação. */
  quoteSlaBusinessDays: 5,
  /** Percentual do sinal cobrado do cliente. */
  downPaymentPercent: 30,
  /** Prazos padrão por etapa, em dias. */
  stageDueDays: {
    ORDER_CREATED: 1,
    PREPARATION: 15,
    SUPPLIER_PAYMENT: 5,
    PACKAGING: 7,
    INSPECTION: 5,
    SHIPPING: 10,
    CUSTOMS: 15,
    TRANSPORT: 7,
    DELIVERED: 3,
    CLOSED: 0,
  } as Record<string, number>,
  /** Dias para lembrar antes do vencimento e depois. */
  reminderDaysBeforeDue: 1,
  /* ---- Evolução incremental (docs/EVOLUTION_PLAN.md) ---- */
  /** Tolerância de dimensões (cm) entre snapshot da compra e inspeção (%). */
  dimensionTolerancePercent: 5,
  /** Tolerância de CBM e de peso bruto entre snapshot e inspeção (%). */
  cbmTolerancePercent: 5,
  /** Tolerância de quantidade por caixa (master/inner) entre snapshot e inspeção (%). 0 = exato. */
  quantityTolerancePercent: 0,
  /** Inspeção pede também dimensões, peso bruto, caixa, material e cor (opcionais) para comparar com a compra. */
  inspectionExtendedChecks: true,
  /** Gate: pedido com FOB zerado/ausente entra na fila de revisão. */
  reviewOnZeroPrice: true,
  /** Tipos de container e capacidade útil. Nada é fixo em código; ajuste aqui. */
  containerTypes: [
    { code: "20GP", capacityCbm: 28, maxWeightKg: 21700 },
    { code: "40GP", capacityCbm: 58, maxWeightKg: 26500 },
    { code: "40HC", capacityCbm: 68, maxWeightKg: 26500 },
  ] as Array<{ code: string; capacityCbm: number; maxWeightKg: number }>,
  /**
   * Consolidação: itens de clientes diferentes NÃO são juntados automaticamente no mesmo
   * container. Vários produtos do mesmo cliente podem compartilhar o container.
   * Só a Wellmix, manualmente, pode montar um container multi-cliente.
   */
  containerAllowMultiCustomer: false,
  /** Ocupação máxima recomendada do container (%): acima disso, aviso. */
  containerMaxOccupancyPercent: 95,
  /* ---- Segunda Onda ---- */
  /** Abre o pós-venda automaticamente quando o pedido é entregue. */
  afterSalesEnabled: true,
  /** Linha com certificação obrigatória sem certificação válida: pedido entra em revisão e exige conferência. */
  complianceGateEnabled: true,
  /** Aviso de certificação a vencer (dias). */
  certificationExpiryWarningDays: 30,
  /* ---- Visão de Produto ---- */
  /**
   * IA: AUTO usa a API quando há ANTHROPIC_API_KEY, senão modo manual (sem sugestão);
   * MOCK devolve um exemplo claramente rotulado (demonstração/testes); MANUAL desliga.
   */
  aiMode: "AUTO" as "AUTO" | "MOCK" | "MANUAL",
  /** Modelo usado na API (lido a cada chamada; nada fixo em componente). */
  aiModel: "claude-sonnet-5-5",
  /** Marketing studio e kits de marketing (prévia → oferta → compra → liberação). */
  marketingEnabled: true,
  /** Preço padrão do kit de marketing por produto (editável por kit; nunca fixo em código). */
  marketingKitDefaultPrice: 200,
  marketingKitCurrency: "BRL",
  /** Cliente em importação própria sem RADAR informado: pedido entra na fila de revisão. */
  radarGateEnabled: true,
  /**
   * Busca de produto por foto/link pausada (nova solicitação): a IA externa
   * aguarda o cartão de crédito no AI Gateway. Desmarcar em Configurações reativa.
   */
  lookupPaused: true,
  /* ---- Pagamento do sinal por Pix ---- */
  /**
   * Chave Pix da Wellmix (CPF, CNPJ, e-mail, celular +55 ou aleatória). Com chave,
   * recebedor e cidade preenchidos, o cliente vê o Pix copia e cola e o QR Code do
   * sinal. Vazia: o cliente vê só a instrução de pagamento. Configura o admin.
   */
  pixKey: "",
  /** Nome do recebedor no Pix (até 25 caracteres, como no banco). */
  pixReceiverName: "",
  /** Cidade do recebedor no Pix (até 15 caracteres). */
  pixReceiverCity: "",
  /* ---- Pagamento ao fornecedor ---- */
  /** E-mail do financeiro: destino do "pedir ao financeiro por e-mail". Vazio: escolhe na hora. */
  financeEmail: "",
  /** WhatsApp do financeiro com DDI (ex.: 5511999998888). Vazio: escolhe o contato na hora. */
  financeWhatsapp: "",
  /* ---- Preço ao cliente (custo importado + margem) ---- */
  /** Margem geral sobre o custo importado (%). Vale quando cliente e linha não têm margem própria. */
  marginPercent: 0,
  /** Margem por linha de produto (%), por id da linha. Facultativa. */
  marginByLine: {} as Record<string, number>,
  /** Margem por cliente (%), por id do parceiro. Facultativa; vence a da linha. */
  marginByCustomer: {} as Record<string, number>,
  /** Frete estimado por CBM (null = sem estimativa; o operador informa o do transportador). */
  freightPerCbm: null as number | null,
  freightCurrency: "USD",
  /** Câmbio manual (R$ por unidade), usado se a PTAX nunca foi obtida. */
  fxManualRates: { USD: null, RMB: null, EUR: null } as Record<
    "USD" | "RMB" | "EUR",
    number | null
  >,
  /** Última PTAX obtida do Banco Central (gravada pelo sistema, 1x por dia). */
  fxPtax: null as FxSnapshot | null,
  /** Última tentativa de buscar a PTAX que falhou (evita repetir a cada página). */
  fxPtaxFailedAt: null as string | null,
  /** Importadora dona da plataforma (preparação multi-importador; um só valor hoje). */
  importerName: "Wellmix",
};

/** Câmbio do dia: R$ por unidade (PTAX venda) e a data de cada cotação. */
export interface FxSnapshot {
  /** Dia (Brasília, AAAA-MM-DD) em que a busca foi feita. */
  day: string;
  fetchedAt: string;
  rates: Partial<Record<"USD" | "RMB" | "EUR", number>>;
  quotedAt: Partial<Record<"USD" | "RMB" | "EUR", string>>;
}

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export async function getSettings(): Promise<Settings> {
  const rows = await getStore().list("settings");
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in DEFAULT_SETTINGS) merged[row.key] = row.value;
  }
  return merged as Settings;
}

export async function setSetting<K extends SettingKey>(
  key: K,
  value: Settings[K],
) {
  const store = getStore();
  const [existing] = await store.list("settings", {
    filter: { key },
    limit: 1,
  });
  if (existing) await store.update("settings", existing.id, { value });
  else await store.create("settings", { key, value });
}
