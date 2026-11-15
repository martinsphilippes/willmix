/**
 * Dicionário do módulo "milestone-migration" (Configurações → Resumos dos
 * pedidos → Migrar para os marcos; fase 5b, docs/MILESTONES.md): mesmas
 * chaves em pt, en e zh.
 */
export const pt = {
  "milestoneMigration.title": "Migrar para os marcos",
  "milestoneMigration.hint":
    "Fase 5b: grava, ao lado das etapas antigas, o passo e o marco de cada item, os marcos de cada pedido e o marco atual. Só preenche o que está vazio, mantém a espera do histórico do Sankhya e não manda aviso. Nenhuma tela lê esses campos ainda.",
  "milestoneMigration.start": "Migrar para os marcos",
  "milestoneMigration.starting": "Migrando…",
  "milestoneMigration.running": "Migração em andamento",
  "milestoneMigration.progress": "{processed} de {total} pedidos migrados.",
  "milestoneMigration.done": "Migração para os marcos concluída.",
  "milestoneMigration.last": "Última migração",
  "milestoneMigration.never": "Ainda não houve migração.",
  "milestoneMigration.requirements": "Itens preenchidos",
  "milestoneMigration.milestones": "Marcos gravados",
  "milestoneMigration.orders": "Pedidos com marco atual",
  "milestoneMigration.parityTitle": "Conferência dos marcos",
  "milestoneMigration.parityHint":
    "Compara, pedido a pedido, os marcos calculados pelas etapas com os calculados pelos campos gravados nos itens, o marco atual gravado e as linhas dos marcos. A meta é zero diferença. Só lê.",
  "milestoneMigration.parityStart": "Conferir",
  "milestoneMigration.parityStarting": "Conferindo…",
  "milestoneMigration.parityRunning": "Conferência em andamento",
  "milestoneMigration.parityProgress":
    "{processed} de {total} pedidos conferidos.",
  "milestoneMigration.parityDone": "Conferência concluída.",
  "milestoneMigration.parityNever": "Ainda não houve conferência.",
  "milestoneMigration.differences": "Pedidos com diferença",
  "milestoneMigration.diffViews": "Marcos diferentes",
  "milestoneMigration.diffRequirements": "Itens sem passo ou marco certo",
  "milestoneMigration.diffCurrent": "Marco atual diferente",
  "milestoneMigration.diffRows": "Linhas dos marcos faltando",
  "milestoneMigration.sample": "Pedidos com diferença (até 20): {list}",
  "milestoneMigration.zero": "Zero diferença.",
  "milestoneMigration.when": "Quando",
  "milestoneMigration.ordersCount": "Pedidos",
};

export const en: Record<keyof typeof pt, string> = {
  "milestoneMigration.title": "Migrate to milestones",
  "milestoneMigration.hint":
    "Phase 5b: alongside the old stages, stores each item's step and milestone, each order's milestones and its current milestone. Only fills what is empty, keeps the Sankhya history on hold and sends no notification. No screen reads these fields yet.",
  "milestoneMigration.start": "Migrate to milestones",
  "milestoneMigration.starting": "Migrating…",
  "milestoneMigration.running": "Migration in progress",
  "milestoneMigration.progress": "{processed} of {total} orders migrated.",
  "milestoneMigration.done": "Migration to milestones finished.",
  "milestoneMigration.last": "Last migration",
  "milestoneMigration.never": "No migration yet.",
  "milestoneMigration.requirements": "Items filled",
  "milestoneMigration.milestones": "Milestones stored",
  "milestoneMigration.orders": "Orders with current milestone",
  "milestoneMigration.parityTitle": "Milestone check",
  "milestoneMigration.parityHint":
    "Compares, order by order, the milestones computed from the stages with the ones computed from the fields stored on the items, the stored current milestone and the milestone rows. The target is zero differences. Read only.",
  "milestoneMigration.parityStart": "Check",
  "milestoneMigration.parityStarting": "Checking…",
  "milestoneMigration.parityRunning": "Check in progress",
  "milestoneMigration.parityProgress": "{processed} of {total} orders checked.",
  "milestoneMigration.parityDone": "Check finished.",
  "milestoneMigration.parityNever": "No check yet.",
  "milestoneMigration.differences": "Orders with differences",
  "milestoneMigration.diffViews": "Different milestones",
  "milestoneMigration.diffRequirements":
    "Items without the right step or milestone",
  "milestoneMigration.diffCurrent": "Different current milestone",
  "milestoneMigration.diffRows": "Missing milestone rows",
  "milestoneMigration.sample": "Orders with differences (up to 20): {list}",
  "milestoneMigration.zero": "Zero differences.",
  "milestoneMigration.when": "When",
  "milestoneMigration.ordersCount": "Orders",
};

export const zh: Record<keyof typeof pt, string> = {
  "milestoneMigration.title": "迁移到里程碑",
  "milestoneMigration.hint":
    "第 5b 阶段：在旧阶段之外，保存每个事项的步骤和里程碑、每个订单的里程碑及当前里程碑。只填写空白内容，保留 Sankhya 历史的暂停状态，不发送通知。目前还没有页面读取这些字段。",
  "milestoneMigration.start": "迁移到里程碑",
  "milestoneMigration.starting": "迁移中…",
  "milestoneMigration.running": "迁移进行中",
  "milestoneMigration.progress": "已迁移 {processed} / {total} 个订单。",
  "milestoneMigration.done": "里程碑迁移完成。",
  "milestoneMigration.last": "上次迁移",
  "milestoneMigration.never": "尚未迁移。",
  "milestoneMigration.requirements": "已填写的事项",
  "milestoneMigration.milestones": "已保存的里程碑",
  "milestoneMigration.orders": "有当前里程碑的订单",
  "milestoneMigration.parityTitle": "里程碑核对",
  "milestoneMigration.parityHint":
    "逐个订单比较：按阶段计算的里程碑与按事项已保存字段计算的里程碑、已保存的当前里程碑以及里程碑记录。目标是零差异。只读。",
  "milestoneMigration.parityStart": "核对",
  "milestoneMigration.parityStarting": "核对中…",
  "milestoneMigration.parityRunning": "核对进行中",
  "milestoneMigration.parityProgress": "已核对 {processed} / {total} 个订单。",
  "milestoneMigration.parityDone": "核对完成。",
  "milestoneMigration.parityNever": "尚未核对。",
  "milestoneMigration.differences": "有差异的订单",
  "milestoneMigration.diffViews": "里程碑不同",
  "milestoneMigration.diffRequirements": "步骤或里程碑不正确的事项",
  "milestoneMigration.diffCurrent": "当前里程碑不同",
  "milestoneMigration.diffRows": "缺少的里程碑记录",
  "milestoneMigration.sample": "有差异的订单（最多 20 个）：{list}",
  "milestoneMigration.zero": "零差异。",
  "milestoneMigration.when": "时间",
  "milestoneMigration.ordersCount": "订单",
};
