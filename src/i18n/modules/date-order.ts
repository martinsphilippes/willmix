/**
 * Dicionário do módulo "date-order" (datas do pedido em ordem: a previsão de
 * chegada só depois da data de embarque, e nunca antes dela): mesmas chaves
 * em pt, en e zh.
 */
export const pt = {
  "orders.waiting.ship_date_first": "Aguardando a data de embarque",
  "orders.error.ship_date_first":
    "Informe primeiro a data de embarque: a previsão de chegada é conferida com ela.",
  // Aviso de data fora do limite com a data de referência.
  "orders.error.boundWithDate": "{text} ({date}).",
  "containers.error.eta_before_etd":
    "A chegada prevista (ETA) não pode ser antes da saída prevista (ETD).",
};

export const en: Record<keyof typeof pt, string> = {
  "orders.waiting.ship_date_first": "Waiting for the shipping date",
  "orders.error.ship_date_first":
    "Enter the shipping date first: the estimated arrival is checked against it.",
  "orders.error.boundWithDate": "{text} ({date}).",
  "containers.error.eta_before_etd":
    "The estimated arrival (ETA) cannot be before the estimated departure (ETD).",
};

export const zh: Record<keyof typeof pt, string> = {
  "orders.waiting.ship_date_first": "等待装船日期",
  "orders.error.ship_date_first": "请先填写装船日期：预计到港日期需与其核对。",
  "orders.error.boundWithDate": "{text}（{date}）。",
  "containers.error.eta_before_etd": "预计到达（ETA）不能早于预计离港（ETD）。",
};
