/**
 * Dicionário do módulo "approvals" (aprovação do pré-custo em níveis e
 * funções da equipe Wellmix): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "approvals.error.approval_applying":
    "A escolha aprovada está sendo gravada. Aguarde alguns segundos.",
  "approvals.error.reason_required": "Escreva o motivo para reprovar.",
  "approvals.error.invalid_quote": "Essa cotação não está mais disponível.",
  "approvals.error.invalid_status":
    "A solicitação não está mais na fase de escolha do fornecedor.",
  "approvals.error.not_found": "Aprovação não encontrada.",
  "settings.approvals.title": "Aprovação do pré-custo",
  "settings.approvals.hint":
    "A escolha do fornecedor passa pelo planner e pela diretoria de compras; a partir do valor abaixo, também pela diretoria executiva. Quem decide cada nível é definido em Equipe e divisões (funções).",
  "settings.approvals.enabled": "Exigir aprovação",
  "settings.approvals.threshold": "Diretoria executiva a partir de (R$)",
  "settings.error.approval_threshold_invalid":
    "Informe um valor em reais (0 ou mais).",
  "function.buyer": "Comprador",
  "function.product_manager": "Gerente de produto",
  "function.planner": "Planner",
  "function.catalog": "Cadastro",
  "function.finance": "Financeiro",
  "function.purchasing_director": "Diretoria de compras",
  "function.executive_director": "Diretoria executiva",
  "team.col.functions": "Funções",
};

export const en: Record<keyof typeof pt, string> = {
  "approvals.error.approval_applying":
    "The approved choice is being saved. Wait a few seconds.",
  "approvals.error.reason_required": "Write the reason to reject.",
  "approvals.error.invalid_quote": "This quote is no longer available.",
  "approvals.error.invalid_status":
    "The request is no longer in the supplier choice phase.",
  "approvals.error.not_found": "Approval not found.",
  "settings.approvals.title": "Pre-cost approval",
  "settings.approvals.hint":
    "The supplier choice goes through the planner and the purchasing director; from the amount below, also the executive director. Who decides each level is set in Team and divisions (functions).",
  "settings.approvals.enabled": "Require approval",
  "settings.approvals.threshold": "Executive director from (BRL)",
  "settings.error.approval_threshold_invalid":
    "Enter an amount in BRL (0 or more).",
  "function.buyer": "Buyer",
  "function.product_manager": "Product manager",
  "function.planner": "Planner",
  "function.catalog": "Catalog",
  "function.finance": "Finance",
  "function.purchasing_director": "Purchasing director",
  "function.executive_director": "Executive director",
  "team.col.functions": "Functions",
};

export const zh: Record<keyof typeof pt, string> = {
  "approvals.error.approval_applying": "已批准的选择正在保存中，请稍候几秒。",
  "approvals.error.reason_required": "驳回请填写原因。",
  "approvals.error.invalid_quote": "该报价已不可用。",
  "approvals.error.invalid_status": "该需求已不在选择供应商阶段。",
  "approvals.error.not_found": "未找到审批。",
  "settings.approvals.title": "预成本审批",
  "settings.approvals.hint":
    "供应商选择需经计划员和采购总监审批；超过下列金额还需执行总监审批。各级审批人在“团队与事业部”（职能）中设置。",
  "settings.approvals.enabled": "需要审批",
  "settings.approvals.threshold": "执行总监审批起点（雷亚尔）",
  "settings.error.approval_threshold_invalid": "请输入雷亚尔金额（0 或以上）。",
  "function.buyer": "采购员",
  "function.product_manager": "产品经理",
  "function.planner": "计划员",
  "function.catalog": "建档",
  "function.finance": "财务",
  "function.purchasing_director": "采购总监",
  "function.executive_director": "执行总监",
  "team.col.functions": "职能",
};
