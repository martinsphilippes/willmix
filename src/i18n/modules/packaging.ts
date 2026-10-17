/**
 * Dicionário do módulo "packaging" (arte e embalagem: a agência faz e envia a
 * arte, o fornecedor confere e aprova): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "packaging.waitingArt": "Aguardando a arte (agência ou Wellmix)",
  "orders.error.art_missing":
    "A arte ainda não foi enviada: o fornecedor aprova depois que ela chegar.",
};

export const en: Record<keyof typeof pt, string> = {
  "packaging.waitingArt": "Waiting for the artwork (agency or Wellmix)",
  "orders.error.art_missing":
    "The artwork has not been uploaded yet: the supplier approves it once it arrives.",
};

export const zh: Record<keyof typeof pt, string> = {
  "packaging.waitingArt": "等待设计稿（设计公司或 Wellmix）",
  "orders.error.art_missing": "设计稿尚未上传：上传后由供应商审核批准。",
};
