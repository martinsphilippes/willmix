/**
 * Dicionário do módulo "errors" (mensagens gerais de falha): mesmas chaves em
 * pt, en e zh.
 */
export const pt = {
  "common.unexpected":
    "Algo deu errado do nosso lado e a ação não foi concluída. Tente de novo; se repetir, avise o suporte da Wellmix.",
};

export const en: Record<keyof typeof pt, string> = {
  "common.unexpected":
    "Something went wrong on our side and the action was not completed. Try again; if it repeats, contact Wellmix support.",
};

export const zh: Record<keyof typeof pt, string> = {
  "common.unexpected":
    "系统出现问题，操作未完成。请重试；如果再次出现，请联系 Wellmix 支持。",
};
