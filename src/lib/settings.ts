import "server-only";

import { DEFAULT_SUPERPLAN, type SuperplanParams } from "@/lib/superplan";

import { getStore } from "@/lib/db";

/**
 * Decisões em aberto parametrizadas (docs/OPEN_DECISIONS.md).
 * Valores padrão aqui; sobrescritos pela tabela `settings` (tela de configurações).
 */
export const DEFAULT_SETTINGS = {
  customerCanCreateRequest: true,
  /**
   * Sourcing (visitas, itens encontrados, sourcing sob demanda). Em espera
   * por decisão do dono (10/11/2026): os produtos chegam pela
   * ficha técnica do Booking. Em espera, o pedido de produto fora do
   * catálogo vira só a solicitação (sem item de Sourcing nem pendência). As
   * telas e os dados ficam; volta ao ligar na tela Pedidos → Sourcing.
   */
  sourcingEnabled: false,
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
  /** SLA de resposta da cotação: dias úteis para a Wellmix responder uma solicitação. */
  quoteSlaBusinessDays: 5,
  /**
   * SLA da negociação com o fornecedor, em minutos: da abertura da
   * solicitação ao fornecedor até a decisão da Wellmix. Estourado, a
   * solicitação fica "Atrasada" e a Wellmix e o fornecedor são avisados
   * (docs/SUPPLIER_REQUESTS.md, "SLA da negociação").
   */
  supplierRequestSlaMinutes: 30,
  /**
   * SLA do convite para booking concorrente, em dias corridos: do convite ao
   * prazo para o parceiro subir o booking (docs/BOOKING_INVITES.md).
   */
  bookingInviteSlaDays: 1,
  /**
   * SLA da amostragem, em dias corridos: da aprovação da solicitação (ou da
   * reprovação da amostra) até o responsável enviar as fotos e vídeos
   * (docs/SUPPLIER_SAMPLING.md). Decisão do dono (12/11/2026): 1 dia.
   */
  samplingSlaDays: 1,
  /* ---- Pedido de compra das solicitações ao fornecedor (docs/PURCHASE_ORDER.md) ---- */
  /** Dias da agência de arte para enviar a arte de cada produto, desde o pedido. */
  purchaseArtSlaDays: 5,
  /** Dias da Wellmix para validar a arte (aprovar ou devolver), desde o envio. */
  purchaseArtReviewSlaDays: 2,
  /*
   * Prazos dos outros passos do pedido de compra (mapa do processo), em dias
   * corridos, cada um contado da liberação do passo (o anterior concluído).
   */
  /** Fornecedor: faca, foto em alta, MOQ e prazo de produção, desde o pedido. */
  purchaseDieCutSlaDays: 7,
  /** Certificadora: certificado do produto, desde o pedido. */
  purchaseCertSlaDays: 15,
  /** Quem faz a arte: arte final com o selo, desde a arte validada e o certificado. */
  purchaseArtFinalSlaDays: 3,
  /** Cadastro e fiscal: NCM validado e ficha mestre completa, desde o pedido. */
  purchaseRegistrationSlaDays: 3,
  /** Cada assinatura do contrato (Wellmix, depois o fornecedor). */
  purchaseSignatureSlaDays: 2,
  /** Financeiro: sinal pago ao fornecedor, desde as duas assinaturas. */
  purchaseDownPaymentSlaDays: 3,
  /** Fornecedor: fotos, vídeo e declaração de conformidade, desde o início da produção (mapa R3). */
  purchaseInspectionMediaSlaDays: 7,
  /** Wellmix: aprovar os SKUs, desde a declaração do fornecedor. */
  purchaseInspectionReviewSlaDays: 2,
  /**
   * Tentativas de aprovação na inspeção (mapa R10): até aqui, cada
   * reprovação soma 1 dia ao ETD e volta à produção; na seguinte, a Wellmix
   * confirma o cancelamento do pedido (dono, 13/11/2026).
   */
  purchaseInspectionMaxAttempts: 3,
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
  /**
   * Início da produção: dias depois do contrato assinado (documento do pedido
   * com as duas assinaturas). A data entra sozinha na programação de compra
   * e no acompanhamento da produção; ninguém digita.
   */
  productionStartDays: 0,
  /**
   * LPCO (mapa E5; dono, 14/11/2026): prefixos de NCM que exigem a licença
   * (separados por vírgula ou espaço). O passo LPCO aparece só no pedido com
   * produto de NCM que começa por um deles; vazio, em nenhum.
   */
  lpcoNcmPrefixes: "",
  /**
   * O mesmo prazo, por fornecedor (id do fornecedor → dias): quem tem valor
   * aqui usa o dele; os outros, o padrão acima. Só o administrador grava,
   * no cadastro do fornecedor.
   */
  productionStartDaysBySupplier: {} as Record<string, number>,
  /**
   * Fatura ativa (mapa R24): dias depois dos documentos do embarque
   * conferidos (BL bate com a invoice) para o faturamento vencer. Padrão
   * para fornecedor sem prazo próprio.
   */
  invoiceDays: 0,
  /** O mesmo prazo, por fornecedor (id → dias); só o administrador grava. */
  invoiceDaysBySupplier: {} as Record<string, number>,
  /**
   * Transportadora padrão pelo porto de chegada (mapa E12? a E14; dono,
   * 14/11/2026): Itapoá → West Log; os demais portos → Edual. O nome é o do
   * cadastro da transportadora; no pedido, "Contratar" a designa.
   */
  carrierItapoaName: "West Log",
  carrierDefaultName: "Edual",
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
  /**
   * Período do pedido (dias): a certificação do produto precisa valer até
   * lá para o pedido de compra não pedir outra à certificadora (mapa do
   * processo, P8; no quadro, cerca de 4 meses).
   */
  certificationHorizonDays: 120,
  /* ---- Visão de Produto ---- */
  /**
   * IA: AUTO usa a API quando há ANTHROPIC_API_KEY, senão modo manual (sem sugestão);
   * MOCK devolve um exemplo claramente rotulado (demonstração/testes); MANUAL desliga.
   */
  aiMode: "AUTO" as "AUTO" | "MOCK" | "MANUAL",
  /** Modelo usado na API (lido a cada chamada; nada fixo em componente). */
  aiModel: "claude-sonnet-5-5",
  /*
   * Referências por IA na escolha do grupo (docs/SUPPLIER_REQUESTS.md,
   * "Referências por IA"): os três prompts padrão (editáveis em cada escolha)
   * e os modelos da OpenAI. Precisa de OPENAI_API_KEY; aiMode MOCK gera
   * exemplos rotulados e MANUAL desliga.
   */
  aiPromptProduct:
    "Foto de estúdio realista do produto como deve ficar ao final da produção: fundo branco, luz suave, vista de três quartos, mostrando forma, material, cores e acabamento. Sem texto, sem marca e sem logotipo que não estejam pedidos.",
  aiPromptDetail:
    "Imagem realista com os detalhes de acabamento e a embalagem do produto ao final da produção: close nas partes que o fornecedor precisa caprichar (encaixes, costuras, tampa, alça, cor) e o produto ao lado da embalagem individual. Fundo neutro, sem texto.",
  aiPromptSheet:
    "Escreva uma ficha de produção curta para o fornecedor, em inglês e depois em chinês simplificado: descrição do produto, material, cores, medidas e capacidade, acabamento, embalagem e o que a Wellmix precisa. Use tópicos. Não invente números: o que não estiver nos dados fica como 'to be confirmed'.",
  /** Modelo de imagem da OpenAI (gera as duas imagens aproximadas). */
  openaiImageModel: "gpt-image-1",
  /** Modelo de texto da OpenAI (escreve a ficha). */
  openaiTextModel: "gpt-5-mini",
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
  /** Frete marítimo estimado por CBM (null = sem estimativa; o operador informa o da companhia marítima). */
  freightPerCbm: null as number | null,
  freightCurrency: "USD",
  /**
   * Destino do tarifário que dá o frete por m³ (NVT, ITJ...): o último que o
   * admin usou no tarifário. Vazio = Navegantes (ou o 1º destino). Gravado
   * pelo tarifário, não pelo formulário das Configurações.
   */
  freightTariffDestination: "",
  /** Última atualização automática do frete por m³ pelo tarifário. Gravada pelo sistema. */
  freightPerCbmAuto: null as FreightPerCbmAuto | null,
  /** Câmbio manual (R$ por unidade), usado se a PTAX nunca foi obtida. */
  fxManualRates: { USD: null, RMB: null, EUR: null } as Record<
    "USD" | "RMB" | "EUR",
    number | null
  >,
  /** Última PTAX obtida do Banco Central (gravada pelo sistema, 1x por dia). */
  fxPtax: null as FxSnapshot | null,
  /** Última tentativa de buscar a PTAX que falhou (evita repetir a cada página). */
  fxPtaxFailedAt: null as string | null,
  /** Motivo da última busca de câmbio que falhou (por fonte). */
  fxLastError: null as string | null,
  /* ---- Tributos da importação (custo importado) ---- */
  /** Seguro internacional (% do FOB); entra no valor aduaneiro. 0 = sem seguro. */
  insurancePercent: 0,
  /** PIS-importação e COFINS-importação: alíquotas gerais (Lei 10.865/2004, art. 8º). */
  pisImportPercent: 2.1,
  cofinsImportPercent: 9.65,
  /** ICMS da importação (% do estado do desembaraço). null = não configurado. */
  icmsPercent: null as number | null,
  /** Tabela fiscal carregada (TEC + TIPI): arquivo e situação de cada parte. Gravada pelo sistema. */
  fiscalTable: null as FiscalTableMeta | null,
  /** Links oficiais da planilha da TEC e da TIPI, para o robô mensal (vazio = só upload). */
  fiscalTecUrl: "",
  fiscalTipiUrl: "",
  /** Motivo da última atualização automática que falhou. Gravado pelo sistema. */
  fiscalLastError: null as string | null,
  /** Importadora dona da plataforma (preparação multi-importador; um só valor hoje). */
  importerName: "Wellmix",
  /* ---- Superplan (docs/SUPERPLAN.md) ---- */
  /**
   * Tipos de negócio, despesas padrão por container, fretes, câmbio e impostos
   * da venda do Superplan. Gravado pela tela do Superplan (só admin); lido
   * sempre com superplanParams(), que completa o que faltar.
   */
  superplan: DEFAULT_SUPERPLAN as SuperplanParams,
};

/**
 * Frete por m³ refeito a cada planilha de frete importada: aplicado, ou
 * segurado (variação grande demais) / sem cálculo, com o motivo.
 */
export interface FreightPerCbmAuto {
  at: string;
  status: "applied" | "held" | "skipped";
  /** Por que não aplicou: "jump" (variação acima do limite), "no_capacity", "no_rates". */
  reason: string | null;
  destination: string | null;
  /** Valor calculado (R$ por m³) e o que estava antes. */
  perCbm: number | null;
  previous: number | null;
  previousCurrency: string | null;
  /** Planilha que disparou a conta. */
  tariffId: string;
}

/** Uma parte da tabela fiscal (TEC ou TIPI): quando, quantos NCMs e de onde veio. */
export interface FiscalPartMeta {
  updatedAt: string;
  count: number;
  fileName: string;
  source: "upload" | "robot";
}

/** Tabela fiscal: arquivo JSON no armazenamento + situação da TEC e da TIPI. */
export interface FiscalTableMeta {
  fileKey: string;
  tec: FiscalPartMeta | null;
  tipi: FiscalPartMeta | null;
}

/** Câmbio do dia: R$ por unidade (PTAX venda) e a data de cada cotação. */
export interface FxSnapshot {
  /** Dia (Brasília, AAAA-MM-DD) em que a busca foi feita. */
  day: string;
  fetchedAt: string;
  rates: Partial<Record<"USD" | "RMB" | "EUR", number>>;
  quotedAt: Partial<Record<"USD" | "RMB" | "EUR", string>>;
  /** De onde veio: PTAX do Banco Central ou AwesomeAPI (reserva). */
  source?: "ptax" | "awesomeapi" | "ecb";
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

/**
 * Valor guardado em `settings` fora das Configurações da tela (ex.: o marcador
 * dos resumos dos pedidos, docs/RESUMOS.md). `getSettings` ignora essas chaves.
 */
export async function setRawSetting(key: string, value: unknown) {
  const store = getStore();
  const [existing] = await store.list("settings", {
    filter: { key },
    limit: 1,
  });
  if (existing) await store.update("settings", existing.id, { value });
  else await store.create("settings", { key, value });
}
