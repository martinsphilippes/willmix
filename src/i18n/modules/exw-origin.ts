/**
 * Compra EXW (mapa R17?, R17 e R18; docs/ORIGIN_CONTAINER.md): transportadora
 * na origem e custos de origem (POP). Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "importFlow.step.origin_carrier": "Transportadora contratada na origem (EXW)",
  "importFlow.step.origin_carrier_eta":
    "Previsão do container no depósito da fábrica (EXW)",
  "importFlow.step.origin_costs":
    "Custos do transporte na origem (POP): valor, moeda e comprovante",
  "importFlow.ph.origin_carrier": "Nome da transportadora",
  "importFlow.costCurrency": "Moeda",
  "exw.title": "Incoterm do pedido",
  "exw.hint":
    "EXW quando algum produto do pedido é EXW: a trading contrata a transportadora e registra os custos de origem antes do container chegar à fábrica. FOB: o container vai direto ao depósito da fábrica.",
  "exw.save": "Salvar",
  "exw.saved": "Incoterm do pedido salvo.",
  "exw.originCost": "Custos de origem (POP) validados",
};

export const en: Record<keyof typeof pt, string> = {
  "importFlow.step.origin_carrier": "Carrier hired at origin (EXW)",
  "importFlow.step.origin_carrier_eta":
    "Expected container at the factory depot (EXW)",
  "importFlow.step.origin_costs":
    "Origin transport costs (POP): amount, currency and proof",
  "importFlow.ph.origin_carrier": "Carrier name",
  "importFlow.costCurrency": "Currency",
  "exw.title": "Order incoterm",
  "exw.hint":
    "EXW when any product of the order is EXW: the trading company hires the carrier and records the origin costs before the container reaches the factory. FOB: the container goes straight to the factory depot.",
  "exw.save": "Save",
  "exw.saved": "Order incoterm saved.",
  "exw.originCost": "Validated origin costs (POP)",
};

export const zh: Record<keyof typeof pt, string> = {
  "importFlow.step.origin_carrier": "起运地已委托拖车公司（EXW）",
  "importFlow.step.origin_carrier_eta": "集装箱预计到达工厂堆场（EXW）",
  "importFlow.step.origin_costs": "起运地运输费用（POP）：金额、币种和凭证",
  "importFlow.ph.origin_carrier": "拖车公司名称",
  "importFlow.costCurrency": "币种",
  "exw.title": "订单贸易术语",
  "exw.hint":
    "订单中任一产品为 EXW 时为 EXW：贸易商委托拖车公司并在集装箱到达工厂前登记起运地费用。FOB：集装箱直接到工厂堆场。",
  "exw.save": "保存",
  "exw.saved": "订单贸易术语已保存。",
  "exw.originCost": "已核实的起运地费用（POP）",
};
