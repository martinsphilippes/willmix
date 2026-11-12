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
    "Lê todos os pedidos e grava só o que mudou. Pode levar alguns minutos com muitos pedidos.",
  "summaries.done": "Resumos reconstruídos.",
  "summaries.error": "A reconstrução falhou: {detail}",
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
    "Reads every order and writes only what changed. It can take a few minutes with many orders.",
  "summaries.done": "Summaries rebuilt.",
  "summaries.error": "The rebuild failed: {detail}",
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
    "读取所有订单，只写入有变化的部分。订单很多时可能需要几分钟。",
  "summaries.done": "摘要已重建。",
  "summaries.error": "重建失败：{detail}",
  "ct.list.more": "显示前 {shown} 条，共 {total} 条。请在“订单”中查看和筛选全部。",
};
