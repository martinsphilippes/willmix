/**
 * Dicionário do módulo "inspection-report" (relatório da inspeção no pedido:
 * medidas, comparação, fotos, decisão e linha do tempo): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "inspReport.outcome.waiting": "Aguardando medidas",
  "inspReport.outcome.approved": "Aprovada",
  "inspReport.outcome.accepted": "Aprovada com divergência aceita",
  "inspReport.outcome.divergent": "Divergente: aguardando decisão",
  "inspReport.outcome.remeasure": "Nova medição solicitada",
  "inspReport.measures": "O que o fornecedor mediu",
  "inspReport.noMeasures": "Nenhuma medida enviada ainda.",
  "inspReport.noReference":
    "Sem ficha de compra nem snapshot: as medidas aparecem, mas não há com o que comparar.",
  "inspReport.noExpected": "Sem referência",
  "inspReport.awaitingRemeasure": "Aguardando nova medição",
  "inspReport.photos": "Fotos da inspeção",
  "inspReport.decision": "Decisão da Wellmix",
  "inspReport.decision.approved": "Divergência aceita",
  "inspReport.decision.auto":
    "Liberada automaticamente: nova medição dentro da tolerância",
  "inspReport.decision.rejected": "Reprovada: nova medição solicitada",
  "inspReport.decision.pending": "Aguardando decisão",
  "inspReport.decision.none":
    "Sem divergência: nenhuma decisão foi necessária.",
  "inspReport.divergences": "Divergências registradas",
  "inspReport.noDivergences": "Nenhuma divergência registrada.",
  "inspReport.resolvedBy": "Resolvido por",
  "inspReport.timeline": "Linha do tempo",
  "inspReport.event.requirement.submit": "Enviado",
  "inspReport.event.requirement.approve": "Aprovado",
  "inspReport.event.requirement.reject": "Reprovado",
  "inspReport.event.inspection.divergence": "Divergência detectada",
  "inspReport.event.inspection.remeasure_requested": "Nova medição solicitada",
  "inspReport.event.stage.unblock": "Etapa liberada manualmente",
  "inspReport.event.stage.complete": "Inspeção concluída",
  "inspReport.hint":
    "Comparação do que o fornecedor encontrou com o que foi comprado (ficha de compra e snapshot), usando as tolerâncias das configurações. O fornecedor não vê os valores esperados.",
};

export const en: Record<keyof typeof pt, string> = {
  "inspReport.outcome.waiting": "Waiting for measurements",
  "inspReport.outcome.approved": "Approved",
  "inspReport.outcome.accepted": "Approved with accepted divergence",
  "inspReport.outcome.divergent": "Divergent: waiting for decision",
  "inspReport.outcome.remeasure": "New measurement requested",
  "inspReport.measures": "What the supplier measured",
  "inspReport.noMeasures": "No measurements sent yet.",
  "inspReport.noReference":
    "No purchase sheet or snapshot: measurements are shown, but there is nothing to compare them with.",
  "inspReport.noExpected": "No reference",
  "inspReport.awaitingRemeasure": "Waiting for new measurement",
  "inspReport.photos": "Inspection photos",
  "inspReport.decision": "Wellmix decision",
  "inspReport.decision.approved": "Divergence accepted",
  "inspReport.decision.auto":
    "Released automatically: new measurement within tolerance",
  "inspReport.decision.rejected": "Rejected: new measurement requested",
  "inspReport.decision.pending": "Waiting for decision",
  "inspReport.decision.none": "No divergence: no decision was needed.",
  "inspReport.divergences": "Recorded divergences",
  "inspReport.noDivergences": "No divergence recorded.",
  "inspReport.resolvedBy": "Resolved by",
  "inspReport.timeline": "Timeline",
  "inspReport.event.requirement.submit": "Sent",
  "inspReport.event.requirement.approve": "Approved",
  "inspReport.event.requirement.reject": "Rejected",
  "inspReport.event.inspection.divergence": "Divergence detected",
  "inspReport.event.inspection.remeasure_requested":
    "New measurement requested",
  "inspReport.event.stage.unblock": "Stage released manually",
  "inspReport.event.stage.complete": "Inspection completed",
  "inspReport.hint":
    "Comparison of what the supplier found with what was purchased (purchase sheet and snapshot), using the tolerances in settings. The supplier does not see the expected values.",
};

export const zh: Record<keyof typeof pt, string> = {
  "inspReport.outcome.waiting": "等待测量",
  "inspReport.outcome.approved": "已通过",
  "inspReport.outcome.accepted": "已通过（差异已接受）",
  "inspReport.outcome.divergent": "有差异：等待决定",
  "inspReport.outcome.remeasure": "已要求重新测量",
  "inspReport.measures": "供应商测量结果",
  "inspReport.noMeasures": "尚未提交任何测量。",
  "inspReport.noReference": "没有采购单或快照：显示测量值，但无可比较的参考。",
  "inspReport.noExpected": "无参考",
  "inspReport.awaitingRemeasure": "等待重新测量",
  "inspReport.photos": "验货照片",
  "inspReport.decision": "Wellmix 决定",
  "inspReport.decision.approved": "差异已接受",
  "inspReport.decision.auto": "自动放行：重新测量在容差范围内",
  "inspReport.decision.rejected": "已驳回：要求重新测量",
  "inspReport.decision.pending": "等待决定",
  "inspReport.decision.none": "无差异：无需决定。",
  "inspReport.divergences": "已记录的差异",
  "inspReport.noDivergences": "没有记录的差异。",
  "inspReport.resolvedBy": "处理人",
  "inspReport.timeline": "时间线",
  "inspReport.event.requirement.submit": "已提交",
  "inspReport.event.requirement.approve": "已批准",
  "inspReport.event.requirement.reject": "已驳回",
  "inspReport.event.inspection.divergence": "发现差异",
  "inspReport.event.inspection.remeasure_requested": "已要求重新测量",
  "inspReport.event.stage.unblock": "阶段已手动放行",
  "inspReport.event.stage.complete": "验货完成",
  "inspReport.hint":
    "将供应商的测量结果与采购内容（采购单和快照）进行比较，使用设置中的容差。供应商看不到预期值。",
};
