/**
 * Dicionário do módulo "go-live" (Configurações → Go-live; docs/SANKHYA.md,
 * "Histórico em espera"): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "goLive.link": "Go-live",
  "goLive.title": "Go-live do histórico do Sankhya",
  "goLive.subtitle":
    "Até o go-live, os pedidos da carga do histórico do Sankhya ficam em espera: aparecem em Pedidos, mas não geram pendências, lembretes nem SLA. O go-live libera tudo de uma vez.",
  "goLive.status": "Em espera agora",
  "goLive.orders": "Pedidos",
  "goLive.stages": "Etapas",
  "goLive.requirements": "Pendências",
  "goLive.warning":
    "Antes, traga a situação real de cada pedido do Sankhya. Depois do go-live, as etapas abertas desses pedidos voltam para Pendências e os lembretes de prazo voltam a valer. Não dá para voltar pela tela.",
  "goLive.confirm":
    "Confirmo que a situação dos pedidos do histórico já está atualizada e quero liberar as pendências.",
  "goLive.start": "Fazer o go-live",
  "goLive.starting": "Liberando…",
  "goLive.running": "Liberando em partes",
  "goLive.progress": "{processed} de {total} registros liberados",
  "goLive.runningHint":
    "Deixe a tela aberta até terminar. Se fechar, a liberação para onde estava e continua quando você voltar aqui.",
  "goLive.stepError": "A rodada falhou: {detail}",
  "goLive.done": "Go-live concluído em {when}. Nada mais está em espera.",
  "goLive.empty": "Nenhum pedido em espera.",
  "goLive.rebuild": "Reconstruir os resumos dos pedidos",
  "goLive.error": "Não foi possível fazer o go-live: {detail}",
  "goLive.error.confirm": "Marque a confirmação para fazer o go-live.",
  "goLive.held.title":
    "Histórico do Sankhya: atividade em aberto ({n} pedidos)",
  "goLive.held.hint":
    "Pendências da atividade em aberto dos pedidos do histórico, em espera até o go-live. São trabalhadas como as outras, mas não geram avisos e ficam fora das bolinhas do menu e do SLA.",
  "goLive.held.empty": "Nenhuma pendência sua nesta página do histórico.",
  "goLive.held.page": "Página {page} de {pages}",
  "goLive.held.prev": "Anterior",
  "goLive.held.next": "Próxima",
  "goLive.held.open": "Abrir",
};

export const en: Record<keyof typeof pt, string> = {
  "goLive.link": "Go-live",
  "goLive.title": "Sankhya history go-live",
  "goLive.subtitle":
    "Until go-live, orders from the Sankhya history load are on hold: they show in Orders but create no tasks, reminders or SLA. Go-live releases them all at once.",
  "goLive.status": "On hold now",
  "goLive.orders": "Orders",
  "goLive.stages": "Stages",
  "goLive.requirements": "Tasks",
  "goLive.warning":
    "First, bring each order's real status from Sankhya. After go-live, the open stages of these orders return to Tasks and due-date reminders apply again. This cannot be undone from this screen.",
  "goLive.confirm":
    "I confirm the status of the history orders is up to date and I want to release their tasks.",
  "goLive.start": "Go live",
  "goLive.starting": "Releasing…",
  "goLive.running": "Releasing in parts",
  "goLive.progress": "{processed} of {total} records released",
  "goLive.runningHint":
    "Keep this screen open until it finishes. If you close it, the release stops where it was and resumes when you come back.",
  "goLive.stepError": "The round failed: {detail}",
  "goLive.done": "Go-live finished at {when}. Nothing is on hold anymore.",
  "goLive.empty": "No orders on hold.",
  "goLive.rebuild": "Rebuild order summaries",
  "goLive.error": "Go-live failed: {detail}",
  "goLive.error.confirm": "Tick the confirmation to go live.",
  "goLive.held.title": "Sankhya history: open activity ({n} orders)",
  "goLive.held.hint":
    "Tasks of the open activity of the history orders, on hold until go-live. They are worked like the others, but send no alerts and stay out of the menu badges and SLA.",
  "goLive.held.empty": "No tasks of yours on this history page.",
  "goLive.held.page": "Page {page} of {pages}",
  "goLive.held.prev": "Previous",
  "goLive.held.next": "Next",
  "goLive.held.open": "Open",
};

export const zh: Record<keyof typeof pt, string> = {
  "goLive.link": "正式上线",
  "goLive.title": "Sankhya 历史数据正式上线",
  "goLive.subtitle":
    "正式上线前，Sankhya 历史导入的订单处于暂停状态：在订单中可见，但不产生待办、提醒或 SLA。正式上线会一次性全部释放。",
  "goLive.status": "当前暂停",
  "goLive.orders": "订单",
  "goLive.stages": "阶段",
  "goLive.requirements": "待办",
  "goLive.warning":
    "请先从 Sankhya 同步每个订单的实际状态。正式上线后，这些订单的未完成阶段会回到待办，期限提醒也会重新生效。此操作无法在本页面撤销。",
  "goLive.confirm": "我确认历史订单的状态已更新，并希望释放其待办。",
  "goLive.start": "正式上线",
  "goLive.starting": "释放中…",
  "goLive.running": "分批释放中",
  "goLive.progress": "已释放 {processed} / {total} 条记录",
  "goLive.runningHint":
    "请保持本页面打开直到完成。如果关闭，释放会停在当前位置，回到本页面后继续。",
  "goLive.stepError": "本轮失败：{detail}",
  "goLive.done": "正式上线已于 {when} 完成。没有任何记录处于暂停。",
  "goLive.empty": "没有暂停的订单。",
  "goLive.rebuild": "重建订单摘要",
  "goLive.error": "无法正式上线：{detail}",
  "goLive.error.confirm": "请勾选确认后再正式上线。",
  "goLive.held.title": "Sankhya 历史订单：进行中的活动（{n} 个订单）",
  "goLive.held.hint":
    "暂缓至上线的历史订单中进行中活动的待办。可像其他订单一样处理，但不发送提醒，也不计入菜单角标和 SLA。",
  "goLive.held.empty": "本页历史订单中没有您的待办。",
  "goLive.held.page": "第 {page} 页，共 {pages} 页",
  "goLive.held.prev": "上一页",
  "goLive.held.next": "下一页",
  "goLive.held.open": "打开",
};
