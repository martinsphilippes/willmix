/**
 * Dicionário do módulo "sla" (prazo de resposta da cotação definido pela
 * Wellmix): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "sla.customerHint":
    "Prazo definido pela Wellmix: resposta da cotação em até {days} dias úteis.",
  "sla.wellmixHint":
    "Padrão do SLA: {days} dias úteis. Pode ajustar só para esta solicitação.",
  "sla.settings.title": "SLA de resposta da cotação",
  "sla.settings.hint":
    "Preenche o prazo de resposta de toda nova solicitação (dias úteis, segunda a sexta). O cliente vê o prazo e não pode alterar; a Wellmix pode ajustar uma solicitação específica.",
  "sla.settings.days": "Dias úteis para responder",
  "settings.error.quote_sla_invalid":
    "O SLA deve ser um número inteiro de 1 a 60 dias úteis.",
};

export const en: Record<keyof typeof pt, string> = {
  "sla.customerHint":
    "Deadline set by Wellmix: quote answered within {days} business days.",
  "sla.wellmixHint":
    "SLA default: {days} business days. You can adjust it for this request only.",
  "sla.settings.title": "Quote response SLA",
  "sla.settings.hint":
    "Sets the response deadline of every new request (business days, Monday to Friday). Customers see the deadline and cannot change it; Wellmix can adjust a specific request.",
  "sla.settings.days": "Business days to respond",
  "settings.error.quote_sla_invalid":
    "The SLA must be a whole number from 1 to 60 business days.",
};

export const zh: Record<keyof typeof pt, string> = {
  "sla.customerHint": "Wellmix 设定的期限：在 {days} 个工作日内回复报价。",
  "sla.wellmixHint": "SLA 默认：{days} 个工作日。可仅针对此需求进行调整。",
  "sla.settings.title": "报价回复 SLA",
  "sla.settings.hint":
    "为每个新需求设定回复期限（工作日，周一至周五）。客户可以看到期限但不能修改；Wellmix 可以调整特定需求。",
  "sla.settings.days": "回复所需工作日",
  "settings.error.quote_sla_invalid": "SLA 必须是 1 到 60 之间的整数工作日。",
};
