/**
 * Dicionário do módulo "rfq-standby" (RFQ em espera, docs/RFQ_STANDBY.md): a
 * tela Pedidos → RFQ e o cartão "Enviar ao fornecedor" da solicitação.
 * Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.rfq": "RFQ (em espera)",
  "rfqStandby.switch.title": "Ligar ou deixar em espera",
  "pricing.error.rfq_standby_one":
    "A RFQ para vários fornecedores está em espera: escolha um fornecedor só.",
  "pricing.error.rfq_standby_sent":
    "Este produto já foi enviado a outro fornecedor. A RFQ para vários fornecedores está em espera.",
  "reqBatch.error.rfq_standby_one":
    "A RFQ para vários fornecedores está em espera: escolha um fornecedor só.",
  "reqBatch.error.rfq_standby_sent":
    "Há produto deste lote já enviado a outro fornecedor. A RFQ para vários fornecedores está em espera.",
};

export const en: Record<keyof typeof pt, string> = {
  "nav.rfq": "RFQ (on hold)",
  "rfqStandby.switch.title": "Turn on or keep on hold",
  "pricing.error.rfq_standby_one":
    "The RFQ to several suppliers is on hold: choose one supplier only.",
  "pricing.error.rfq_standby_sent":
    "This product was already sent to another supplier. The RFQ to several suppliers is on hold.",
  "reqBatch.error.rfq_standby_one":
    "The RFQ to several suppliers is on hold: choose one supplier only.",
  "reqBatch.error.rfq_standby_sent":
    "A product in this batch was already sent to another supplier. The RFQ to several suppliers is on hold.",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.rfq": "询价（暂停）",
  "rfqStandby.switch.title": "启用或保持暂停",
  "pricing.error.rfq_standby_one":
    "向多家供应商询价的功能已暂停：请只选择一家供应商。",
  "pricing.error.rfq_standby_sent":
    "此产品已发送给另一家供应商。向多家供应商询价的功能已暂停。",
  "reqBatch.error.rfq_standby_one":
    "向多家供应商询价的功能已暂停：请只选择一家供应商。",
  "reqBatch.error.rfq_standby_sent":
    "该批次中有产品已发送给另一家供应商。向多家供应商询价的功能已暂停。",
};
