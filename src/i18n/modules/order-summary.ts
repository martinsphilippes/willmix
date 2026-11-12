/**
 * Dicionário do módulo "order-summary" (Configurações → Resumos dos pedidos;
 * docs/RESUMOS.md): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "summaries.link": "Resumos dos pedidos",
  "summaries.title": "Resumos dos pedidos",
  "summaries.subtitle":
    "A Control Tower lê um resumo de cada pedido em vez das tabelas inteiras. O resumo é refeito a cada gravação do pedido e reconstruído toda noite.",
  "summaries.status": "Última reconstrução completa",
  "summaries.never":
    "Ainda não houve reconstrução: a Control Tower lê as tabelas inteiras (mais lenta). Reconstrua uma vez para ligar os resumos.",
  "summaries.builtAt": "Quando",
  "summaries.orders": "Pedidos",
  "summaries.written": "Resumos gravados",
  "summaries.removed": "Resumos apagados",
  "summaries.duration": "Duração",
  "summaries.rebuild": "Reconstruir agora",
  "summaries.rebuilding": "Reconstruindo…",
  "summaries.rebuildHint":
    "Lê os pedidos em partes de 500 e grava só o que mudou. Com muitos pedidos, leva alguns minutos e mostra o andamento.",
  "summaries.done": "Resumos reconstruídos.",
  "summaries.error": "A reconstrução falhou: {detail}",
  "summaries.running": "Reconstrução em andamento",
  "summaries.progress": "{processed} de {total} pedidos processados.",
  "summaries.busy":
    "Outra rodada está trabalhando agora (outra aba ou o job noturno). Esta tela continua quando ela terminar.",
  "summaries.runningHint":
    "A reconstrução é feita em partes de 500 pedidos. Pode fechar esta tela: ela fica parada onde estava e continua ao abrir de novo ou no job noturno. Até terminar, a Control Tower segue pelo caminho anterior.",
  "summaries.stepError": "Uma parte da reconstrução falhou: {detail}",
  "summaries.retry": "Tentar de novo",
  "ct.list.more":
    "Mostrando os {shown} primeiros de {total}. Use Pedidos para ver e filtrar todos.",
};

export const en: Record<keyof typeof pt, string> = {
  "summaries.link": "Order summaries",
  "summaries.title": "Order summaries",
  "summaries.subtitle":
    "The Control Tower reads one summary per order instead of whole tables. Each summary is refreshed on every write to the order and rebuilt every night.",
  "summaries.status": "Last full rebuild",
  "summaries.never":
    "No rebuild yet: the Control Tower reads whole tables (slower). Rebuild once to turn summaries on.",
  "summaries.builtAt": "When",
  "summaries.orders": "Orders",
  "summaries.written": "Summaries written",
  "summaries.removed": "Summaries removed",
  "summaries.duration": "Duration",
  "summaries.rebuild": "Rebuild now",
  "summaries.rebuilding": "Rebuilding…",
  "summaries.rebuildHint":
    "Reads orders in batches of 500 and writes only what changed. With many orders it takes a few minutes and shows its progress.",
  "summaries.done": "Summaries rebuilt.",
  "summaries.error": "The rebuild failed: {detail}",
  "summaries.running": "Rebuild in progress",
  "summaries.progress": "{processed} of {total} orders processed.",
  "summaries.busy":
    "Another round is working right now (another tab or the nightly job). This screen continues when it finishes.",
  "summaries.runningHint":
    "The rebuild runs in batches of 500 orders. You can close this screen: it stops where it was and continues when you open it again or in the nightly job. Until it finishes, the Control Tower keeps using the previous path.",
  "summaries.stepError": "Part of the rebuild failed: {detail}",
  "summaries.retry": "Try again",
  "ct.list.more":
    "Showing the first {shown} of {total}. Use Orders to see and filter all of them.",
};

export const zh: Record<keyof typeof pt, string> = {
  "summaries.link": "订单摘要",
  "summaries.title": "订单摘要",
  "summaries.subtitle":
    "控制塔读取每个订单的摘要，而不是整张表。订单每次写入都会刷新摘要，每晚全部重建。",
  "summaries.status": "上次完整重建",
  "summaries.never":
    "尚未重建：控制塔读取整张表（较慢）。重建一次即可启用摘要。",
  "summaries.builtAt": "时间",
  "summaries.orders": "订单",
  "summaries.written": "已写入摘要",
  "summaries.removed": "已删除摘要",
  "summaries.duration": "耗时",
  "summaries.rebuild": "立即重建",
  "summaries.rebuilding": "正在重建…",
  "summaries.rebuildHint":
    "按每批 500 个订单读取，只写入有变化的部分。订单很多时需要几分钟，并显示进度。",
  "summaries.done": "摘要已重建。",
  "summaries.error": "重建失败：{detail}",
  "summaries.running": "正在重建",
  "summaries.progress": "已处理 {processed} / {total} 个订单。",
  "summaries.busy":
    "另一轮正在运行（其他标签页或夜间任务）。它结束后此页面会继续。",
  "summaries.runningHint":
    "重建按每批 500 个订单进行。可以关闭此页面：重建会停在原处，再次打开或夜间任务时继续。完成之前，控制塔仍使用原来的方式。",
  "summaries.stepError": "部分重建失败：{detail}",
  "summaries.retry": "重试",
  "ct.list.more":
    "显示前 {shown} 条，共 {total} 条。请在“订单”中查看和筛选全部。",
};
