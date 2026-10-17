/**
 * Dicionário do módulo "packaging" (arte e embalagem: a agência faz e envia a
 * arte, o fornecedor confere e aprova): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "packaging.waitingArt": "Aguardando a arte (agência ou Wellmix)",
  "orders.error.art_missing":
    "A arte ainda não foi enviada: o fornecedor aprova depois que ela chegar.",
  "orders.error.already_decided":
    "Esta aprovação já foi decidida; só a Wellmix pode refazer.",
  // Pedidos antigos (arte aprovada pela agência): o histórico continua certo.
  "req.art_approval.agency": "Aprovação da arte pela agência",
};

export const en: Record<keyof typeof pt, string> = {
  "packaging.waitingArt": "Waiting for the artwork (agency or Wellmix)",
  "orders.error.art_missing":
    "The artwork has not been uploaded yet: the supplier approves it once it arrives.",
  "orders.error.already_decided":
    "This approval was already decided; only Wellmix can redo it.",
  "req.art_approval.agency": "Artwork approval by agency",
};

export const zh: Record<keyof typeof pt, string> = {
  "packaging.waitingArt": "等待设计稿（设计公司或 Wellmix）",
  "orders.error.art_missing": "设计稿尚未上传：上传后由供应商审核批准。",
  "orders.error.already_decided":
    "该审批已作出决定；只有 Wellmix 可以重新处理。",
  "req.art_approval.agency": "设计公司审核设计稿",
};
