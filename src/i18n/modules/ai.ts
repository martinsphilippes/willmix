/*
 * Motivos de falha da IA (src/lib/integrations/ai.ts → AiErrorCode), mostrados
 * à Wellmix no Testar IA, na busca por foto e nas sugestões. `pt` é a fonte.
 */
export const pt = {
  "ai.error.card_required":
    "A IA está aguardando o cadastro de um cartão de crédito na conta da Vercel (AI Gateway). Um administrador precisa adicionar o cartão no painel da Vercel para liberar os créditos.",
  "ai.error.unauthorized":
    "A IA recusou a credencial: a chave ou o token do projeto não é válido ou não tem permissão.",
  "ai.error.no_credit":
    "Os créditos da IA acabaram. Adicione créditos na conta da Vercel (AI Gateway) ou da Anthropic.",
  "ai.error.rate_limited":
    "A IA recebeu chamadas demais em pouco tempo. Tente de novo em alguns instantes.",
  "ai.error.model_not_found":
    "O modelo de IA configurado não existe. Ajuste o campo aiModel nas configurações.",
  "ai.error.timeout": "A IA demorou demais para responder. Tente de novo.",
  "ai.error.service_down":
    "O serviço de IA está fora do ar no momento. Tente de novo mais tarde.",
  "ai.error.unknown":
    "A IA não respondeu por um motivo não identificado. Veja os logs da função na Vercel.",
};
export const en: Record<keyof typeof pt, string> = {
  "ai.error.card_required":
    "AI is waiting for a credit card to be added to the Vercel account (AI Gateway). An administrator must add the card in the Vercel dashboard to unlock the credits.",
  "ai.error.unauthorized":
    "AI rejected the credential: the key or project token is invalid or not allowed.",
  "ai.error.no_credit":
    "AI credits ran out. Add credits to the Vercel (AI Gateway) or Anthropic account.",
  "ai.error.rate_limited":
    "AI received too many calls in a short time. Try again in a moment.",
  "ai.error.model_not_found":
    "The configured AI model does not exist. Adjust the aiModel field in settings.",
  "ai.error.timeout": "AI took too long to answer. Try again.",
  "ai.error.service_down":
    "The AI service is down at the moment. Try again later.",
  "ai.error.unknown":
    "AI did not answer for an unidentified reason. Check the function logs on Vercel.",
};
export const zh: Record<keyof typeof pt, string> = {
  "ai.error.card_required":
    "AI 正在等待在 Vercel 账户（AI Gateway）中添加信用卡。管理员需要在 Vercel 控制台添加信用卡以解锁额度。",
  "ai.error.unauthorized": "AI 拒绝了凭证：密钥或项目令牌无效或没有权限。",
  "ai.error.no_credit":
    "AI 额度已用完。请在 Vercel（AI Gateway）或 Anthropic 账户中充值。",
  "ai.error.rate_limited": "短时间内调用 AI 过多，请稍后再试。",
  "ai.error.model_not_found":
    "配置的 AI 模型不存在。请在设置中调整 aiModel 字段。",
  "ai.error.timeout": "AI 响应超时，请重试。",
  "ai.error.service_down": "AI 服务暂时不可用，请稍后再试。",
  "ai.error.unknown": "AI 因未知原因未响应。请查看 Vercel 上的函数日志。",
};
